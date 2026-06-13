-- Module 07: Versioned medical history RPC

create or replace function public.create_medical_history_version(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_allergies jsonb := coalesce(p_payload->'allergies', '[]'::jsonb);
  v_medications jsonb := coalesce(p_payload->'medications', '[]'::jsonb);
  v_conditions jsonb := coalesce(p_payload->'conditions', '[]'::jsonb);
  v_notes text := nullif(trim(p_payload->>'notes'), '');
  v_branch_id uuid := nullif(p_payload->>'branch_id', '')::uuid;
  v_next_version integer;
  v_id uuid;
begin
  if v_patient_id is null or v_org_id is null then
    raise exception 'patient_id and organization_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = v_patient_id and p.organization_id = v_org_id
  ) then
    raise exception 'Patient not found';
  end if;

  if v_branch_id is not null then
    if not public.has_permission('patients.medical_history.write', v_branch_id) then
      raise exception 'Permission denied';
    end if;
  elsif not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  select coalesce(max(h.version), 0) + 1
  into v_next_version
  from public.patient_medical_histories h
  where h.patient_id = v_patient_id;

  insert into public.patient_medical_histories (
    patient_id, organization_id, version,
    allergies, medications, conditions, notes, created_by
  ) values (
    v_patient_id, v_org_id, v_next_version,
    v_allergies, v_medications, v_conditions, v_notes, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'patient_id', v_patient_id,
    'version', v_next_version,
    'risk', public.calculate_medical_risk_flags(v_patient_id)
  );
end;
$$;

grant execute on function public.create_medical_history_version(jsonb) to authenticated;
