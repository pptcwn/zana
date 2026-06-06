-- platform_accounts is LEFT JOIN-ed in dead_letter_events view (security_invoker).
-- The calling role needs table-level SELECT; RLS policy restricts to integrations:manage.
grant select on public.platform_accounts to authenticated;
