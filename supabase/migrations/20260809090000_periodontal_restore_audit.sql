-- Restore a prior periodontal_data snapshot from dental_chart_audit_events.
-- Requires dental_chart.write; writes a RESTORE audit row (before/after snapshots).

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.dental_chart_audit_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%INSERT%UPDATE%VOID%'
  ) then
    alter table public.dental_chart_audit_events
      drop constraint if exists dental_chart_audit_events_action_check;
  end if;
exception
  when undefined_object then
    null;
end $$;

alter table public.dental_chart_audit_events
  drop constraint if exists dental_chart_audit_events_action_check;

alter table public.dental_chart_audit_events
  add constraint dental_chart_audit_events_action_check
  check (action in ('INSERT', 'UPDATE', 'VOID', 'RESTORE'));

create or replace function public.restore_patient_periodontal(
  p_patient_id uuid,
  p_branch_id uuid,
  p_organization_id uuid,
  p_audit_event_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_chart_id uuid;
  v_before jsonb;
  v_snapshot jsonb;
  v_chart record;
begin
  if not public.has_permission('dental_chart.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  select
    e.id,
    e.chart_id,
    e.patient_id,
    e.branch_id,
    e.organization_id,
    e.before_json,
    e.after_json
  into v_event
  from public.dental_chart_audit_events e
  where e.id = p_audit_event_id
  limit 1;

  if v_event.id is null then
    raise exception 'Audit event not found';
  end if;

  if v_event.patient_id <> p_patient_id
     or v_event.branch_id <> p_branch_id
     or v_event.organization_id <> p_organization_id then
    raise exception 'Audit event mismatch';
  end if;

  -- Prefer the saved after snapshot; fall back to before for legacy rows.
  if coalesce(v_event.after_json->>'kind', '') = 'periodontal' then
    v_snapshot := coalesce(v_event.after_json->'data', '{}'::jsonb);
  elsif coalesce(v_event.before_json->>'kind', '') = 'periodontal' then
    v_snapshot := coalesce(v_event.before_json->'data', '{}'::jsonb);
  else
    raise exception 'Not a periodontal audit event';
  end if;

  select id, periodontal_data
    into v_chart_id, v_before
  from public.dental_charts
  where id = v_event.chart_id
    and patient_id = p_patient_id
    and branch_id = p_branch_id
    and organization_id = p_organization_id
    and status = 'active'
  limit 1;

  if v_chart_id is null then
    select id, periodontal_data
      into v_chart_id, v_before
    from public.dental_charts
    where patient_id = p_patient_id
      and branch_id = p_branch_id
      and organization_id = p_organization_id
      and status = 'active'
    order by updated_at desc
    limit 1;
  end if;

  if v_chart_id is null then
    insert into public.dental_charts (
      organization_id, branch_id, patient_id, periodontal_data, created_by, updated_by
    ) values (
      p_organization_id, p_branch_id, p_patient_id, v_snapshot,
      p_actor_user_id, p_actor_user_id
    )
    returning id into v_chart_id;
    v_before := null;
  else
    if coalesce(v_before, '{}'::jsonb) is not distinct from v_snapshot then
      select id, patient_id, branch_id, periodontal_data
        into v_chart
      from public.dental_charts
      where id = v_chart_id;

      return jsonb_build_object(
        'chart_id', v_chart.id,
        'patient_id', v_chart.patient_id,
        'branch_id', v_chart.branch_id,
        'data', coalesce(v_chart.periodontal_data, '{}'::jsonb),
        'restored', false
      );
    end if;

    update public.dental_charts
    set
      periodontal_data = v_snapshot,
      updated_by = p_actor_user_id,
      updated_at = now()
    where id = v_chart_id;
  end if;

  insert into public.dental_chart_audit_events (
    chart_id, patient_id, organization_id, branch_id,
    action, tooth_number, before_json, after_json, actor_user_id
  ) values (
    v_chart_id, p_patient_id, p_organization_id, p_branch_id,
    'RESTORE', null,
    jsonb_build_object(
      'kind', 'periodontal',
      'data', coalesce(v_before, '{}'::jsonb),
      'restore_from_event_id', p_audit_event_id
    ),
    jsonb_build_object(
      'kind', 'periodontal',
      'data', v_snapshot,
      'restore_from_event_id', p_audit_event_id
    ),
    p_actor_user_id
  );

  select id, patient_id, branch_id, periodontal_data
    into v_chart
  from public.dental_charts
  where id = v_chart_id;

  return jsonb_build_object(
    'chart_id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'data', coalesce(v_chart.periodontal_data, '{}'::jsonb),
    'restored', true
  );
end;
$$;

grant execute on function public.restore_patient_periodontal(uuid, uuid, uuid, uuid, uuid) to authenticated;

comment on function public.restore_patient_periodontal(uuid, uuid, uuid, uuid, uuid) is
  'Restores periodontal_data from a prior dental_chart_audit_events snapshot; requires dental_chart.write and writes a RESTORE audit row.';
