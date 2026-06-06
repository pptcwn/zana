-- One customer can have many platform identities (TikTok handle, Shopee id, etc).
-- The customers.platform column is kept as the "primary" platform so existing
-- kanban/orders code that reads customers.platform keeps working; a trigger keeps
-- it in sync with the row flagged is_primary in customer_platforms.

create table if not exists public.customer_platforms (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  platform text not null check (platform in ('tiktok','facebook','line','shopee')),
  handle text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (customer_id, platform)
);

create index if not exists customer_platforms_customer_idx
  on public.customer_platforms(customer_id);

-- At most one primary platform per customer.
create unique index if not exists customer_platforms_one_primary_idx
  on public.customer_platforms(customer_id) where is_primary;

alter table public.customer_platforms enable row level security;

drop policy if exists customer_platforms_select_admin on public.customer_platforms;
create policy customer_platforms_select_admin
  on public.customer_platforms for select to authenticated
  using (private.current_admin_role() is not null);

revoke all on public.customer_platforms from anon;
grant select on public.customer_platforms to authenticated;

-- Backfill: every existing customer gets one primary platform row.
insert into public.customer_platforms (customer_id, platform, is_primary)
select id, platform, true from public.customers
on conflict (customer_id, platform) do nothing;

-- Keep customers.platform mirrored to the primary platform row.
create or replace function private.sync_customer_primary_platform()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid;
begin
  v_customer_id := coalesce(new.customer_id, old.customer_id);
  update public.customers c
  set platform = coalesce(
        (select cp.platform from public.customer_platforms cp
         where cp.customer_id = v_customer_id and cp.is_primary limit 1),
        c.platform
      ),
      updated_at = now()
  where c.id = v_customer_id;
  return null;
end;
$$;

drop trigger if exists customer_platforms_sync on public.customer_platforms;
create trigger customer_platforms_sync
  after insert or update or delete on public.customer_platforms
  for each row execute function private.sync_customer_primary_platform();

-- ============================================================
-- Create / update customer (+ platforms) atomically via RPC.
-- p_platforms is a jsonb array: [{"platform":"tiktok","handle":"@x","is_primary":true}, ...]
-- ============================================================

create or replace function public.upsert_customer_with_platforms(
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_address text,
  p_notes text,
  p_platforms jsonb,
  p_admin_id uuid
) returns public.customers language plpgsql security definer set search_path = '' as $$
declare
  v public.customers%rowtype;
  v_primary text;
  v_count int;
begin
  perform private.assert_admin_action(p_admin_id, 'customers:write');

  if jsonb_typeof(p_platforms) is distinct from 'array'
     or jsonb_array_length(p_platforms) = 0 then
    raise exception using errcode='22023', message='AT_LEAST_ONE_PLATFORM_REQUIRED';
  end if;

  -- Exactly one primary in the supplied set.
  select count(*) into v_count
  from jsonb_array_elements(p_platforms) e
  where (e->>'is_primary')::boolean is true;
  if v_count <> 1 then
    raise exception using errcode='22023', message='EXACTLY_ONE_PRIMARY_REQUIRED';
  end if;

  select e->>'platform' into v_primary
  from jsonb_array_elements(p_platforms) e
  where (e->>'is_primary')::boolean is true;

  if p_customer_id is null then
    insert into public.customers (name, phone, address, notes, platform)
    values (p_name, nullif(p_phone,''), p_address, p_notes, v_primary)
    returning * into v;
  else
    update public.customers
    set name = p_name,
        phone = nullif(p_phone,''),
        address = p_address,
        notes = p_notes,
        platform = v_primary,
        updated_at = now()
    where id = p_customer_id
    returning * into v;
    if not found then
      raise exception using errcode='P0002', message='CUSTOMER_NOT_FOUND';
    end if;
  end if;

  -- Replace platform set. Trigger re-syncs customers.platform afterward.
  delete from public.customer_platforms where customer_id = v.id;
  insert into public.customer_platforms (customer_id, platform, handle, is_primary)
  select v.id,
         e->>'platform',
         nullif(e->>'handle',''),
         coalesce((e->>'is_primary')::boolean, false)
  from jsonb_array_elements(p_platforms) e;

  return v;
end;
$$;

revoke execute on function public.upsert_customer_with_platforms(
  uuid,text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.upsert_customer_with_platforms(
  uuid,text,text,text,text,jsonb,uuid) to authenticated;
