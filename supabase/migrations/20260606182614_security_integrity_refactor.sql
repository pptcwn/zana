begin;

create schema if not exists private;

do $$
begin
  if exists (
    select 1
    from public.admins
    where role not in ('admin', 'ceo', 'telesales', 'clerk', 'stock')
  ) then
    raise exception 'Cannot apply RBAC migration: admins contains unknown roles';
  end if;

  if exists (
    select 1
    from public.followups
    where order_id is not null
    group by order_id, followup_type
    having count(*) > 1
  ) then
    raise exception 'Cannot add follow-up uniqueness: duplicate order/type rows exist';
  end if;
end;
$$;

alter table public.admins
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

update public.admins as admin
set auth_user_id = auth_user.id
from auth.users as auth_user
where admin.auth_user_id is null
  and lower(admin.email) = lower(auth_user.email);

create unique index if not exists admins_auth_user_id_key
  on public.admins(auth_user_id)
  where auth_user_id is not null;

alter table public.admins
  drop constraint if exists admins_role_check;

alter table public.admins
  add constraint admins_role_check
  check (role in ('admin', 'ceo', 'telesales', 'clerk', 'stock'));

create or replace function private.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select admin.role
  from public.admins as admin
  where admin.auth_user_id = auth.uid()
    and admin.is_active = true
  limit 1;
$$;

create or replace function private.has_admin_capability(capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case private.current_admin_role()
      when 'admin' then true
      when 'ceo' then true
      when 'telesales' then capability in ('orders:write', 'customers:write', 'crm:write')
      when 'clerk' then capability in ('orders:write', 'customers:write', 'ad-spend:write')
      when 'stock' then capability = 'products:write'
      else false
    end,
    false
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on function private.current_admin_role() from public, anon;
revoke execute on function private.has_admin_capability(text) from public, anon;
grant execute on function private.current_admin_role() to authenticated;
grant execute on function private.has_admin_capability(text) to authenticated;

update public.orders
set status = 'delivered'
where status = 'completed';

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'));

alter table public.followups
  drop constraint if exists followups_status_check;

alter table public.followups
  add constraint followups_status_check
  check (status in ('pending', 'done', 'skipped'));

alter table public.followups
  drop constraint if exists followups_order_type_key;

alter table public.followups
  add constraint followups_order_type_key unique(order_id, followup_type);

create table if not exists public.order_daily_counters (
  order_date date primary key,
  last_value integer not null check (last_value > 0)
);

revoke all on table public.order_daily_counters from anon, authenticated;

drop trigger if exists trg_deduct_stock on public.order_items;
drop function if exists public.fn_deduct_stock();
drop trigger if exists trg_sync_order_totals on public.order_items;
drop function if exists public.fn_sync_order_totals();

create or replace function public.fn_create_followups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered'
    and old.status is distinct from 'delivered'
  then
    insert into public.followups (
      customer_id,
      order_id,
      admin_id,
      followup_type,
      due_date
    )
    values
      (new.customer_id, new.id, new.admin_id, '3day', current_date + 3),
      (new.customer_id, new.id, new.admin_id, '7day', current_date + 7),
      (new.customer_id, new.id, new.admin_id, '14day', current_date + 14),
      (new.customer_id, new.id, new.admin_id, '30day', current_date + 30)
    on conflict (order_id, followup_type) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.fn_create_followups() from public, anon, authenticated;

drop trigger if exists trg_create_followups on public.orders;
create trigger trg_create_followups
after update of status on public.orders
for each row
when (
  new.status = 'delivered'
  and old.status is distinct from 'delivered'
)
execute function public.fn_create_followups();

create or replace function public.create_order_transaction(
  p_customer jsonb,
  p_items jsonb,
  p_platform text,
  p_payment_method text,
  p_shipping_fee numeric,
  p_discount numeric,
  p_notes text,
  p_admin_id uuid
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_sequence integer;
  v_item record;
  v_product public.products%rowtype;
  v_qty_after integer;
  v_total_amount numeric(10,2) := 0;
  v_total_cost numeric(10,2) := 0;
  v_phone text := nullif(btrim(p_customer ->> 'phone'), '');
  v_name text := nullif(btrim(p_customer ->> 'name'), '');
  v_address text := nullif(btrim(p_customer ->> 'address'), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  if not private.has_admin_capability('orders:write') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.admins as admin
    where admin.id = p_admin_id
      and admin.auth_user_id = auth.uid()
      and admin.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_IDENTITY_MISMATCH';
  end if;

  if v_name is null or v_phone is null then
    raise exception using errcode = '22023', message = 'CUSTOMER_NAME_AND_PHONE_REQUIRED';
  end if;

  if p_platform not in ('tiktok', 'facebook', 'line', 'shopee') then
    raise exception using errcode = '22023', message = 'INVALID_PLATFORM';
  end if;

  if coalesce(p_shipping_fee, 0) < 0 or coalesce(p_discount, 0) < 0 then
    raise exception using errcode = '22023', message = 'INVALID_MONETARY_INPUT';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception using errcode = '22023', message = 'ORDER_ITEMS_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, qty integer)
    where item.product_id is null or item.qty is null or item.qty <= 0
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_ITEM';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, qty integer)
    group by item.product_id
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'DUPLICATE_ORDER_PRODUCT';
  end if;

  select customer.id
  into v_customer_id
  from public.customers as customer
  where regexp_replace(coalesce(customer.phone, ''), '\D', '', 'g')
    = regexp_replace(v_phone, '\D', '', 'g')
  order by customer.created_at
  limit 1
  for update;

  if v_customer_id is null then
    insert into public.customers(name, phone, address, platform, tags)
    values (v_name, v_phone, v_address, p_platform, '{}')
    returning id into v_customer_id;
  else
    update public.customers
    set name = v_name,
        phone = v_phone,
        address = v_address,
        platform = p_platform,
        updated_at = now()
    where id = v_customer_id;
  end if;

  insert into public.order_daily_counters(order_date, last_value)
  values (current_date, 1)
  on conflict (order_date)
  do update set last_value = public.order_daily_counters.last_value + 1
  returning last_value into v_sequence;

  v_order_number :=
    'ORD-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_sequence::text, 3, '0');

  insert into public.orders (
    order_number,
    customer_id,
    admin_id,
    platform,
    status,
    invoice_date,
    total_amount,
    total_cost,
    shipping_fee,
    discount,
    payment_method,
    notes
  )
  values (
    v_order_number,
    v_customer_id,
    p_admin_id,
    p_platform,
    'pending',
    current_date,
    0,
    0,
    coalesce(p_shipping_fee, 0),
    coalesce(p_discount, 0),
    nullif(btrim(p_payment_method), ''),
    nullif(btrim(p_notes), '')
  )
  returning id into v_order_id;

  for v_item in
    select item.product_id, item.qty
    from jsonb_to_recordset(p_items) as item(product_id uuid, qty integer)
    order by item.product_id
  loop
    select product.*
    into v_product
    from public.products as product
    where product.id = v_item.product_id
    for update;

    if not found or not v_product.is_active then
      raise exception using errcode = '22023', message = 'PRODUCT_NOT_AVAILABLE';
    end if;

    if v_product.stock_qty < v_item.qty then
      raise exception using
        errcode = '22023',
        message = 'INSUFFICIENT_STOCK',
        detail = v_product.sku;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      qty,
      unit_price,
      unit_cost
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_item.qty,
      v_product.sell_price,
      v_product.cost_price
    );

    update public.products
    set stock_qty = stock_qty - v_item.qty,
        updated_at = now()
    where id = v_product.id
    returning stock_qty into v_qty_after;

    insert into public.inventory_movements (
      product_id,
      order_id,
      movement_type,
      qty_change,
      qty_after,
      notes,
      created_by
    )
    values (
      v_product.id,
      v_order_id,
      'sale',
      -v_item.qty,
      v_qty_after,
      'Created with order ' || v_order_number,
      p_admin_id
    );

    v_total_amount := v_total_amount + (v_product.sell_price * v_item.qty);
    v_total_cost := v_total_cost + (v_product.cost_price * v_item.qty);
  end loop;

  v_total_amount :=
    v_total_amount + coalesce(p_shipping_fee, 0) - coalesce(p_discount, 0);

  if v_total_amount < 0 then
    raise exception using errcode = '22023', message = 'ORDER_TOTAL_CANNOT_BE_NEGATIVE';
  end if;

  update public.orders
  set total_amount = v_total_amount,
      total_cost = v_total_cost,
      updated_at = now()
  where id = v_order_id;

  return query select v_order_id, v_order_number;
end;
$$;

revoke execute on function public.create_order_transaction(
  jsonb, jsonb, text, text, numeric, numeric, text, uuid
) from public, anon;
grant execute on function public.create_order_transaction(
  jsonb, jsonb, text, text, numeric, numeric, text, uuid
) to authenticated;

create or replace function public.get_low_stock_products()
returns table (
  id uuid,
  name text,
  sku text,
  stock_qty integer,
  low_stock_threshold integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    product.id,
    product.name,
    product.sku,
    product.stock_qty,
    product.low_stock_threshold
  from public.products as product
  where product.is_active = true
    and product.stock_qty <= product.low_stock_threshold
  order by product.stock_qty, product.name;
$$;

revoke execute on function public.get_low_stock_products() from public, anon;
grant execute on function public.get_low_stock_products() to authenticated;

create or replace function public.get_customer_order_summaries(
  p_customer_ids uuid[]
)
returns table (
  customer_id uuid,
  order_count bigint,
  total_spend numeric,
  last_order_date date,
  recent_orders jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    customer.id,
    count(all_orders.id),
    coalesce(sum(all_orders.total_amount), 0),
    max(all_orders.invoice_date),
    coalesce((
      select jsonb_agg(to_jsonb(recent_order) order by recent_order.invoice_date desc)
      from (
        select
          orders.id,
          orders.order_number,
          orders.total_amount,
          orders.status,
          orders.invoice_date,
          orders.platform,
          orders.customer_id
        from public.orders
        where orders.customer_id = customer.id
        order by orders.invoice_date desc, orders.created_at desc
        limit 20
      ) as recent_order
    ), '[]'::jsonb)
  from public.customers as customer
  left join public.orders as all_orders on all_orders.customer_id = customer.id
  where customer.id = any(p_customer_ids)
  group by customer.id;
$$;

revoke execute on function public.get_customer_order_summaries(uuid[]) from public, anon;
grant execute on function public.get_customer_order_summaries(uuid[]) to authenticated;

create or replace function public.adjust_stock_transaction(
  p_product_id uuid,
  p_qty_change integer,
  p_notes text,
  p_admin_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty_after integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_admin_capability('products:write') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_qty_change = 0 then
    raise exception using errcode = '22023', message = 'INVALID_STOCK_CHANGE';
  end if;
  if not exists (
    select 1 from public.admins as admin
    where admin.id = p_admin_id
      and admin.auth_user_id = auth.uid()
      and admin.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_IDENTITY_MISMATCH';
  end if;

  update public.products
  set stock_qty = stock_qty + p_qty_change,
      updated_at = now()
  where id = p_product_id
    and stock_qty + p_qty_change >= 0
  returning stock_qty into v_qty_after;

  if v_qty_after is null then
    raise exception using errcode = '22023', message = 'PRODUCT_NOT_FOUND_OR_INSUFFICIENT_STOCK';
  end if;

  insert into public.inventory_movements (
    product_id, movement_type, qty_change, qty_after, notes, created_by
  )
  values (
    p_product_id,
    case when p_qty_change > 0 then 'restock' else 'adjustment' end,
    p_qty_change,
    v_qty_after,
    nullif(btrim(p_notes), ''),
    p_admin_id
  );

  return v_qty_after;
end;
$$;

revoke execute on function public.adjust_stock_transaction(uuid, integer, text, uuid)
  from public, anon;
grant execute on function public.adjust_stock_transaction(uuid, integer, text, uuid)
  to authenticated;

alter table public.admins enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.order_daily_counters enable row level security;

drop policy if exists "auth_all_orders" on public.orders;
drop policy if exists "auth_all_customers" on public.customers;
drop policy if exists "auth_all_products" on public.products;
drop policy if exists "auth_all_followups" on public.followups;
drop policy if exists "auth_all_ad_spend" on public.ad_spend;

create policy admins_select_self
on public.admins for select
to authenticated
using (auth_user_id = auth.uid() and is_active = true);

create policy orders_select_active_admin
on public.orders for select
to authenticated
using (private.current_admin_role() is not null);

create policy orders_update_authorized
on public.orders for update
to authenticated
using (private.has_admin_capability('orders:write'))
with check (private.has_admin_capability('orders:write'));

create policy customers_select_active_admin
on public.customers for select
to authenticated
using (private.current_admin_role() is not null);

create policy customers_update_authorized
on public.customers for update
to authenticated
using (private.has_admin_capability('customers:write'))
with check (private.has_admin_capability('customers:write'));

create policy products_select_active_admin
on public.products for select
to authenticated
using (private.current_admin_role() is not null);

create policy products_update_authorized
on public.products for update
to authenticated
using (private.has_admin_capability('products:write'))
with check (private.has_admin_capability('products:write'));

create policy order_items_select_active_admin
on public.order_items for select
to authenticated
using (private.current_admin_role() is not null);

create policy inventory_select_active_admin
on public.inventory_movements for select
to authenticated
using (private.current_admin_role() is not null);

create policy followups_select_active_admin
on public.followups for select
to authenticated
using (private.current_admin_role() is not null);

create policy followups_update_authorized
on public.followups for update
to authenticated
using (private.has_admin_capability('crm:write'))
with check (private.has_admin_capability('crm:write'));

create policy ad_spend_select_active_admin
on public.ad_spend for select
to authenticated
using (private.current_admin_role() is not null);

create policy ad_spend_insert_authorized
on public.ad_spend for insert
to authenticated
with check (
  private.has_admin_capability('ad-spend:write')
  and created_by = (
    select admin.id
    from public.admins as admin
    where admin.auth_user_id = auth.uid()
      and admin.is_active = true
  )
);

create policy ad_spend_delete_authorized
on public.ad_spend for delete
to authenticated
using (private.has_admin_capability('ad-spend:write'));

revoke insert on public.customers from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
revoke update on public.orders from authenticated;
grant update(status, tracking_number, shipped_date, updated_at)
  on public.orders to authenticated;
revoke update on public.customers from authenticated;
grant update(name, phone, address, notes, updated_at)
  on public.customers to authenticated;
revoke update on public.products from authenticated;
grant update(name, sell_price, cost_price, low_stock_threshold, is_active, updated_at)
  on public.products to authenticated;
revoke update on public.followups from authenticated;
grant update(status, outcome, contacted_at)
  on public.followups to authenticated;

commit;
