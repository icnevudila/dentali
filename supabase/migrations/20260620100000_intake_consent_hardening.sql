-- Void stale pending dpa-consent after DPA merge; map legacy portal/kiosk slug to active intake slugs.

update public.patient_consents pc
set
  status = 'voided',
  voided_at = coalesce(pc.voided_at, now()),
  void_reason = coalesce(
    nullif(trim(pc.void_reason), ''),
    'Superseded by merged general-treatment intake consent'
  )
where pc.template_slug = 'dpa-consent'
  and pc.status = 'pending'
  and (
    exists (
      select 1
      from public.patient_consents gt
      where gt.patient_id = pc.patient_id
        and gt.organization_id = pc.organization_id
        and gt.template_slug = 'general-treatment'
        and gt.status = 'signed'
    )
    or exists (
      select 1
      from public.consent_templates ct
      where ct.slug = 'dpa-consent'
        and ct.is_active = false
        and (ct.organization_id = pc.organization_id or ct.organization_id is null)
    )
  );

create or replace function public._resolve_portal_consent_slug(
  p_org_id uuid,
  p_template_slug text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := nullif(trim(p_template_slug), '');
  v_allowed text[];
begin
  if v_slug is null then
    return null;
  end if;

  if v_slug = 'dpa-consent' then
    v_slug := 'general-treatment';
  end if;

  v_allowed := public._intake_consent_slugs(p_org_id);
  if not (v_slug = any(v_allowed)) then
    return null;
  end if;

  return v_slug;
end;
$$;

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
  v_slug text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_slug := public._resolve_portal_consent_slug(v_session.organization_id, p_template_slug);
  if v_slug is null then
    raise exception 'This consent form is not required';
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
  v_slug text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_slug := public._resolve_portal_consent_slug(v_session.organization_id, p_template_slug);
  if v_slug is null then
    raise exception 'This consent form is not required';
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

grant execute on function public._resolve_portal_consent_slug(uuid, text) to anon, authenticated;
