-- ============================================================
-- ZANA E-Commerce & CRM — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PRODUCTS (Master inventory list)
-- ============================================================
create table products (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  sku           text unique not null,
  category      text not null,           -- 'perfume' | 'skincare' | 'maternity' | 'supplement'
  cost_price    numeric(10,2) not null default 0,
  sell_price    numeric(10,2) not null default 0,
  stock_qty     int not null default 0,
  low_stock_threshold int not null default 10,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. ADMINS (Team members / sales agents)
-- ============================================================
create table admins (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  name          text not null,
  email         text unique not null,
  role          text not null default 'telesales'
                check (role in ('admin', 'ceo', 'telesales', 'clerk', 'stock')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 3. CUSTOMERS (CRM base)
-- ============================================================
create table customers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  phone         text,
  address       text,
  platform      text not null,           -- 'tiktok' | 'facebook' | 'line' | 'shopee'
  tags          text[] default '{}',     -- ['vip','repeat','new']
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 4. ORDERS
-- ============================================================
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  order_number    text unique not null,   -- e.g. 'ORD-20240601-001'
  customer_id     uuid references customers(id) on delete set null,
  admin_id        uuid references admins(id) on delete set null,
  platform        text not null,          -- 'tiktok' | 'facebook' | 'line' | 'shopee'
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  invoice_date    date not null default current_date,
  shipped_date    date,
  total_amount    numeric(10,2) not null default 0,
  total_cost      numeric(10,2) not null default 0,
  shipping_fee    numeric(10,2) not null default 0,
  discount        numeric(10,2) not null default 0,
  net_profit      numeric(10,2) generated always as (total_amount - total_cost - shipping_fee + discount) stored,
  payment_method  text,
  tracking_number text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 5. ORDER ITEMS (Line items per order)
-- ============================================================
create table order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references orders(id) on delete cascade,
  product_id  uuid references products(id) on delete set null,
  product_name text not null,            -- snapshot at time of order
  qty         int not null default 1,
  unit_price  numeric(10,2) not null,
  unit_cost   numeric(10,2) not null default 0,
  subtotal    numeric(10,2) generated always as (qty * unit_price) stored
);

-- ============================================================
-- 6. INVENTORY MOVEMENTS (Audit trail)
-- ============================================================
create table inventory_movements (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid references products(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  movement_type text not null,           -- 'sale' | 'restock' | 'adjustment' | 'return'
  qty_change  int not null,              -- negative for sales, positive for restock
  qty_after   int not null,
  notes       text,
  created_by  uuid references admins(id),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 7. CRM FOLLOW-UPS (Auto-generated or manual)
-- ============================================================
create table followups (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid references customers(id) on delete cascade,
  order_id        uuid references orders(id) on delete cascade,
  admin_id        uuid references admins(id) on delete set null,
  followup_type   text not null,         -- '3day' | '7day' | '14day' | '30day' | 'manual'
  due_date        date not null,
  status          text not null default 'pending'
                  check (status in ('pending','done','skipped')),
  outcome         text,                  -- notes from the call/message
  contacted_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique(order_id, followup_type)
);

-- ============================================================
-- 8. AD SPEND (Daily tracking per platform)
-- ============================================================
create table ad_spend (
  id          uuid primary key default uuid_generate_v4(),
  spend_date  date not null,
  platform    text not null,             -- 'tiktok' | 'facebook'
  amount      numeric(10,2) not null default 0,
  impressions int,
  clicks      int,
  notes       text,
  created_by  uuid references admins(id),
  created_at  timestamptz not null default now(),
  unique(spend_date, platform)
);

create table order_daily_counters (
  order_date date primary key,
  last_value integer not null check (last_value > 0)
);

-- ============================================================
-- INDEXES (Performance)
-- ============================================================
create index idx_orders_invoice_date on orders(invoice_date);
create index idx_orders_customer_id  on orders(customer_id);
create index idx_orders_admin_id     on orders(admin_id);
create index idx_orders_platform     on orders(platform);
create index idx_orders_status       on orders(status);
create index idx_followups_due_date  on followups(due_date);
create index idx_followups_status    on followups(status);
create index idx_inventory_product   on inventory_movements(product_id);
create index idx_ad_spend_date       on ad_spend(spend_date);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

create schema if not exists private;

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

create or replace function public.fn_create_followups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.followups (
    customer_id, order_id, admin_id, followup_type, due_date
  )
  values
    (new.customer_id, new.id, new.admin_id, '3day', current_date + 3),
    (new.customer_id, new.id, new.admin_id, '7day', current_date + 7),
    (new.customer_id, new.id, new.admin_id, '14day', current_date + 14),
    (new.customer_id, new.id, new.admin_id, '30day', current_date + 30)
  on conflict (order_id, followup_type) do nothing;
  return new;
end;
$$;

revoke execute on function public.fn_create_followups() from public, anon, authenticated;

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
    select 1 from public.admins as admin
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
    or jsonb_array_length(p_items) = 0 then
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

  select customer.id into v_customer_id
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
    order_number, customer_id, admin_id, platform, status, invoice_date,
    total_amount, total_cost, shipping_fee, discount, payment_method, notes
  )
  values (
    v_order_number, v_customer_id, p_admin_id, p_platform, 'pending',
    current_date, 0, 0, coalesce(p_shipping_fee, 0),
    coalesce(p_discount, 0), nullif(btrim(p_payment_method), ''),
    nullif(btrim(p_notes), '')
  )
  returning id into v_order_id;

  for v_item in
    select item.product_id, item.qty
    from jsonb_to_recordset(p_items) as item(product_id uuid, qty integer)
    order by item.product_id
  loop
    select product.* into v_product
    from public.products as product
    where product.id = v_item.product_id
    for update;

    if not found or not v_product.is_active then
      raise exception using errcode = '22023', message = 'PRODUCT_NOT_AVAILABLE';
    end if;
    if v_product.stock_qty < v_item.qty then
      raise exception using errcode = '22023', message = 'INSUFFICIENT_STOCK', detail = v_product.sku;
    end if;

    insert into public.order_items (
      order_id, product_id, product_name, qty, unit_price, unit_cost
    )
    values (
      v_order_id, v_product.id, v_product.name, v_item.qty,
      v_product.sell_price, v_product.cost_price
    );

    update public.products
    set stock_qty = stock_qty - v_item.qty, updated_at = now()
    where id = v_product.id
    returning stock_qty into v_qty_after;

    insert into public.inventory_movements (
      product_id, order_id, movement_type, qty_change, qty_after, notes, created_by
    )
    values (
      v_product.id, v_order_id, 'sale', -v_item.qty, v_qty_after,
      'Created with order ' || v_order_number, p_admin_id
    );

    v_total_amount := v_total_amount + (v_product.sell_price * v_item.qty);
    v_total_cost := v_total_cost + (v_product.cost_price * v_item.qty);
  end loop;

  v_total_amount := v_total_amount + coalesce(p_shipping_fee, 0) - coalesce(p_discount, 0);
  if v_total_amount < 0 then
    raise exception using errcode = '22023', message = 'ORDER_TOTAL_CANNOT_BE_NEGATIVE';
  end if;

  update public.orders
  set total_amount = v_total_amount, total_cost = v_total_cost, updated_at = now()
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
  id uuid, name text, sku text, stock_qty integer, low_stock_threshold integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select product.id, product.name, product.sku,
         product.stock_qty, product.low_stock_threshold
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
          orders.id, orders.order_number, orders.total_amount, orders.status,
          orders.invoice_date, orders.platform, orders.customer_id
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
  set stock_qty = stock_qty + p_qty_change, updated_at = now()
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table orders       enable row level security;
alter table customers    enable row level security;
alter table products     enable row level security;
alter table followups    enable row level security;
alter table ad_spend     enable row level security;
alter table admins       enable row level security;
alter table order_items  enable row level security;
alter table inventory_movements enable row level security;
alter table order_daily_counters enable row level security;

revoke all on table public.order_daily_counters from anon, authenticated;

create policy admins_select_self on admins for select to authenticated
using (auth_user_id = auth.uid() and is_active = true);

create policy orders_select_active_admin on orders for select to authenticated
using (private.current_admin_role() is not null);
create policy orders_update_authorized on orders for update to authenticated
using (private.has_admin_capability('orders:write'))
with check (private.has_admin_capability('orders:write'));

create policy customers_select_active_admin on customers for select to authenticated
using (private.current_admin_role() is not null);
create policy customers_update_authorized on customers for update to authenticated
using (private.has_admin_capability('customers:write'))
with check (private.has_admin_capability('customers:write'));

create policy products_select_active_admin on products for select to authenticated
using (private.current_admin_role() is not null);
create policy products_update_authorized on products for update to authenticated
using (private.has_admin_capability('products:write'))
with check (private.has_admin_capability('products:write'));

create policy order_items_select_active_admin on order_items for select to authenticated
using (private.current_admin_role() is not null);

create policy inventory_select_active_admin on inventory_movements for select to authenticated
using (private.current_admin_role() is not null);
create policy followups_select_active_admin on followups for select to authenticated
using (private.current_admin_role() is not null);
create policy followups_update_authorized on followups for update to authenticated
using (private.has_admin_capability('crm:write'))
with check (private.has_admin_capability('crm:write'));

create policy ad_spend_select_active_admin on ad_spend for select to authenticated
using (private.current_admin_role() is not null);
create policy ad_spend_insert_authorized on ad_spend for insert to authenticated
with check (
  private.has_admin_capability('ad-spend:write')
  and created_by = (
    select admin.id from public.admins as admin
    where admin.auth_user_id = auth.uid() and admin.is_active = true
  )
);
create policy ad_spend_delete_authorized on ad_spend for delete to authenticated
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

-- ============================================================
-- SEED DATA — ZANA Products
-- ============================================================
insert into products (name, sku, category, cost_price, sell_price, stock_qty, low_stock_threshold) values
  ('Baby Perfume — Milk Blossom 30ml',  'PRF-001', 'perfume',    85,  290,  120, 20),
  ('Baby Perfume — Sweet Powder 30ml',  'PRF-002', 'perfume',    85,  290,   98, 20),
  ('Baby Perfume — Gentle Breeze 30ml', 'PRF-003', 'perfume',    85,  290,   45,  20),
  ('Maternity Pants — S',               'MAT-S',   'maternity', 180,  490,   60, 15),
  ('Maternity Pants — M',               'MAT-M',   'maternity', 180,  490,   72, 15),
  ('Maternity Pants — L',               'MAT-L',   'maternity', 180,  490,   38, 15),
  ('Maternity Pants — XL',              'MAT-XL',  'maternity', 180,  490,   14,  10),
  ('Alpha Arbutin Serum 30ml',          'SER-001', 'skincare',  110,  390,   85, 15),
  ('Vitamin C Brightening Serum 30ml',  'SER-002', 'skincare',  120,  420,   60, 15),
  ('Collagen Face Cream 50g',           'CRM-001', 'skincare',  150,  550,   30, 10),
  ('Detox Coffee 100g',                 'COF-001', 'supplement', 95,  320,   90, 20),
  ('Collagen Coffee 100g',              'COF-002', 'supplement', 95,  320,   65, 20);
