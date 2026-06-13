-- Module 05: Patient documents

create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size >= 0),
  storage_path text not null,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_documents_patient
  on public.patient_documents(patient_id, created_at desc);

alter table public.patient_documents enable row level security;

create policy patient_documents_select on public.patient_documents
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

create policy patient_documents_insert on public.patient_documents
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

create policy patient_documents_delete on public.patient_documents
  for delete to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

create policy patient_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy patient_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy patient_documents_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create or replace function public.register_patient_document(
  p_patient_id uuid,
  p_branch_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_storage_path text,
  p_notes text default null
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
    file_size, storage_path, notes, uploaded_by
  ) values (
    v_patient.organization_id, p_branch_id, p_patient_id, p_file_name, p_file_type,
    p_file_size, p_storage_path, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.register_patient_document(uuid, uuid, text, text, bigint, text, text) to authenticated;
