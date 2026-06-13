-- Module 05: Merge patients stub

alter table public.patients
  add column if not exists merged_into_patient_id uuid references public.patients(id) on delete set null;

create index if not exists idx_patients_merged_into
  on public.patients(merged_into_patient_id)
  where merged_into_patient_id is not null;

create or replace function public.merge_patients(
  p_master_id uuid,
  p_duplicate_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_duplicate record;
begin
  if p_master_id = p_duplicate_id then
    raise exception 'Cannot merge patient into itself';
  end if;

  select *
  into v_master
  from public.patients
  where id = p_master_id
    and organization_id = public.current_user_org_id();

  select *
  into v_duplicate
  from public.patients
  where id = p_duplicate_id
    and organization_id = public.current_user_org_id();

  if v_master.id is null or v_duplicate.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Only org admins can merge patients';
  end if;

  if v_duplicate.status = 'archived' and v_duplicate.merged_into_patient_id is not null then
    raise exception 'Duplicate patient is already merged';
  end if;

  update public.patients
  set
    status = 'archived',
    merged_into_patient_id = p_master_id,
    updated_at = now()
  where id = p_duplicate_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_master.organization_id,
    null,
    auth.uid(),
    'patient.merged',
    'patient',
    p_duplicate_id::text,
    jsonb_build_object(
      'master_id', p_master_id,
      'master_name', v_master.first_name || ' ' || v_master.last_name,
      'duplicate_name', v_duplicate.first_name || ' ' || v_duplicate.last_name,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Duplicate merge')
    )
  );

  return jsonb_build_object(
    'master_id', p_master_id,
    'duplicate_id', p_duplicate_id,
    'status', 'archived'
  );
end;
$$;

grant execute on function public.merge_patients(uuid, uuid, text) to authenticated;
