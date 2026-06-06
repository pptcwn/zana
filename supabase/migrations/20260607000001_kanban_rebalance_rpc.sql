create or replace function public.rebalance_kanban_column(
  p_entity_type text,
  p_stage text,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_capability text;
begin
  v_capability := case p_entity_type
    when 'order'    then 'kanban:orders'
    when 'customer' then 'kanban:customers'
    when 'followup' then 'kanban:followups'
    else null
  end;
  if v_capability is null then
    raise exception using errcode='22023', message='INVALID_ENTITY_TYPE';
  end if;
  perform private.assert_admin_action(p_admin_id, v_capability);

  if p_entity_type = 'order' then
    with ranked as (
      select id, row_number() over (order by sort_order, updated_at) as rn
      from public.orders where kanban_stage = p_stage for update
    )
    update public.orders o
    set sort_order = ranked.rn * 65536
    from ranked where ranked.id = o.id;

  elsif p_entity_type = 'customer' then
    with ranked as (
      select id, row_number() over (order by sort_order, updated_at) as rn
      from public.customers where kanban_stage = p_stage for update
    )
    update public.customers c
    set sort_order = ranked.rn * 65536
    from ranked where ranked.id = c.id;

  elsif p_entity_type = 'followup' then
    with ranked as (
      select id, row_number() over (order by sort_order, updated_at) as rn
      from public.followups where kanban_stage = p_stage for update
    )
    update public.followups f
    set sort_order = ranked.rn * 65536
    from ranked where ranked.id = f.id;
  end if;
end;
$$;

revoke execute on function public.rebalance_kanban_column(text,text,uuid)
  from public, anon;
grant execute on function public.rebalance_kanban_column(text,text,uuid)
  to authenticated;
