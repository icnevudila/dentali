-- Consent signed → workflow event (checklist / dashboard refresh hooks)

create or replace function public.lock_consent_via_signing_token(
  p_token text,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
  v_parsed jsonb;
  v_image text;
  v_patient_id uuid;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
  end if;

  select t.*, pc.id as cid, pc.patient_id, pc.status as cstatus, pc.organization_id, pc.branch_id, pc.template_slug
  into v_token
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
  for update of t, pc;

  if v_token.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  if v_token.cstatus <> 'pending' then
    raise exception 'Consent already signed or voided';
  end if;

  v_patient_id := v_token.patient_id;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = null,
    signature_data = p_signature_data,
    field_responses = p_field_responses,
    body_snapshot = p_body_snapshot
  where id = v_token.patient_consent_id;

  update public.consent_signing_tokens
  set used_at = now()
  where id = v_token.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_token.organization_id,
    v_token.branch_id,
    null,
    'consent.signed_via_token',
    'patient_consent',
    v_token.patient_consent_id::text,
    jsonb_build_object(
      'template_slug', v_token.template_slug,
      'channel', v_token.channel,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient')
    )
  );

  perform public.emit_workflow_event(
    v_token.branch_id,
    'consent.signed',
    'patient',
    v_patient_id::text,
    jsonb_build_object(
      'consent_id', v_token.patient_consent_id,
      'template_slug', v_token.template_slug,
      'channel', 'signing_token'
    )
  );
end;
$$;

create or replace function public.lock_signed_consent(
  p_consent_id uuid,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_parsed jsonb;
  v_image text;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
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

  if v_consent.status = 'signed' then
    raise exception 'Consent already signed';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is voided';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = auth.uid(),
    signature_data = p_signature_data,
    field_responses = coalesce(p_field_responses, field_responses),
    body_snapshot = coalesce(p_body_snapshot, body_snapshot)
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.signed',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient'),
      'captured_at', coalesce(v_parsed->>'capturedAt', now()::text)
    )
  );

  perform public.emit_workflow_event(
    v_consent.branch_id,
    'consent.signed',
    'patient',
    v_consent.patient_id::text,
    jsonb_build_object(
      'consent_id', p_consent_id,
      'template_slug', v_consent.template_slug,
      'channel', 'staff'
    )
  );
end;
$$;
