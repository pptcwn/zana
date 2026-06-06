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
  if date_trunc('milliseconds',v.updated_at) is distinct from
    date_trunc('milliseconds',p_expected_updated_at)
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
  if date_trunc('milliseconds',v.updated_at) is distinct from
    date_trunc('milliseconds',p_expected_updated_at)
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
  if date_trunc('milliseconds',v.updated_at) is distinct from
    date_trunc('milliseconds',p_expected_updated_at)
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
