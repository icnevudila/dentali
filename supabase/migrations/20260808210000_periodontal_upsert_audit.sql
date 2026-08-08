-- Version periodontal_data updates via dental_chart_audit_events (before/after snapshots).
-- Does not silently discard prior probing depths — previous JSON is retained in audit.

drop function if exists public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid);

create or replace function public.upsert_patient_periodontal(
  p_patient_id uuid,
  p_branch_id uuid,
  p_organization_id uuid,
  p_data jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chart_id uuid;
  v_chart record;
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if not public.has_permission('dental_chart.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  select id, periodontal_data
    into v_chart_id, v_before
  from public.dental_charts
  where patient_id = p_patient_id
    and branch_id = p_branch_id
    and organization_id = p_organization_id
    and status = 'active'
  order by updated_at desc
  limit 1;

  v_after := coalesce(p_data, '{}'::jsonb);

  if v_chart_id is null then
    insert into public.dental_charts (
      organization_id, branch_id, patient_id, periodontal_data, created_by, updated_by
    ) values (
      p_organization_id, p_branch_id, p_patient_id, v_after,
      p_actor_user_id, p_actor_user_id
    )
    returning id into v_chart_id;

    v_action := 'INSERT';
    v_before := null;

    insert into public.dental_chart_audit_events (
      chart_id, patient_id, organization_id, branch_id,
      action, tooth_number, before_json, after_json, actor_user_id
    ) values (
      v_chart_id, p_patient_id, p_organization_id, p_branch_id,
      v_action, null,
      null,
      jsonb_build_object('kind', 'periodontal', 'data', v_after),
      p_actor_user_id
    );
  else
    -- Skip no-op writes so autosave does not spam audit history
    if coalesce(v_before, '{}'::jsonb) is not distinct from v_after then
      select id, patient_id, branch_id, periodontal_data
        into v_chart
      from public.dental_charts
      where id = v_chart_id;

      return jsonb_build_object(
        'chart_id', v_chart.id,
        'patient_id', v_chart.patient_id,
        'branch_id', v_chart.branch_id,
        'data', coalesce(v_chart.periodontal_data, '{}'::jsonb)
      );
    end if;

    update public.dental_charts
    set
      periodontal_data = v_after,
      updated_by = p_actor_user_id,
      updated_at = now()
    where id = v_chart_id;

    insert into public.dental_chart_audit_events (
      chart_id, patient_id, organization_id, branch_id,
      action, tooth_number, before_json, after_json, actor_user_id
    ) values (
      v_chart_id, p_patient_id, p_organization_id, p_branch_id,
      'UPDATE', null,
      jsonb_build_object('kind', 'periodontal', 'data', coalesce(v_before, '{}'::jsonb)),
      jsonb_build_object('kind', 'periodontal', 'data', v_after),
      p_actor_user_id
    );
  end if;

  select id, patient_id, branch_id, periodontal_data
    into v_chart
  from public.dental_charts
  where id = v_chart_id;

  return jsonb_build_object(
    'chart_id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'data', coalesce(v_chart.periodontal_data, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid) to authenticated;

comment on function public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid) is
  'Upserts periodontal_data on the active dental chart; snapshots prior JSON into dental_chart_audit_events.';
