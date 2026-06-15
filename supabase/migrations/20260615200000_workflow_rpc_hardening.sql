-- Harden remaining workflow bypasses: appointment status, manual invoice, check-in permissions

create or replace function public._user_can_check_in(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('queue.manage', p_branch_id)
      or public.has_permission('appointments.write', p_branch_id);
$$;

-- Allow front desk (queue.manage) and schedulers (appointments.write) to check in
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

  if not public._user_can_check_in(v_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(
    v_patient_id, v_branch_id, v_force_billing, 'check_in'
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
  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment cannot be checked in';
  end if;

  if not public._user_can_check_in(v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(
    v_appt.patient_id, v_appt.branch_id, p_force_billing_override, 'appointment_check_in'
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

create or replace function public.update_appointment_status(
  p_appointment_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  if p_status not in ('completed', 'cancelled', 'confirmed') then
    raise exception 'Unsupported status transition: %', p_status;
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Appointment not found';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status = 'completed' and v_appt.status not in ('scheduled', 'confirmed', 'checked_in') then
    raise exception 'Cannot mark appointment as completed from status %', v_appt.status;
  end if;

  if p_status = 'cancelled' and v_appt.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Appointment cannot be cancelled';
  end if;

  if p_status = 'confirmed' and v_appt.status not in ('scheduled') then
    raise exception 'Only scheduled appointments can be confirmed';
  end if;

  update public.appointments
  set status = p_status, updated_at = now()
  where id = p_appointment_id;

  if p_status = 'cancelled' and public._workflow_enabled(v_appt.branch_id, 'auto_waitlist_on_slot_open') then
    insert into public.slot_notification_queue (
      organization_id, branch_id, slot_at, source_appointment_id
    ) values (
      v_appt.organization_id, v_appt.branch_id, v_appt.scheduled_at, p_appointment_id
    );
    perform public.emit_workflow_event(
      v_appt.branch_id, 'slot.opened', 'appointment', p_appointment_id::text,
      jsonb_build_object('slot_at', v_appt.scheduled_at, 'reason', 'cancelled')
    );
  end if;

  if p_status = 'completed' then
    perform public.emit_workflow_event(
      v_appt.branch_id, 'appointment.completed', 'appointment', p_appointment_id::text,
      jsonb_build_object('patient_id', v_appt.patient_id, 'scheduled_at', v_appt.scheduled_at)
    );
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id, v_appt.branch_id, auth.uid(),
    'appointment.status_change', 'appointment', p_appointment_id::text,
    jsonb_build_object(
      'previous_status', v_appt.status,
      'new_status', p_status,
      'patient_id', v_appt.patient_id,
      'scheduled_at', v_appt.scheduled_at
    )
  );

  return jsonb_build_object('id', p_appointment_id, 'status', p_status);
end;
$$;

create or replace function public.create_manual_invoice(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := coalesce((p_payload->>'organization_id')::uuid, public.current_user_org_id());
  v_total numeric(12,2) := (p_payload->>'total_amount')::numeric;
  v_due_date date := nullif(p_payload->>'due_date', '')::date;
  v_series text := coalesce(nullif(trim(p_payload->>'series'), ''), 'INV');
  v_invoice_number text := nullif(trim(p_payload->>'invoice_number'), '');
  v_description text := coalesce(nullif(trim(p_payload->>'description'), ''), 'Clinical services');
  v_invoice_id uuid;
  v_line_id uuid;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if v_total is null or v_total <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('billing.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_invoice_number is null then
    v_invoice_number := v_series || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;

  insert into public.invoices (
    organization_id, branch_id, patient_id,
    invoice_number, series, total_amount, status, due_date, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id,
    v_invoice_number, v_series, 0, 'sent', v_due_date, auth.uid()
  )
  returning id into v_invoice_id;

  v_line_id := public.add_invoice_line_item(
    v_invoice_id, v_description, v_total, 1, null, null, null
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'invoice.create_manual', 'invoice', v_invoice_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'invoice_number', v_invoice_number,
      'total_amount', v_total,
      'line_item_id', v_line_id
    )
  );

  return jsonb_build_object('id', v_invoice_id, 'invoice_number', v_invoice_number);
end;
$$;

grant execute on function public._user_can_check_in(uuid) to authenticated;
grant execute on function public.update_appointment_status(uuid, text) to authenticated;
grant execute on function public.create_manual_invoice(jsonb) to authenticated;

-- Appointment detail edits (provider, purpose, duration) with permission + audit
create or replace function public.update_appointment_details(
  p_appointment_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_purpose text;
  v_duration int;
begin
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Appointment not found';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_appt.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Cannot edit appointment in status %', v_appt.status;
  end if;

  if p_payload ? 'duration_minutes' then
    v_duration := nullif(p_payload->>'duration_minutes', '')::int;
    if v_duration is not null and v_duration < 5 then
      raise exception 'Duration must be at least 5 minutes';
    end if;
  end if;

  if p_payload ? 'purpose' then
    v_purpose := nullif(trim(p_payload->>'purpose'), '');
  end if;

  update public.appointments
  set
    provider_id = case
      when p_payload ? 'provider_id' then nullif(p_payload->>'provider_id', '')::uuid
      else provider_id
    end,
    purpose = case when p_payload ? 'purpose' then v_purpose else purpose end,
    duration_minutes = case
      when p_payload ? 'duration_minutes' then coalesce(v_duration, duration_minutes)
      else duration_minutes
    end,
    updated_at = now()
  where id = p_appointment_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id, v_appt.branch_id, auth.uid(),
    'appointment.details_update', 'appointment', p_appointment_id::text,
    p_payload
  );

  return jsonb_build_object('id', p_appointment_id);
end;
$$;

-- Waitlist create/cancel with audit (RLS already enforces appointments.write)
create or replace function public.create_waitlist_entry(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := coalesce((p_payload->>'organization_id')::uuid, public.current_user_org_id());
  v_urgency text := coalesce(nullif(trim(p_payload->>'urgency'), ''), 'normal');
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_urgency not in ('normal', 'urgent', 'high') then
    raise exception 'Invalid urgency: %', v_urgency;
  end if;

  insert into public.waitlist_entries (
    organization_id, branch_id, patient_id, urgency,
    preferred_date, preferred_time_start, preferred_time_end,
    notes, expires_at, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_urgency,
    nullif(p_payload->>'preferred_date', '')::date,
    nullif(p_payload->>'preferred_time_start', '')::time,
    nullif(p_payload->>'preferred_time_end', '')::time,
    nullif(trim(p_payload->>'notes'), ''),
    nullif(p_payload->>'expires_at', '')::timestamptz,
    auth.uid()
  )
  returning id into v_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'waitlist.create', 'waitlist_entry', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'urgency', v_urgency)
  );

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.cancel_waitlist_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if v_entry.organization_id <> public.current_user_org_id() then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be cancelled in status %', v_entry.status;
  end if;

  update public.waitlist_entries
  set status = 'cancelled', updated_by = auth.uid(), updated_at = now()
  where id = p_entry_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_entry.organization_id, v_entry.branch_id, auth.uid(),
    'waitlist.cancel', 'waitlist_entry', p_entry_id::text,
    jsonb_build_object('patient_id', v_entry.patient_id, 'previous_status', v_entry.status)
  );

  return jsonb_build_object('id', p_entry_id, 'status', 'cancelled');
end;
$$;

grant execute on function public.update_appointment_details(uuid, jsonb) to authenticated;
grant execute on function public.create_waitlist_entry(jsonb) to authenticated;
grant execute on function public.cancel_waitlist_entry(uuid) to authenticated;
