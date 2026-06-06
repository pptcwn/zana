grant update(
  status,
  tracking_number,
  shipped_date,
  kanban_stage,
  status_changed_at,
  updated_at
) on public.orders to authenticated;

grant update(
  status,
  kanban_stage,
  outcome,
  contacted_at,
  updated_at
) on public.followups to authenticated;
