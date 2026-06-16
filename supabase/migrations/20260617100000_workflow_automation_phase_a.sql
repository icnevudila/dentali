-- Phase A workflow automation: encounter reuse on check-in, auto no-show after grace period

-- ---------------------------------------------------------------------------
-- check_in_patient: optional reuse_encounter_id (continue open visit)
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
  v_reuse_encounter_id uuid := nullif(p_payload->>'reuse_encounter_id', '')::uuid;
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
  v_encounter_id uuid;
  v_pending_consents int;
  v_source text;
  v_reuse_enc public.patient_encounters%rowtype;
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
  v_source := case when v_appointment_id is not null then 'appointment' else 'walk_in' end;

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_org, v_branch_id, v_patient_id, v_appointment_id,
    v_code, v_notes, auth.uid()
  )
  returning id into v_id;

  if v_reuse_encounter_id is not null then
    select * into v_reuse_enc
    from public.patient_encounters pe
    where pe.id = v_reuse_encounter_id
      and pe.patient_id = v_patient_id
      and pe.branch_id = v_branch_id
      and pe.organization_id = v_org
      and pe.status = 'open';

    if v_reuse_enc.id is null then
      raise exception 'Open encounter not found for reuse';
    end if;

    v_encounter_id := v_reuse_enc.id;

    update public.queue_entries
    set encounter_id = v_encounter_id, updated_at = now()
    where id = v_id;

    if v_appointment_id is not null then
      update public.patient_encounters
      set appointment_id = coalesce(appointment_id, v_appointment_id),
          updated_at = now()
      where id = v_encounter_id;
    end if;

    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'encounter.reused_on_checkin', 'patient_encounter', v_encounter_id::text,
      jsonb_build_object('patient_id', v_patient_id, 'queue_entry_id', v_id)
    );
  else
    v_encounter_id := public._open_patient_encounter(
      v_org, v_branch_id, v_patient_id, v_appointment_id, v_id, v_source, v_code
    );
  end if;

  if v_appointment_id is not null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_branch_id, 'patient.checked_in', 'queue_entry', v_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'appointment_id', v_appointment_id,
      'display_code', v_code,
      'encounter_id', v_encounter_id,
      'reused_encounter', v_reuse_encounter_id is not null
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'appointment_id', v_appointment_id,
    'encounter_id', v_encounter_id,
    'status', 'waiting',
    'reused_encounter', v_reuse_encounter_id is not null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_appointment: optional reuse_encounter_id
-- ---------------------------------------------------------------------------
create or replace function public.check_in_appointment(
  p_appointment_id uuid,
  p_force_billing_override boolean default false,
  p_force_checkin boolean default false,
  p_reuse_encounter_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_payload jsonb;
  v_result jsonb;
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

  v_payload := jsonb_build_object(
    'branch_id', v_appt.branch_id,
    'patient_id', v_appt.patient_id,
    'appointment_id', v_appt.id,
    'notes', coalesce(v_appt.purpose, 'Appointment check-in'),
    'force_checkin', p_force_checkin,
    'force_billing_override', p_force_billing_override
  );

  if p_reuse_encounter_id is not null then
    v_payload := v_payload || jsonb_build_object('reuse_encounter_id', p_reuse_encounter_id);
  end if;

  v_result := public.check_in_patient(v_payload);

  return jsonb_build_object(
    'queue_id', v_result->>'id',
    'display_code', v_result->>'display_code',
    'encounter_id', v_result->>'encounter_id',
    'appointment_id', v_appt.id,
    'reused_encounter', coalesce((v_result->>'reused_encounter')::boolean, false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto no-show: scheduled/confirmed past grace with no check-in
-- ---------------------------------------------------------------------------
create or replace function public.auto_mark_overdue_appointments_no_show(
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_marked int := 0;
  v_skipped int := 0;
  v_cutoff timestamptz := now() - make_interval(mins => greatest(p_grace_minutes, 5));
begin
  for v_appt in
    select a.id, a.branch_id, a.organization_id, a.patient_id, a.scheduled_at
    from public.appointments a
    where a.status in ('scheduled', 'confirmed')
      and a.scheduled_at < v_cutoff
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and public._workflow_enabled(a.branch_id, 'auto_no_show_after_grace')
      and not exists (
        select 1 from public.queue_entries qe
        where qe.appointment_id = a.id
          and qe.status not in ('cancelled')
      )
  loop
    begin
      perform public.mark_appointment_no_show(v_appt.id);
      v_marked := v_marked + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('marked', v_marked, 'skipped', v_skipped, 'grace_minutes', p_grace_minutes);
end;
$$;

grant execute on function public.auto_mark_overdue_appointments_no_show(int) to service_role;
grant execute on function public.check_in_appointment(uuid, boolean, boolean, uuid) to authenticated;

-- Branch-scoped no-show for staff UI (queue page refresh) — no extra cron
create or replace function public.auto_no_show_for_branch(
  p_branch_id uuid,
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_marked int := 0;
  v_skipped int := 0;
  v_cutoff timestamptz := now() - make_interval(mins => greatest(p_grace_minutes, 5));
  v_org uuid := public.current_user_org_id();
begin
  if p_branch_id is null then
    raise exception 'branch_id is required';
  end if;

  if not public._user_can_check_in(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if not public._workflow_enabled(p_branch_id, 'auto_no_show_after_grace') then
    return jsonb_build_object('marked', 0, 'skipped', 0, 'grace_minutes', p_grace_minutes);
  end if;

  for v_appt in
    select a.id
    from public.appointments a
    where a.branch_id = p_branch_id
      and a.organization_id = v_org
      and a.status in ('scheduled', 'confirmed')
      and a.scheduled_at < v_cutoff
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and not exists (
        select 1 from public.queue_entries qe
        where qe.appointment_id = a.id
          and qe.status not in ('cancelled')
      )
  loop
    begin
      perform public.mark_appointment_no_show(v_appt.id);
      v_marked := v_marked + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('marked', v_marked, 'skipped', v_skipped, 'grace_minutes', p_grace_minutes);
end;
$$;

grant execute on function public.auto_no_show_for_branch(uuid, int) to authenticated;

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
    'auto_no_show_after_grace', true
  );
$$;

grant execute on function public.check_in_patient(jsonb) to authenticated;
grant execute on function public.check_in_appointment(uuid, boolean, boolean, uuid) to authenticated;
grant execute on function public.auto_mark_overdue_appointments_no_show(int) to service_role;
grant execute on function public.auto_no_show_for_branch(uuid, int) to authenticated;
