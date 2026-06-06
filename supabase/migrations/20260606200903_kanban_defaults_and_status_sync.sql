begin;

alter table public.orders
  alter column kanban_stage set default 'pending';

alter table public.followups
  alter column kanban_stage set default 'todo';

alter table public.platform_external_orders
  drop constraint if exists platform_external_orders_platform_platform_account_id_external_order_id_key;

alter table public.platform_external_orders
  add constraint platform_external_orders_identity_key
  unique nulls not distinct (platform, platform_account_id, external_order_id);

commit;
