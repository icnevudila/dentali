-- Module 08: Signed consent PDF/HTML storage stub

alter table public.patient_consents
  add column if not exists signed_pdf_path text;

insert into storage.buckets (id, name, public)
values ('consent-documents', 'consent-documents', false)
on conflict (id) do nothing;

create policy consent_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy consent_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy consent_documents_storage_update on storage.objects
  for update to authenticated using (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create or replace function public.register_signed_consent_pdf(
  p_consent_id uuid,
  p_storage_path text,
  p_file_size bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
begin
  if p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception 'Storage path required';
  end if;

  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status <> 'signed' then
    raise exception 'Consent must be signed before storing export';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set signed_pdf_path = p_storage_path
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.pdf_stored',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'storage_path', p_storage_path,
      'file_size', coalesce(p_file_size, 0)
    )
  );

  return jsonb_build_object(
    'consent_id', p_consent_id,
    'signed_pdf_path', p_storage_path
  );
end;
$$;

grant execute on function public.register_signed_consent_pdf(uuid, text, bigint) to authenticated;
