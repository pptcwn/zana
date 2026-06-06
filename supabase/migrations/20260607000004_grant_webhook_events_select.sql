-- security_invoker views require the calling role to have table-level SELECT
-- privilege in addition to passing RLS. Grant it here; the RLS policy
-- dead_letter_select_admin on this table still restricts rows to admins
-- with integrations:manage capability.
grant select on public.platform_webhook_events to authenticated;
