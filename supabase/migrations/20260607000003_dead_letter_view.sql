create or replace view public.dead_letter_events
  with (security_invoker = true)
as
select
  e.id,
  e.platform,
  a.display_name as account_name,
  e.external_event_id,
  e.event_type,
  e.attempts,
  e.received_at,
  e.last_error
from public.platform_webhook_events e
left join public.platform_accounts a on a.id = e.platform_account_id
where e.processing_status = 'failed';

alter view public.dead_letter_events owner to postgres;
revoke all on public.dead_letter_events from anon, authenticated;
grant select on public.dead_letter_events to authenticated;

drop policy if exists dead_letter_select_admin on public.platform_webhook_events;
create policy dead_letter_select_admin
  on public.platform_webhook_events for select to authenticated
  using (private.has_admin_capability('integrations:manage'));

create or replace function public.replay_webhook_event(
  p_event_id uuid,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin_action(p_admin_id, 'integrations:manage');
  update public.platform_webhook_events
  set processing_status = 'pending',
      last_error = null,
      processed_at = null
  where id = p_event_id and processing_status = 'failed';
  if not found then
    raise exception using errcode='P0002', message='EVENT_NOT_FOUND_OR_NOT_FAILED';
  end if;
end;
$$;

create or replace function public.dismiss_webhook_event(
  p_event_id uuid,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin_action(p_admin_id, 'integrations:manage');
  update public.platform_webhook_events
  set processing_status = 'processed',
      processed_at = now(),
      last_error = '[dismissed by admin]'
  where id = p_event_id and processing_status = 'failed';
  if not found then
    raise exception using errcode='P0002', message='EVENT_NOT_FOUND_OR_NOT_FAILED';
  end if;
end;
$$;

revoke execute on function public.replay_webhook_event(uuid,uuid) from public, anon;
grant execute on function public.replay_webhook_event(uuid,uuid) to authenticated;

revoke execute on function public.dismiss_webhook_event(uuid,uuid) from public, anon;
grant execute on function public.dismiss_webhook_event(uuid,uuid) to authenticated;
