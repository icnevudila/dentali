-- Patient experience hub: portal snapshot, portal/kiosk consent signing, review SMS

-- Allow portal channel on consent signing tokens
alter table public.consent_signing_tokens drop constraint if exists consent_signing_tokens_channel_check;
alter table public.consent_signing_tokens add constraint consent_signing_tokens_channel_check
  check (channel in ('kiosk', 'sms', 'email', 'qr', 'portal'));

-- Workflow default: review SMS after served (opt-in)
create or replace function public._default_workflow_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true,
    'auto_hygiene_recall', true,
    'auto_owner_digest_sms', false,
    'auto_no_show_after_grace', true,
    'auto_draft_soap_on_chair', true,
    'auto_served_creates_invoice', true,
    'auto_close_encounter_on_payment', true,
    'auto_review_request_sms', false
  );
$$;

-- Resolve patient from portal/kiosk session + identity
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
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl
    on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
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

-- Portal status: queue position, balance, consent summary
create or replace function public.get_patient_portal_snapshot(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
stable
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
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_patient_id := public._portal_resolve_patient(p_session_id, p_phone, p_last_name);

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

  foreach v_slug in array array['general-treatment', 'dpa-consent']
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

grant execute on function public.get_patient_portal_snapshot(uuid, text, text) to anon, authenticated;

-- Create consent record if missing, then issue portal signing token
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

    insert into public.patient_consents (
      organization_id, branch_id, patient_id, template_slug, template_name, status, source
    )
    select
      v_session.organization_id,
      v_session.branch_id,
      v_patient_id,
      ct.slug,
      ct.name,
      'pending',
      'portal'
    from public.consent_templates ct
    where ct.slug = v_slug
      and ct.is_active = true
      and (ct.organization_id = v_session.organization_id or ct.organization_id is null)
    order by ct.organization_id nulls last
    limit 1
    returning id into v_consent_id;

    if v_consent_id is null then
      raise exception 'Consent template not found';
    end if;
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

grant execute on function public.create_portal_consent_sign_token(uuid, text, text, text) to anon, authenticated;

-- Review request SMS after served
insert into public.notification_templates (organization_id, template_key, name, channel, body)
select
  o.id,
  'google_review_request',
  'Google review request',
  'sms',
  'Hi {{patient_name}}, thank you for visiting {{clinic_name}}! If you had a great experience, we would appreciate a quick Google review: {{review_url}}'
from public.organizations o
where not exists (
  select 1 from public.notification_templates nt
  where nt.organization_id = o.id and nt.template_key = 'google_review_request'
);

create or replace function public.prepare_review_request_sms(p_queue_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_patient record;
  v_branch record;
  v_tpl record;
  v_review_url text;
  v_body text;
  v_phone text;
begin
  select * into v_entry from public.queue_entries where id = p_queue_entry_id;
  if v_entry.id is null then
    raise exception 'Queue entry not found';
  end if;

  if not public._workflow_enabled(v_entry.branch_id, 'auto_review_request_sms') then
    return jsonb_build_object('skipped', true, 'reason', 'workflow_disabled');
  end if;

  if v_entry.status <> 'served' then
    return jsonb_build_object('skipped', true, 'reason', 'not_served');
  end if;

  select p.id, p.first_name, p.last_name, p.phone
  into v_patient
  from public.patients p
  where p.id = v_entry.patient_id;

  v_phone := regexp_replace(coalesce(v_patient.phone, ''), '\D', '', 'g');
  if length(v_phone) < 10 then
    return jsonb_build_object('skipped', true, 'reason', 'no_phone');
  end if;

  if exists (
    select 1 from public.notification_logs nl
    where nl.patient_id = v_patient.id
      and nl.branch_id = v_entry.branch_id
      and nl.template_key = 'google_review_request'
      and nl.created_at > now() - interval '30 days'
      and nl.status in ('sent', 'queued', 'dry_run')
  ) then
    return jsonb_build_object('skipped', true, 'reason', 'recently_sent');
  end if;

  select b.name, b.organization_id into v_branch
  from public.branches b where b.id = v_entry.branch_id;

  select value into v_review_url
  from public.branch_settings
  where branch_id = v_entry.branch_id and key = 'google_review_url'
  limit 1;

  if coalesce(trim(v_review_url), '') = '' then
    v_review_url := 'https://g.page/r/review';
  end if;

  select nt.body into v_tpl
  from public.notification_templates nt
  where nt.organization_id = v_branch.organization_id
    and nt.template_key = 'google_review_request'
    and nt.is_active = true
    and nt.branch_id is null
  limit 1;

  v_body := public._render_notification_body(
    coalesce(v_tpl.body, 'Thank you for visiting {{clinic_name}}! Review us: {{review_url}}'),
    jsonb_build_object(
      'patient_name', trim(coalesce(v_patient.first_name, '') || ' ' || coalesce(v_patient.last_name, '')),
      'clinic_name', v_branch.name,
      'review_url', v_review_url
    )
  );

  return jsonb_build_object(
    'skipped', false,
    'phone', v_phone,
    'body', v_body,
    'patient_id', v_patient.id,
    'branch_id', v_entry.branch_id,
    'template_key', 'google_review_request'
  );
end;
$$;

grant execute on function public.prepare_review_request_sms(uuid) to authenticated;
