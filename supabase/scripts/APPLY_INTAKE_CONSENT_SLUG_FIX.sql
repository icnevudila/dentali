-- Portal "Consent record could not be created" on dpa-consent Sign now:
-- DPA was merged into general-treatment; inactive dpa-consent template must not be required.
-- Paste entire file into Supabase SQL Editor and run once.

-- DPA merged into general-treatment (20260613180000): only require active intake templates.

create or replace function public._intake_consent_slugs(p_org_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with effective as (
    select distinct on (ct.slug) ct.slug
    from public.consent_templates ct
    where ct.slug in ('general-treatment', 'dpa-consent')
      and ct.is_active = true
      and (ct.organization_id = p_org_id or ct.organization_id is null)
    order by ct.slug, ct.organization_id nulls last
  )
  select coalesce(
    (select array_agg(e.slug order by e.slug) from effective e),
    array['general-treatment']::text[]
  );
$$;

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
    and pc.template_slug = any(public._intake_consent_slugs(p_org));
$$;

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
  v_slugs text[] := public._intake_consent_slugs(p_org_id);
begin
  if p_patient_id is null or p_org_id is null then
    raise exception 'patient_id and organization_id are required';
  end if;

  foreach v_slug in array v_slugs
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

create or replace function public.get_patient_portal_snapshot(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_patient record;
  v_queue record;
  v_ahead int := 0;
  v_balance numeric := 0;
  v_pending int;
  v_consents jsonb := '[]'::jsonb;
  v_slug text;
  v_consent record;
  v_slugs text[];
begin
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

  v_slugs := public._intake_consent_slugs(v_session.organization_id);

  select p.id, p.first_name, p.last_name
  into v_patient
  from public.patients p
  where p.id = v_patient_id;

  select qe.id, qe.display_code, qe.status, qe.checked_in_at
  into v_queue
  from public.queue_entries qe
  where qe.patient_id = v_patient_id
    and qe.branch_id = v_session.branch_id
    and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
    and qe.checked_in_at::date = (timezone('Asia/Manila', now()))::date
  order by qe.checked_in_at desc
  limit 1;

  if v_queue.id is not null and v_queue.status in ('waiting', 'ready') then
    select count(*)::int into v_ahead
    from public.queue_entries qe
    where qe.branch_id = v_session.branch_id
      and qe.status in ('waiting', 'ready')
      and qe.checked_in_at::date = (timezone('Asia/Manila', now()))::date
      and qe.checked_in_at < v_queue.checked_in_at;
  end if;

  select coalesce(sum(greatest(i.total_amount - i.paid_amount, 0)), 0) into v_balance
  from public.invoices i
  where i.patient_id = v_patient_id
    and i.organization_id = v_session.organization_id
    and i.status not in ('void', 'paid')
    and greatest(i.total_amount - i.paid_amount, 0) > 0;

  v_pending := public._pending_intake_consent_count(v_patient_id, v_session.organization_id);

  foreach v_slug in array v_slugs
  loop
    select pc.id, pc.template_slug, pc.template_name, pc.status
    into v_consent
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_session.organization_id
      and pc.template_slug = v_slug
      and pc.status <> 'voided'
    order by pc.created_at desc
    limit 1;

    v_consents := v_consents || jsonb_build_array(
      jsonb_build_object(
        'slug', v_slug,
        'name', coalesce(v_consent.template_name, v_slug),
        'status', coalesce(v_consent.status, 'not_started'),
        'consent_id', v_consent.id
      )
    );
  end loop;

  return jsonb_build_object(
    'patient_id', v_patient_id,
    'patient_name', trim(coalesce(v_patient.first_name, '') || ' ' || coalesce(v_patient.last_name, '')),
    'branch_id', v_session.branch_id,
    'queue', case
      when v_queue.id is null then null
      else jsonb_build_object(
        'entry_id', v_queue.id,
        'display_code', v_queue.display_code,
        'status', v_queue.status,
        'ahead_count', v_ahead
      )
    end,
    'balance', jsonb_build_object(
      'open_balance', v_balance,
      'has_balance', v_balance > 0
    ),
    'consents', v_consents,
    'pending_intake_consents', v_pending,
    'ready_for_checkin', v_pending = 0
  );
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
  v_slug text := nullif(trim(p_template_slug), '');
  v_slugs text[];
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_slugs := public._intake_consent_slugs(v_session.organization_id);

  if v_slug is null or not (v_slug = any(v_slugs)) then
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
  v_slug text := nullif(trim(p_template_slug), '');
  v_slugs text[];
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_slugs := public._intake_consent_slugs(v_session.organization_id);

  if v_slug is null or not (v_slug = any(v_slugs)) then
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

grant execute on function public._intake_consent_slugs(uuid) to anon, authenticated;
grant execute on function public.get_patient_portal_snapshot(uuid, text, text) to anon, authenticated;
grant execute on function public.create_portal_consent_sign_token(uuid, text, text, text) to anon, authenticated;
grant execute on function public.create_kiosk_consent_sign_token(uuid, text, text, text) to anon, authenticated;
