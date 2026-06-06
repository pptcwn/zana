begin;

alter table public.admins drop constraint if exists admins_role_check;
update public.admins set role = case role
  when 'ceo' then 'owner'
  when 'telesales' then 'sales'
  when 'clerk' then 'sales'
  when 'stock' then 'inventory'
  else role
end;
alter table public.admins add constraint admins_role_check
  check (role in ('owner', 'admin', 'sales', 'crm', 'inventory'));
alter table public.admins
  add column if not exists telegram_user_id bigint unique,
  add column if not exists telegram_username text;

create table if not exists private.role_capabilities (
  role text not null,
  capability text not null,
  primary key (role, capability),
  check (role in ('owner', 'admin', 'sales', 'crm', 'inventory'))
);

insert into private.role_capabilities(role, capability) values
  ('owner','dashboard:financial'),('owner','dashboard:sales'),
  ('owner','dashboard:crm'),('owner','dashboard:inventory'),
  ('owner','orders:write'),('owner','customers:write'),('owner','crm:write'),
  ('owner','ad-spend:write'),('owner','products:write'),
  ('owner','kanban:orders'),('owner','kanban:customers'),
  ('owner','kanban:followups'),('owner','integrations:manage'),
  ('admin','dashboard:financial'),('admin','dashboard:sales'),
  ('admin','dashboard:crm'),('admin','dashboard:inventory'),
  ('admin','orders:write'),('admin','customers:write'),('admin','crm:write'),
  ('admin','ad-spend:write'),('admin','products:write'),
  ('admin','kanban:orders'),('admin','kanban:customers'),
  ('admin','kanban:followups'),('admin','integrations:manage'),
  ('sales','dashboard:sales'),('sales','orders:write'),
  ('sales','customers:write'),('sales','kanban:orders'),
  ('sales','kanban:customers'),
  ('crm','dashboard:crm'),('crm','customers:write'),('crm','crm:write'),
  ('crm','kanban:customers'),('crm','kanban:followups'),
  ('inventory','dashboard:inventory'),('inventory','products:write'),
  ('inventory','kanban:orders')
on conflict do nothing;

create or replace function private.has_admin_capability(capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.admins a
    join private.role_capabilities c on c.role = a.role
    where a.auth_user_id = auth.uid() and a.is_active and c.capability = capability
  );
$$;
revoke all on table private.role_capabilities from public, anon, authenticated;
revoke execute on function private.has_admin_capability(text) from public, anon;
grant execute on function private.has_admin_capability(text) to authenticated;

create or replace function public.get_my_admin_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'admin_id', a.id,
    'role', a.role,
    'capabilities', coalesce(
      jsonb_agg(c.capability order by c.capability)
        filter (where c.capability is not null),
      '[]'::jsonb
    )
  )
  from public.admins a
  left join private.role_capabilities c on c.role = a.role
  where a.auth_user_id = auth.uid() and a.is_active
  group by a.id, a.role;
$$;
revoke execute on function public.get_my_admin_context() from public, anon;
grant execute on function public.get_my_admin_context() to authenticated;

alter table public.orders
  add column if not exists kanban_stage text,
  add column if not exists sort_order bigint not null default 1000,
  add column if not exists status_changed_at timestamptz not null default now();
update public.orders set kanban_stage = status where kanban_stage is null;
alter table public.orders alter column kanban_stage set not null;
alter table public.orders drop constraint if exists orders_kanban_stage_check;
alter table public.orders add constraint orders_kanban_stage_check
  check (kanban_stage in ('pending','confirmed','packed','shipped','delivered','cancelled'));

alter table public.customers
  add column if not exists kanban_stage text not null default 'lead',
  add column if not exists sort_order bigint not null default 1000;
alter table public.customers drop constraint if exists customers_kanban_stage_check;
alter table public.customers add constraint customers_kanban_stage_check
  check (kanban_stage in ('lead','contacted','qualified','customer','repeat','inactive'));

alter table public.followups
  add column if not exists kanban_stage text,
  add column if not exists sort_order bigint not null default 1000,
  add column if not exists updated_at timestamptz not null default now();
update public.followups set kanban_stage = case
  when status = 'done' then 'done'
  when status = 'skipped' then 'cancelled'
  else 'todo'
end where kanban_stage is null;
alter table public.followups alter column kanban_stage set not null;
alter table public.followups drop constraint if exists followups_kanban_stage_check;
alter table public.followups add constraint followups_kanban_stage_check
  check (kanban_stage in ('todo','in_progress','waiting','done','cancelled'));

create index if not exists orders_kanban_order_idx
  on public.orders(kanban_stage, sort_order, updated_at desc);
create index if not exists customers_kanban_order_idx
  on public.customers(kanban_stage, sort_order, updated_at desc);
create index if not exists followups_kanban_order_idx
  on public.followups(kanban_stage, sort_order, due_date);

create table if not exists public.workflow_transition_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('order','customer','followup')),
  entity_id uuid not null,
  from_stage text,
  to_stage text not null,
  from_sort_order bigint,
  to_sort_order bigint not null,
  actor_admin_id uuid references public.admins(id) on delete set null,
  source text not null default 'web' check (source in ('web','telegram','platform','system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workflow_transition_entity_idx
  on public.workflow_transition_log(entity_type, entity_id, created_at desc);
alter table public.workflow_transition_log enable row level security;
drop policy if exists workflow_transition_select_active_admin
  on public.workflow_transition_log;
create policy workflow_transition_select_active_admin
  on public.workflow_transition_log for select to authenticated
  using (private.current_admin_role() is not null);

create or replace function private.assert_admin_action(
  p_admin_id uuid,
  p_capability text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if not private.has_admin_capability(p_capability) then
    raise exception using errcode='42501', message='FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.admins
    where id=p_admin_id and auth_user_id=auth.uid() and is_active
  ) then
    raise exception using errcode='42501', message='ADMIN_IDENTITY_MISMATCH';
  end if;
end;
$$;
revoke execute on function private.assert_admin_action(uuid,text)
  from public, anon, authenticated;

create or replace function public.move_order_kanban_card(
  p_order_id uuid, p_to_stage text, p_sort_order bigint,
  p_expected_updated_at timestamptz, p_admin_id uuid, p_source text default 'web'
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare v public.orders%rowtype; v_from text; v_sort bigint;
begin
  perform private.assert_admin_action(p_admin_id, 'kanban:orders');
  if p_to_stage not in ('pending','confirmed','packed','shipped','delivered','cancelled')
    then raise exception using errcode='22023', message='INVALID_ORDER_STAGE'; end if;
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception using errcode='P0002', message='ORDER_NOT_FOUND'; end if;
  if v.updated_at is distinct from p_expected_updated_at
    then raise exception using errcode='40001', message='STALE_KANBAN_CARD'; end if;
  if v.kanban_stage in ('delivered','cancelled') and p_to_stage<>v.kanban_stage
    then raise exception using errcode='22023', message='FINAL_ORDER_STAGE'; end if;
  v_from:=v.kanban_stage; v_sort:=v.sort_order;
  update public.orders set
    kanban_stage=p_to_stage,
    status=case when p_to_stage='packed' then 'confirmed' else p_to_stage end,
    sort_order=p_sort_order,
    status_changed_at=case when kanban_stage<>p_to_stage then now() else status_changed_at end,
    updated_at=now()
  where id=p_order_id returning * into v;
  insert into public.workflow_transition_log(
    entity_type,entity_id,from_stage,to_stage,from_sort_order,to_sort_order,
    actor_admin_id,source
  ) values ('order',p_order_id,v_from,p_to_stage,v_sort,p_sort_order,p_admin_id,p_source);
  return v;
end;
$$;

create or replace function public.move_customer_kanban_card(
  p_customer_id uuid, p_to_stage text, p_sort_order bigint,
  p_expected_updated_at timestamptz, p_admin_id uuid, p_source text default 'web'
) returns public.customers language plpgsql security definer set search_path = '' as $$
declare v public.customers%rowtype; v_from text; v_sort bigint;
begin
  perform private.assert_admin_action(p_admin_id, 'kanban:customers');
  if p_to_stage not in ('lead','contacted','qualified','customer','repeat','inactive')
    then raise exception using errcode='22023', message='INVALID_CUSTOMER_STAGE'; end if;
  select * into v from public.customers where id=p_customer_id for update;
  if not found then raise exception using errcode='P0002', message='CUSTOMER_NOT_FOUND'; end if;
  if v.updated_at is distinct from p_expected_updated_at
    then raise exception using errcode='40001', message='STALE_KANBAN_CARD'; end if;
  v_from:=v.kanban_stage; v_sort:=v.sort_order;
  update public.customers set kanban_stage=p_to_stage,sort_order=p_sort_order,updated_at=now()
  where id=p_customer_id returning * into v;
  insert into public.workflow_transition_log(
    entity_type,entity_id,from_stage,to_stage,from_sort_order,to_sort_order,
    actor_admin_id,source
  ) values ('customer',p_customer_id,v_from,p_to_stage,v_sort,p_sort_order,p_admin_id,p_source);
  return v;
end;
$$;

create or replace function public.move_followup_kanban_card(
  p_followup_id uuid, p_to_stage text, p_sort_order bigint,
  p_expected_updated_at timestamptz, p_admin_id uuid, p_source text default 'web'
) returns public.followups language plpgsql security definer set search_path = '' as $$
declare v public.followups%rowtype; v_from text; v_sort bigint;
begin
  perform private.assert_admin_action(p_admin_id, 'kanban:followups');
  if p_to_stage not in ('todo','in_progress','waiting','done','cancelled')
    then raise exception using errcode='22023', message='INVALID_FOLLOWUP_STAGE'; end if;
  select * into v from public.followups where id=p_followup_id for update;
  if not found then raise exception using errcode='P0002', message='FOLLOWUP_NOT_FOUND'; end if;
  if v.updated_at is distinct from p_expected_updated_at
    then raise exception using errcode='40001', message='STALE_KANBAN_CARD'; end if;
  v_from:=v.kanban_stage; v_sort:=v.sort_order;
  update public.followups set
    kanban_stage=p_to_stage,
    status=case when p_to_stage='done' then 'done'
      when p_to_stage='cancelled' then 'skipped' else 'pending' end,
    sort_order=p_sort_order,
    contacted_at=case when p_to_stage='done' then coalesce(contacted_at,now()) else contacted_at end,
    updated_at=now()
  where id=p_followup_id returning * into v;
  insert into public.workflow_transition_log(
    entity_type,entity_id,from_stage,to_stage,from_sort_order,to_sort_order,
    actor_admin_id,source
  ) values ('followup',p_followup_id,v_from,p_to_stage,v_sort,p_sort_order,p_admin_id,p_source);
  return v;
end;
$$;

revoke execute on function public.move_order_kanban_card(
  uuid,text,bigint,timestamptz,uuid,text) from public,anon;
revoke execute on function public.move_customer_kanban_card(
  uuid,text,bigint,timestamptz,uuid,text) from public,anon;
revoke execute on function public.move_followup_kanban_card(
  uuid,text,bigint,timestamptz,uuid,text) from public,anon;
grant execute on function public.move_order_kanban_card(
  uuid,text,bigint,timestamptz,uuid,text) to authenticated;
grant execute on function public.move_customer_kanban_card(
  uuid,text,bigint,timestamptz,uuid,text) to authenticated;
grant execute on function public.move_followup_kanban_card(
  uuid,text,bigint,timestamptz,uuid,text) to authenticated;

create table if not exists public.platform_accounts (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok','shopee','facebook')),
  external_account_id text not null,
  display_name text not null,
  credentials_ciphertext text,
  webhook_secret_ciphertext text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform,external_account_id)
);
create table if not exists public.platform_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok','shopee','facebook')),
  platform_account_id uuid references public.platform_accounts(id),
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  headers jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','processed','failed')),
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text,
  unique(platform,external_event_id)
);
create index if not exists platform_webhook_pending_idx
  on public.platform_webhook_events(processing_status,received_at);
create table if not exists public.platform_external_orders (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok','shopee','facebook')),
  platform_account_id uuid references public.platform_accounts(id),
  external_order_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  external_status text,
  last_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  unique(platform,platform_account_id,external_order_id)
);

create table if not exists public.telegram_chats (
  id uuid primary key default uuid_generate_v4(),
  chat_id bigint not null unique,
  label text not null,
  notification_types text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.telegram_action_tokens (
  id uuid primary key default uuid_generate_v4(),
  token_hash text not null unique,
  action text not null,
  entity_type text not null check (entity_type in ('order','followup')),
  entity_id uuid not null,
  target_stage text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_admin_id uuid references public.admins(id),
  created_at timestamptz not null default now()
);
create index if not exists telegram_action_active_idx
  on public.telegram_action_tokens(token_hash,expires_at) where consumed_at is null;
create table if not exists public.telegram_notification_logs (
  id uuid primary key default uuid_generate_v4(),
  chat_id bigint not null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  telegram_message_id bigint,
  status text not null check(status in ('sent','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function public.perform_telegram_action(
  p_token_hash text,
  p_telegram_user_id bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin public.admins%rowtype;
  v_token public.telegram_action_tokens%rowtype;
begin
  select * into v_admin from public.admins
  where telegram_user_id=p_telegram_user_id and is_active for update;
  if not found then
    raise exception using errcode='42501', message='TELEGRAM_USER_NOT_AUTHORIZED';
  end if;

  select * into v_token from public.telegram_action_tokens
  where token_hash=p_token_hash and consumed_at is null and expires_at>now()
  for update;
  if not found then
    raise exception using errcode='22023', message='TELEGRAM_ACTION_INVALID';
  end if;

  if v_token.entity_type='order' then
    if not exists (
      select 1 from private.role_capabilities
      where role=v_admin.role and capability='kanban:orders'
    ) then
      raise exception using errcode='42501', message='FORBIDDEN';
    end if;
    update public.orders set
      kanban_stage=v_token.target_stage,
      status=case when v_token.target_stage='packed' then 'confirmed'
        else v_token.target_stage end,
      status_changed_at=now(), updated_at=now()
    where id=v_token.entity_id;
  elsif v_token.entity_type='followup' then
    if not exists (
      select 1 from private.role_capabilities
      where role=v_admin.role and capability='kanban:followups'
    ) then
      raise exception using errcode='42501', message='FORBIDDEN';
    end if;
    update public.followups set
      kanban_stage=v_token.target_stage,
      status=case when v_token.target_stage='done' then 'done'
        when v_token.target_stage='cancelled' then 'skipped' else 'pending' end,
      contacted_at=case when v_token.target_stage='done' then now() else contacted_at end,
      updated_at=now()
    where id=v_token.entity_id;
  else
    raise exception using errcode='22023', message='UNSUPPORTED_TELEGRAM_ENTITY';
  end if;

  update public.telegram_action_tokens set
    consumed_at=now(), consumed_by_admin_id=v_admin.id
  where id=v_token.id;

  insert into public.workflow_transition_log(
    entity_type,entity_id,to_stage,to_sort_order,actor_admin_id,source,metadata
  ) values (
    v_token.entity_type,v_token.entity_id,coalesce(v_token.target_stage,v_token.action),
    0,v_admin.id,'telegram',jsonb_build_object('action',v_token.action)
  );

  return jsonb_build_object(
    'entity_type',v_token.entity_type,
    'entity_id',v_token.entity_id,
    'target_stage',v_token.target_stage
  );
end;
$$;
revoke execute on function public.perform_telegram_action(text,bigint)
  from public,anon,authenticated;
grant execute on function public.perform_telegram_action(text,bigint)
  to service_role;

alter table public.platform_accounts enable row level security;
alter table public.platform_webhook_events enable row level security;
alter table public.platform_external_orders enable row level security;
alter table public.telegram_chats enable row level security;
alter table public.telegram_action_tokens enable row level security;
alter table public.telegram_notification_logs enable row level security;
revoke all on public.platform_accounts from anon,authenticated;
revoke all on public.platform_webhook_events from anon,authenticated;
revoke all on public.platform_external_orders from anon,authenticated;
revoke all on public.telegram_chats from anon,authenticated;
revoke all on public.telegram_action_tokens from anon,authenticated;
revoke all on public.telegram_notification_logs from anon,authenticated;

commit;
