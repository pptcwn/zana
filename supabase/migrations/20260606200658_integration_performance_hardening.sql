create index if not exists ad_spend_created_by_idx
  on public.ad_spend(created_by);
create index if not exists followups_admin_id_idx
  on public.followups(admin_id);
create index if not exists followups_customer_id_idx
  on public.followups(customer_id);
create index if not exists inventory_movements_created_by_idx
  on public.inventory_movements(created_by);
create index if not exists inventory_movements_order_id_idx
  on public.inventory_movements(order_id);
create index if not exists order_items_order_id_idx
  on public.order_items(order_id);
create index if not exists order_items_product_id_idx
  on public.order_items(product_id);
create index if not exists platform_external_orders_order_id_idx
  on public.platform_external_orders(order_id);
create index if not exists platform_external_orders_account_id_idx
  on public.platform_external_orders(platform_account_id);
create index if not exists platform_webhook_events_account_id_idx
  on public.platform_webhook_events(platform_account_id);
create index if not exists telegram_action_tokens_admin_id_idx
  on public.telegram_action_tokens(consumed_by_admin_id);
create index if not exists workflow_transition_actor_idx
  on public.workflow_transition_log(actor_admin_id);

drop policy if exists admins_select_self on public.admins;
create policy admins_select_self
  on public.admins for select to authenticated
  using (auth_user_id = (select auth.uid()) and is_active = true);

drop policy if exists ad_spend_insert_authorized on public.ad_spend;
create policy ad_spend_insert_authorized
  on public.ad_spend for insert to authenticated
  with check (
    private.has_admin_capability('ad-spend:write')
    and created_by = (
      select admin.id
      from public.admins as admin
      where admin.auth_user_id = (select auth.uid())
        and admin.is_active = true
    )
  );
