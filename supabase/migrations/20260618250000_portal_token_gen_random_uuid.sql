-- Portal/kiosk consent tokens: gen_random_uuid() instead of pgcrypto gen_random_bytes.

create or replace function public.create_portal_consent_sign_token(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_template_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_consent_id uuid;
  v_token text;
  v_slug text := nullif(trim(p_template_slug), '');
begin
  if v_slug is null or v_slug not in ('general-treatment', 'dpa-consent') then
    raise exception 'Invalid consent form';
  end if;

  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_patient_id := public._portal_resolve_patient(p_session_id, p_phone, p_last_name);
  perform public._portal_ensure_branch_link(v_patient_id, v_session.branch_id);
  perform public._ensure_intake_consents_for_patient(
    v_patient_id,
    v_session.organization_id,
    v_session.branch_id,
    'portal'
  );

  select pc.id into v_consent_id
  from public.patient_consents pc
  where pc.patient_id = v_patient_id
    and pc.organization_id = v_session.organization_id
    and pc.template_slug = v_slug
    and pc.status = 'pending'
  order by pc.created_at desc
  limit 1;

  if v_consent_id is null then
    select pc.id into v_consent_id
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_session.organization_id
      and pc.template_slug = v_slug
      and pc.status = 'signed'
    limit 1;

    if v_consent_id is not null then
      return jsonb_build_object('already_signed', true, 'consent_id', v_consent_id);
    end if;

    raise exception 'Consent record could not be created';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    v_consent_id,
    v_token,
    'portal',
    now() + interval '2 hours',
    null
  );

  return jsonb_build_object(
    'token', v_token,
    'consent_id', v_consent_id,
    'expires_at', (now() + interval '2 hours')::text
  );
end;
$$;

create or replace function public.create_kiosk_consent_sign_token(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_template_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_consent_id uuid;
  v_token text;
  v_slug text := nullif(trim(p_template_slug), '');
begin
  if v_slug is null or v_slug not in ('general-treatment', 'dpa-consent') then
    raise exception 'Invalid consent form';
  end if;

  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_patient_id := public._portal_resolve_patient(p_session_id, p_phone, p_last_name);
  perform public._portal_ensure_branch_link(v_patient_id, v_session.branch_id);
  perform public._ensure_intake_consents_for_patient(
    v_patient_id,
    v_session.organization_id,
    v_session.branch_id,
    'kiosk'
  );

  select pc.id into v_consent_id
  from public.patient_consents pc
  where pc.patient_id = v_patient_id
    and pc.organization_id = v_session.organization_id
    and pc.template_slug = v_slug
    and pc.status = 'pending'
  order by pc.created_at desc
  limit 1;

  if v_consent_id is null then
    raise exception 'Consent record could not be created';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    v_consent_id,
    v_token,
    'kiosk',
    now() + interval '2 hours',
    null
  );

  return jsonb_build_object(
    'token', v_token,
    'consent_id', v_consent_id,
    'expires_at', (now() + interval '2 hours')::text
  );
end;
$$;
