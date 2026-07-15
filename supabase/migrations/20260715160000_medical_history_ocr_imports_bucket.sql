-- Medical history OCR imports: private storage bucket for staff-uploaded form scans.
-- Path: {organization_id}/{branch_id}/{patient_id}/{uuid}.ext

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-history-imports',
  'medical-history-imports',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists medical_history_imports_storage_select on storage.objects;
create policy medical_history_imports_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-history-imports'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists medical_history_imports_storage_insert on storage.objects;
create policy medical_history_imports_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-history-imports'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists medical_history_imports_storage_update on storage.objects;
create policy medical_history_imports_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'medical-history-imports'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  )
  with check (
    bucket_id = 'medical-history-imports'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists medical_history_imports_storage_delete on storage.objects;
create policy medical_history_imports_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-history-imports'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );
