alter table public.platform_accounts
  add column if not exists is_webhook_enabled boolean not null default false;

create or replace function public.set_platform_account_webhook(
  p_account_id uuid,
  p_enabled boolean,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin_action(p_admin_id, 'integrations:manage');
  update public.platform_accounts
  set is_webhook_enabled = p_enabled, updated_at = now()
  where id = p_account_id;
  if not found then
    raise exception using errcode='P0002', message='PLATFORM_ACCOUNT_NOT_FOUND';
  end if;
end;
$$;

revoke execute on function public.set_platform_account_webhook(uuid,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.set_platform_account_webhook(uuid,boolean,uuid)
  to authenticated;

drop policy if exists platform_accounts_select_admin on public.platform_accounts;
create policy platform_accounts_select_admin
  on public.platform_accounts for select to authenticated
  using (private.has_admin_capability('integrations:manage'));
