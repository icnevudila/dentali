-- Workflow controls completion: unified gates, checked_in status, audit, slot validation

-- ---------------------------------------------------------------------------
-- Shared: provider slot availability
-- ---------------------------------------------------------------------------
create or replace function public._assert_provider_slot_available(
  p_branch_id uuid,
  p_provider_id uuid,
  p_scheduled_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt_date date;
  v_appt_time time;
  v_slot_taken boolean;
begin
  if p_provider_id is null then
    return;
  end if;

  v_appt_date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_appt_time := (p_scheduled_at at time zone 'Asia/Manila')::time;

  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  if not exists (
    select 1 from public.provider_availability pa
    where pa.branch_id = p_branch_id
      and pa.provider_id = p_provider_id
      and pa.day_of_week = extract(dow from v_appt_date)::smallint
      and pa.is_available
      and v_appt_time >= pa.start_time
      and v_appt_time < pa.end_time
  ) then
    raise exception 'Provider is not available at this time';
  end if;

  select exists (
    select 1 from public.appointments a
    where a.branch_id = p_branch_id
      and coalesce(a.provider_id, p_provider_id) = p_provider_id
      and a.scheduled_at = p_scheduled_at
      and a.status not in ('cancelled', 'no_show')
  ) into v_slot_taken;

  if v_slot_taken then
    raise exception 'Time slot is already booked';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff appointment creation: audit trail
-- ---------------------------------------------------------------------------
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
    'booking_source', v_booking_source
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Walk-in check-in: checked_in + workflow event
-- ---------------------------------------------------------------------------
create or replace function public.check_in_patient(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_appointment_id uuid := nullif(p_payload->>'appointment_id', '')::uuid;
  v_notes text := nullif(p_payload->>'notes', '');
  v_force boolean := coalesce((p_payload->>'force_checkin')::boolean, false);
  v_force_billing boolean := coalesce((p_payload->>'force_billing_override')::boolean, false);
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
  v_pending_consents int;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if not public.has_permission('queue.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(
    v_patient_id,
    v_branch_id,
    v_force_billing,
    'check_in'
  );

  if public._workflow_enabled(v_branch_id, 'consent_gate_checkin') and not v_force then
    select count(*) into v_pending_consents
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_org
      and pc.status = 'pending';

    if v_pending_consents > 0 then
      raise exception 'Pending consents must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if v_force and public._workflow_enabled(v_branch_id, 'consent_gate_checkin') then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_patient_id::text,
      jsonb_build_object('pending_consents', v_pending_consents)
    );
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  if v_appointment_id is null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    select a.id into v_appointment_id
    from public.appointments a
    where a.branch_id = v_branch_id
      and a.patient_id = v_patient_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status in ('scheduled', 'confirmed')
    order by a.scheduled_at
    limit 1;
  end if;

  v_code := public._next_queue_display_code(v_branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_org, v_branch_id, v_patient_id, v_appointment_id,
    v_code, v_notes, auth.uid()
  )
  returning id into v_id;

  if v_appointment_id is not null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_branch_id, 'patient.checked_in', 'queue_entry', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'appointment_id', v_appointment_id, 'display_code', v_code)
  );

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'appointment_id', v_appointment_id,
    'status', 'waiting'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Appointment check-in: consent gate + checked_in + workflow event
-- ---------------------------------------------------------------------------
drop function if exists public.check_in_appointment(uuid, boolean);

create or replace function public.check_in_appointment(
  p_appointment_id uuid,
  p_force_billing_override boolean default false,
  p_force_checkin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_code text;
  v_queue_id uuid;
  v_pending_consents int;
begin
  select a.*
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment cannot be checked in';
  end if;

  if not public.has_permission('queue.manage', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(
    v_appt.patient_id,
    v_appt.branch_id,
    p_force_billing_override,
    'appointment_check_in'
  );

  if public._workflow_enabled(v_appt.branch_id, 'consent_gate_checkin') and not p_force_checkin then
    select count(*) into v_pending_consents
    from public.patient_consents pc
    where pc.patient_id = v_appt.patient_id
      and pc.organization_id = v_appt.organization_id
      and pc.status = 'pending';

    if v_pending_consents > 0 then
      raise exception 'Pending consents must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if p_force_checkin and public._workflow_enabled(v_appt.branch_id, 'consent_gate_checkin') then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_appt.organization_id, v_appt.branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_appt.patient_id::text,
      jsonb_build_object('appointment_id', v_appt.id, 'pending_consents', v_pending_consents)
    );
  end if;

  if exists (
    select 1 from public.queue_entries qe
    where qe.branch_id = v_appt.branch_id
      and qe.patient_id = v_appt.patient_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  v_code := public._next_queue_display_code(v_appt.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_appt.organization_id, v_appt.branch_id, v_appt.patient_id, v_appt.id,
    v_code, coalesce(v_appt.purpose, 'Appointment check-in'), auth.uid()
  )
  returning id into v_queue_id;

  update public.appointments
  set status = 'checked_in', updated_at = now()
  where id = v_appt.id
    and status in ('scheduled', 'confirmed');

  perform public.emit_workflow_event(
    v_appt.branch_id, 'patient.checked_in', 'queue_entry', v_queue_id::text,
    jsonb_build_object(
      'patient_id', v_appt.patient_id,
      'appointment_id', v_appt.id,
      'display_code', v_code
    )
  );

  return jsonb_build_object(
    'queue_id', v_queue_id,
    'display_code', v_code,
    'appointment_id', v_appt.id,
    'status', 'waiting'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Waitlist booking: validated creation + billing gate
-- ---------------------------------------------------------------------------
create or replace function public.book_waitlist_entry(
  p_entry_id uuid,
  p_scheduled_at timestamptz,
  p_purpose text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_appt_result jsonb;
  v_appt_id uuid;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be booked in status %', v_entry.status;
  end if;

  v_appt_result := public.create_appointment_validated(jsonb_build_object(
    'organization_id', v_entry.organization_id,
    'branch_id', v_entry.branch_id,
    'patient_id', v_entry.patient_id,
    'scheduled_at', p_scheduled_at,
    'purpose', coalesce(p_purpose, v_entry.notes),
    'booking_source', 'staff'
  ));

  v_appt_id := (v_appt_result->>'id')::uuid;

  update public.waitlist_entries
  set status = 'booked',
      appointment_id = v_appt_id,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('entry_id', p_entry_id, 'appointment_id', v_appt_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Portal booking: slot validation + audit (no staff billing gate for self-service)
-- ---------------------------------------------------------------------------
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
  select * into v_session from public.kiosk_sessions where id = p_session_id;
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

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Kiosk check-in: consent + billing block (no override — see front desk)
-- ---------------------------------------------------------------------------
create or replace function public.submit_kiosk_checkin(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_code text;
  v_entry_id uuid;
  v_phone_norm text;
  v_active_count int;
  v_pending_consents int;
  v_appointment_id uuid;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please check with the front desk.';
  end if;

  if public._workflow_enabled(v_session.branch_id, 'consent_gate_checkin') then
    select count(*) into v_pending_consents
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_session.organization_id
      and pc.status = 'pending';

    if v_pending_consents > 0 then
      raise exception 'Please see the front desk to sign required forms before check-in.';
    end if;
  end if;

  if public._workflow_enabled(v_session.branch_id, 'billing_gate_block_services') then
    perform public._assert_patient_billing_clear(
      v_patient_id,
      v_session.branch_id,
      false,
      'kiosk_check_in'
    );
  end if;

  select count(*) into v_active_count
  from public.queue_entries
  where branch_id = v_session.branch_id
    and patient_id = v_patient_id
    and status in ('waiting', 'ready', 'now_serving', 'in_chair')
    and cast(created_at at time zone 'Asia/Manila' as date) = cast(now() at time zone 'Asia/Manila' as date);

  if v_active_count > 0 then
    raise exception 'You are already checked in. Please wait to be called.';
  end if;

  if public._workflow_enabled(v_session.branch_id, 'auto_checkin_updates_appointment') then
    select a.id into v_appointment_id
    from public.appointments a
    where a.branch_id = v_session.branch_id
      and a.patient_id = v_patient_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status in ('scheduled', 'confirmed')
    order by a.scheduled_at
    limit 1;
  end if;

  v_code := public._next_queue_display_code(v_session.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id, display_code, notes
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, v_appointment_id, v_code, 'Kiosk check-in'
  )
  returning id into v_entry_id;

  if v_appointment_id is not null then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_session.organization_id, v_session.branch_id, null,
    'queue.kiosk_check_in', 'queue_entry', v_entry_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'display_code', v_code)
  );

  perform public.emit_workflow_event(
    v_session.branch_id, 'patient.checked_in', 'queue_entry', v_entry_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'display_code', v_code, 'source', 'kiosk')
  );

  return jsonb_build_object('entry_id', v_entry_id, 'display_code', v_code);
end;
$$;

grant execute on function public.check_in_appointment(uuid, boolean, boolean) to authenticated;
