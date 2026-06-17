-- =============================================================================
-- dentQL CONSENT E2E MASTER (Portal + Kiosk + Staff + Check-in Gate)
-- Tek dosya, idempotent, Supabase SQL Editor'da A'dan Z'ye çalıştırılabilir.
-- =============================================================================

-- 0) Safety: needed for token generation
create extension if not exists pgcrypto;

-- 1) Consent signing token channel seti (portal dahil)
alter table public.consent_signing_tokens
  drop constraint if exists consent_signing_tokens_channel_check;

alter table public.consent_signing_tokens
  add constraint consent_signing_tokens_channel_check
  check (channel in ('kiosk', 'sms', 'email', 'qr', 'portal'));

-- 2) Check-in gate helper (UI ile uyumlu)
create or replace function public._pending_intake_consent_count(
  p_patient_id uuid,
  p_org uuid
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.patient_consents pc
  where pc.patient_id = p_patient_id
    and pc.organization_id = p_org
    and pc.status = 'pending'
    and pc.template_slug in ('general-treatment', 'dpa-consent');
$$;

-- 3) Missing intake consent kayıtlarını otomatik oluştur (pending)
create or replace function public._ensure_intake_consents_for_patient(
  p_patient_id uuid,
  p_org_id uuid,
  p_branch_id uuid,
  p_source text default 'appointment'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if p_patient_id is null or p_org_id is null then
    raise exception 'patient_id and organization_id are required';
  end if;

  foreach v_slug in array array['general-treatment', 'dpa-consent']
  loop
    if not exists (
      select 1
      from public.patient_consents pc
      where pc.patient_id = p_patient_id
        and pc.organization_id = p_org_id
        and pc.template_slug = v_slug
        and pc.status in ('pending', 'signed')
    ) then
      insert into public.patient_consents (
        organization_id, branch_id, patient_id, template_slug, template_name, status, source
      )
      select
        p_org_id,
        p_branch_id,
        p_patient_id,
        ct.slug,
        ct.name,
        'pending',
        coalesce(nullif(trim(p_source), ''), 'appointment')
      from public.consent_templates ct
      where ct.slug = v_slug
        and ct.is_active = true
        and (ct.organization_id = p_org_id or ct.organization_id is null)
      order by ct.organization_id nulls last
      limit 1;
    end if;
  end loop;
end;
$$;

-- 4) Portal/Kiosk kimlik doğrulama helper (read-only, STABLE)
create or replace function public._portal_resolve_patient(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_phone_norm text;
  v_patient_id uuid;
begin
  select * into v_session
  from public.kiosk_sessions
  where id = p_session_id;

  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'Patient not found';
  end if;

  return v_patient_id;
end;
$$;

-- Branch link writes (VOLATILE — never call from STABLE functions)
create or replace function public._portal_ensure_branch_link(
  p_patient_id uuid,
  p_branch_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_patient_id is null or p_branch_id is null then
    return;
  end if;

  insert into public.patient_branch_links (patient_id, branch_id)
  values (p_patient_id, p_branch_id)
  on conflict (patient_id, branch_id) do nothing;
end;
$$;

-- 5) Portal: consent token üretmeden önce pending consent garantile
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

  select * into v_session
  from public.kiosk_sessions
  where id = p_session_id;

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

  v_token := encode(gen_random_bytes(24), 'hex');

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

-- 6) Kiosk: consent token üretimi (ayrı RPC)
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

  select * into v_session
  from public.kiosk_sessions
  where id = p_session_id;

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

  v_token := encode(gen_random_bytes(24), 'hex');

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

-- 7) Portal appointment: randevu sonrası intake consent seed
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time,
  p_purpose text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
  v_purpose text;
begin
  select * into v_session
  from public.kiosk_sessions
  where id = p_session_id;

  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  if p_provider_id is null then
    raise exception 'Please select a provider';
  end if;

  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;
  v_purpose := nullif(trim(coalesce(p_purpose, '')), '');

  perform public._assert_provider_slot_available(v_session.branch_id, p_provider_id, v_scheduled_at);

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, status, booking_source
  ) values (
    v_session.organization_id,
    v_session.branch_id,
    v_patient_id,
    p_provider_id,
    v_scheduled_at,
    30,
    coalesce(v_purpose, 'Online booking'),
    'scheduled',
    'portal'
  )
  returning id into v_appointment_id;

  perform public._ensure_intake_consents_for_patient(
    v_patient_id,
    v_session.organization_id,
    v_session.branch_id,
    'portal'
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_session.organization_id, v_session.branch_id, null,
    'appointment.create', 'appointment', v_appointment_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'booking_source', 'portal',
      'scheduled_at', v_scheduled_at
    )
  );

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'consent_seeded', true
  );
end;
$$;

-- 8) Staff appointment: randevu sonrası intake consent seed
create or replace function public.create_appointment_validated(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_provider_id uuid := nullif(p_payload->>'provider_id', '')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_scheduled_at timestamptz := (p_payload->>'scheduled_at')::timestamptz;
  v_purpose text := nullif(trim(p_payload->>'purpose'), '');
  v_duration integer := coalesce((p_payload->>'duration_minutes')::integer, 30);
  v_booking_source text := coalesce(nullif(p_payload->>'booking_source', ''), 'staff');
  v_force_billing boolean := coalesce((p_payload->>'force_billing_override')::boolean, false);
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null or v_org_id is null or v_scheduled_at is null then
    raise exception 'branch_id, patient_id, organization_id, and scheduled_at are required';
  end if;

  if v_booking_source not in ('staff', 'portal', 'kiosk', 'phone', 'walk_in') then
    raise exception 'Invalid booking_source';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(v_patient_id, v_branch_id, v_force_billing, 'appointment_book');

  if not exists (
    select 1 from public.patients p
    where p.id = v_patient_id and p.organization_id = v_org_id
  ) then
    raise exception 'Patient not found';
  end if;

  perform public._assert_provider_slot_available(v_branch_id, v_provider_id, v_scheduled_at);

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, status, booking_source, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_provider_id,
    v_scheduled_at, v_duration, v_purpose, 'scheduled', v_booking_source, auth.uid()
  )
  returning id into v_id;

  perform public._ensure_intake_consents_for_patient(
    v_patient_id,
    v_org_id,
    v_branch_id,
    v_booking_source
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'appointment.create', 'appointment', v_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'scheduled_at', v_scheduled_at,
      'booking_source', v_booking_source
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'status', 'scheduled',
    'scheduled_at', v_scheduled_at,
    'booking_source', v_booking_source,
    'consent_seeded', true
  );
end;
$$;

-- 9) Grants
grant execute on function public._pending_intake_consent_count(uuid, uuid) to authenticated;
grant execute on function public._ensure_intake_consents_for_patient(uuid, uuid, uuid, text) to authenticated;
grant execute on function public._portal_resolve_patient(uuid, text, text) to anon, authenticated;
grant execute on function public._portal_ensure_branch_link(uuid, uuid) to anon, authenticated;
grant execute on function public.create_portal_consent_sign_token(uuid, text, text, text) to anon, authenticated;
grant execute on function public.create_kiosk_consent_sign_token(uuid, text, text, text) to anon, authenticated;
grant execute on function public.submit_portal_appointment(uuid, text, text, uuid, date, time, text) to anon, authenticated;
grant execute on function public.create_appointment_validated(jsonb) to authenticated;

-- 10) Verification output
select
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '_pending_intake_consent_count') as has_pending_intake_counter,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '_ensure_intake_consents_for_patient') as has_seed_helper,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_portal_consent_sign_token') as has_portal_token_rpc,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_kiosk_consent_sign_token') as has_kiosk_token_rpc,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'submit_portal_appointment') as has_portal_booking_rpc,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_appointment_validated') as has_staff_booking_rpc;
