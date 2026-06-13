-- Module 10: Treatment plan approve + estimate RPCs

create or replace function public.calculate_treatment_estimate(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_total numeric;
  v_count bigint;
begin
  select *
  into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id();

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  select coalesce(sum(estimated_price), 0), count(*)
  into v_total, v_count
  from public.treatment_plan_items
  where plan_id = p_plan_id;

  update public.treatment_plans
  set total_estimated = v_total, updated_at = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'total_estimated', v_total,
    'item_count', v_count,
    'status', v_plan.status
  );
end;
$$;

create or replace function public.approve_treatment_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_estimate jsonb;
  v_count bigint;
begin
  select *
  into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status not in ('draft', 'proposed') then
    raise exception 'Plan cannot be approved from status %', v_plan.status;
  end if;

  select count(*) into v_count
  from public.treatment_plan_items
  where plan_id = p_plan_id;

  if v_count = 0 then
    raise exception 'Add at least one procedure before approving';
  end if;

  v_estimate := public.calculate_treatment_estimate(p_plan_id);

  update public.treatment_plans
  set status = 'approved', approved_at = now(), updated_at = now()
  where id = p_plan_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'treatment_plan.approved',
    'treatment_plan',
    p_plan_id::text,
    jsonb_build_object(
      'total_estimated', v_estimate->'total_estimated',
      'item_count', v_estimate->'item_count'
    )
  );

  return v_estimate || jsonb_build_object('status', 'approved', 'approved_at', now());
end;
$$;

grant execute on function public.calculate_treatment_estimate(uuid) to authenticated;
grant execute on function public.approve_treatment_plan(uuid) to authenticated;
