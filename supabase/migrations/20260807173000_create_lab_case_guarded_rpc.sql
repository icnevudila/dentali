-- App calls create_lab_case_guarded; remote only had update_lab_case_status_guarded.
create or replace function public.create_lab_case_guarded(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_branch uuid := (p_payload->>'branch_id')::uuid;
  v_patient uuid := (p_payload->>'patient_id')::uuid;
  v_id uuid;
begin
  if v_org is null then raise exception 'Not authenticated'; end if;
  if v_branch is null or v_patient is null then raise exception 'Branch and patient are required'; end if;
  if not public.has_permission('dental_chart.write', v_branch) then raise exception 'Permission denied'; end if;
  if not exists (
    select 1 from public.branches b
    where b.id = v_branch and b.organization_id = v_org and b.is_active
  ) then
    raise exception 'Branch not found';
  end if;
  if not exists (select 1 from public.patients where id = v_patient and organization_id = v_org) then
    raise exception 'Patient not found';
  end if;
  if trim(coalesce(p_payload->>'lab_name', '')) = '' or trim(coalesce(p_payload->>'case_type', '')) = '' then
    raise exception 'Lab name and case type are required';
  end if;
  if nullif(p_payload->>'sent_date', '') is null then
    raise exception 'Sent date is required';
  end if;

  insert into public.lab_cases (
    organization_id, branch_id, patient_id, provider_id, lab_name, case_type,
    sent_date, expected_date, status, cost, notes
  ) values (
    v_org, v_branch, v_patient, nullif(p_payload->>'provider_id', '')::uuid,
    trim(p_payload->>'lab_name'), trim(p_payload->>'case_type'),
    (p_payload->>'sent_date')::date, nullif(p_payload->>'expected_date', '')::date,
    'pending', coalesce(nullif(p_payload->>'cost', '')::numeric, 0), nullif(trim(p_payload->>'notes'), '')
  ) returning id into v_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_org, v_branch, auth.uid(), 'lab_case.create', 'lab_case', v_id::text,
    jsonb_build_object('patient_id', v_patient, 'case_type', p_payload->>'case_type'));

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.create_lab_case_guarded(jsonb) from public;
revoke all on function public.create_lab_case_guarded(jsonb) from anon;
grant execute on function public.create_lab_case_guarded(jsonb) to authenticated;

comment on function public.create_lab_case_guarded(jsonb) is
  'Creates a lab case with dental_chart.write + org/branch checks and audit.';
