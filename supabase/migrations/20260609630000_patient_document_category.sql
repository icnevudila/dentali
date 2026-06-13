-- Patient document category for registry uploads

alter table public.patient_documents
  add column if not exists category text not null default 'other'
    check (category in ('xray', 'id', 'referral', 'insurance', 'other'));

create or replace function public.register_patient_document(
  p_patient_id uuid,
  p_branch_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_storage_path text,
  p_notes text default null,
  p_category text default 'other'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_id uuid;
begin
  if p_category not in ('xray', 'id', 'referral', 'insurance', 'other') then
    raise exception 'Invalid document category';
  end if;

  select p.id, p.organization_id
  into v_patient
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_patient.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.has_permission('patients.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.patient_documents (
    organization_id, branch_id, patient_id, file_name, file_type,
    file_size, storage_path, notes, uploaded_by, category
  ) values (
    v_patient.organization_id, p_branch_id, p_patient_id, p_file_name, p_file_type,
    p_file_size, p_storage_path, p_notes, auth.uid(), p_category
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.register_patient_document(uuid, uuid, text, text, bigint, text, text, text) to authenticated;
