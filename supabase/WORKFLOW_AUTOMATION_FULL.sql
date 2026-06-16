-- =============================================================================
-- WORKFLOW AUTOMATION — FULL APPLY SCRIPT (Phase A + Phase B)
-- =============================================================================
-- Run in Supabase SQL Editor as a single script.
--
-- PREREQUISITES (must already exist in your database):
--   - patient_encounters module: 20260616200000_patient_encounters.sql
--   - queue / billing / workflow base migrations through 20260616170000
--
-- SAFE TO RE-RUN: all statements use CREATE OR REPLACE / IF NOT EXISTS patterns.
-- ORDER: Phase A first, then Phase B (B extends defaults and replaces RPCs).
-- =============================================================================

-- ===== PHASE A =====
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

-- Branch-scoped no-show for staff UI (queue page refresh) â€” no extra cron
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


-- ===== PHASE B =====
-- Phase B workflow automation: SOAP draft on chair, servedâ†’invoice, paymentâ†’close encounter, EOD open visits KPI

-- ---------------------------------------------------------------------------
-- Workflow defaults (extends phase A)
-- ---------------------------------------------------------------------------
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
    'auto_close_encounter_on_payment', true
  );
$$;

-- ---------------------------------------------------------------------------
-- Internal encounter close (automation â€” no extra permission gate)
-- ---------------------------------------------------------------------------
create or replace function public._close_encounter_automation(p_encounter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
begin
  if p_encounter_id is null then
    return false;
  end if;

  select * into v_enc
  from public.patient_encounters
  where id = p_encounter_id
    and organization_id = public.current_user_org_id();

  if v_enc.id is null or v_enc.status <> 'open' then
    return false;
  end if;

  update public.patient_encounters
  set status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      updated_at = now()
  where id = p_encounter_id;

  perform public.emit_workflow_event(
    v_enc.branch_id, 'encounter.closed', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_enc.patient_id, 'automation', true)
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_enc.organization_id, v_enc.branch_id, auth.uid(),
    'encounter.auto_close', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_enc.patient_id)
  );

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Draft SOAP when patient moves to chair (optional carry-forward text)
-- ---------------------------------------------------------------------------
create or replace function public._maybe_draft_soap_for_encounter(p_encounter_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
  v_note_id uuid;
  v_prev record;
begin
  if p_encounter_id is null then
    return null;
  end if;

  select * into v_enc
  from public.patient_encounters
  where id = p_encounter_id
    and organization_id = public.current_user_org_id()
    and status = 'open';

  if v_enc.id is null then
    return null;
  end if;

  if not public._workflow_enabled(v_enc.branch_id, 'auto_draft_soap_on_chair') then
    return null;
  end if;

  if exists (
    select 1 from public.clinical_notes cn
    where cn.encounter_id = p_encounter_id
  ) then
    return null;
  end if;

  select cn.subjective, cn.objective, cn.assessment, cn.plan
  into v_prev
  from public.clinical_notes cn
  join public.patient_encounters pe on pe.id = cn.encounter_id
  where pe.patient_id = v_enc.patient_id
    and pe.branch_id = v_enc.branch_id
    and pe.status = 'closed'
    and cn.status = 'signed'
  order by cn.signed_at desc nulls last, cn.created_at desc
  limit 1;

  insert into public.clinical_notes (
    patient_id, organization_id, branch_id, appointment_id, encounter_id,
    title, subjective, objective, assessment, plan, status, created_by, updated_by
  ) values (
    v_enc.patient_id, v_enc.organization_id, v_enc.branch_id, v_enc.appointment_id, v_enc.id,
    'Chair visit draft',
    v_prev.subjective,
    v_prev.objective,
    v_prev.assessment,
    v_prev.plan,
    'draft',
    auth.uid(),
    auth.uid()
  )
  returning id into v_note_id;

  perform public.emit_workflow_event(
    v_enc.branch_id, 'clinical_note.draft_created', 'clinical_note', v_note_id::text,
    jsonb_build_object(
      'patient_id', v_enc.patient_id,
      'encounter_id', p_encounter_id,
      'carried_forward', v_prev.subjective is not null
    )
  );

  return v_note_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoice draft when queue entry marked served (approved plan on encounter)
-- ---------------------------------------------------------------------------
create or replace function public._maybe_invoice_from_served_encounter(p_encounter_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
  v_plan_id uuid;
  v_invoice_id uuid;
begin
  if p_encounter_id is null then
    return null;
  end if;

  select * into v_enc
  from public.patient_encounters
  where id = p_encounter_id
    and organization_id = public.current_user_org_id();

  if v_enc.id is null then
    return null;
  end if;

  if not public._workflow_enabled(v_enc.branch_id, 'auto_served_creates_invoice') then
    return null;
  end if;

  if exists (
    select 1 from public.invoices inv
    where inv.encounter_id = p_encounter_id
      and inv.status <> 'void'
  ) then
    return null;
  end if;

  select tp.id into v_plan_id
  from public.treatment_plans tp
  where tp.encounter_id = p_encounter_id
    and tp.status = 'approved'
  order by tp.approved_at desc nulls last, tp.created_at desc
  limit 1;

  if v_plan_id is null then
    return null;
  end if;

  v_invoice_id := public._create_invoice_draft_from_plan(v_plan_id);

  update public.invoices
  set encounter_id = p_encounter_id, updated_at = now()
  where id = v_invoice_id
    and encounter_id is null;

  perform public.emit_workflow_event(
    v_enc.branch_id, 'invoice.auto_from_served', 'invoice', v_invoice_id::text,
    jsonb_build_object(
      'patient_id', v_enc.patient_id,
      'encounter_id', p_encounter_id,
      'treatment_plan_id', v_plan_id
    )
  );

  return v_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoice draft: persist encounter_id from plan
-- ---------------------------------------------------------------------------
create or replace function public._create_invoice_draft_from_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_existing uuid;
  v_invoice_id uuid;
  v_item record;
  v_inv_num text;
begin
  select * into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id();

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  select id into v_existing
  from public.invoices
  where treatment_plan_id = p_plan_id
    and status <> 'void'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_inv_num := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.invoices (
    organization_id, branch_id, patient_id, treatment_plan_id, encounter_id,
    invoice_number, total_amount, paid_amount, status, created_by
  ) values (
    v_plan.organization_id, v_plan.branch_id, v_plan.patient_id, p_plan_id, v_plan.encounter_id,
    v_inv_num, 0, 0, 'draft', auth.uid()
  )
  returning id into v_invoice_id;

  for v_item in
    select * from public.treatment_plan_items where plan_id = p_plan_id order by created_at
  loop
    perform public.add_invoice_line_item(
      v_invoice_id,
      coalesce(v_item.description, 'Treatment item'),
      coalesce(v_item.estimated_price, 0),
      1::numeric,
      v_item.tooth_number,
      v_item.procedure_id,
      v_item.id,
      0::numeric
    );
  end loop;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'invoice.auto_draft_from_plan',
    'invoice',
    v_invoice_id::text,
    jsonb_build_object('treatment_plan_id', p_plan_id, 'encounter_id', v_plan.encounter_id)
  );

  return v_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue status: chair SOAP + served invoice automation hints
-- ---------------------------------------------------------------------------
create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_in_chair_at timestamptz;
  v_completed_at timestamptz;
  v_called_at timestamptz;
  v_chair_label text;
  v_backward boolean := false;
  v_soap_draft_id uuid;
  v_invoice_draft_id uuid;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    raise exception 'Queue entry not found';
  end if;

  if not public.has_permission('queue.manage', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status not in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  if p_status = v_entry.status and p_chair_label is null then
    return jsonb_build_object('id', p_entry_id, 'status', p_status);
  end if;

  v_in_chair_at := v_entry.in_chair_at;
  v_completed_at := v_entry.completed_at;
  v_called_at := v_entry.called_at;
  v_chair_label := coalesce(p_chair_label, v_entry.chair_label);

  v_backward := (
    (v_entry.status = 'in_chair' and p_status in ('now_serving', 'ready', 'waiting'))
    or (v_entry.status = 'now_serving' and p_status in ('ready', 'waiting'))
    or (v_entry.status = 'ready' and p_status = 'waiting')
    or (v_entry.status = 'served' and p_status in ('in_chair', 'now_serving', 'ready', 'waiting'))
  );

  if p_status = 'in_chair' and v_entry.status is distinct from 'in_chair' then
    v_in_chair_at := now();
  elsif p_status in ('waiting', 'ready', 'now_serving') and v_entry.status = 'in_chair' then
    v_in_chair_at := null;
    if p_status in ('waiting', 'ready') then
      v_chair_label := null;
    end if;
  end if;

  if p_status = 'now_serving' then
    v_called_at := now();
  elsif p_status in ('waiting', 'ready') and v_entry.status in ('now_serving', 'in_chair') then
    v_called_at := null;
  end if;

  if p_status = 'served' and v_entry.status is distinct from 'served' then
    v_completed_at := now();
  elsif p_status in ('waiting', 'ready', 'now_serving', 'in_chair') and v_entry.status = 'served' then
    v_completed_at := null;
  end if;

  update public.queue_entries
  set status = p_status,
      chair_label = v_chair_label,
      called_at = v_called_at,
      in_chair_at = v_in_chair_at,
      completed_at = v_completed_at,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  if p_status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'completed', updated_at = now()
    where id = v_entry.appointment_id
      and status in ('checked_in', 'scheduled', 'confirmed');
  end if;

  if v_backward
    and v_entry.status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_entry.appointment_id
      and status = 'completed';
  end if;

  if p_status = 'in_chair' and v_entry.status is distinct from 'in_chair' and v_entry.encounter_id is not null then
    v_soap_draft_id := public._maybe_draft_soap_for_encounter(v_entry.encounter_id);
  end if;

  if p_status = 'served' and v_entry.status is distinct from 'served' and v_entry.encounter_id is not null then
    v_invoice_draft_id := public._maybe_invoice_from_served_encounter(v_entry.encounter_id);
  end if;

  perform public.emit_workflow_event(
    v_entry.branch_id, 'queue.status_changed', 'queue_entry', p_entry_id::text,
    jsonb_build_object(
      'status', p_status,
      'previous_status', v_entry.status,
      'backward', v_backward,
      'appointment_id', v_entry.appointment_id,
      'soap_draft_id', v_soap_draft_id,
      'invoice_draft_id', v_invoice_draft_id
    )
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_entry.organization_id, v_entry.branch_id, auth.uid(),
    case when v_backward then 'queue.status_revert' else 'queue.status_change' end,
    'queue_entry', p_entry_id::text,
    jsonb_build_object(
      'previous_status', v_entry.status,
      'new_status', p_status,
      'patient_id', v_entry.patient_id,
      'display_code', v_entry.display_code,
      'backward', v_backward
    )
  );

  return jsonb_build_object(
    'id', p_entry_id,
    'status', p_status,
    'backward', v_backward,
    'soap_draft_id', v_soap_draft_id,
    'invoice_draft_id', v_invoice_draft_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment: auto-close encounter when invoice fully paid
-- ---------------------------------------------------------------------------
create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_new_paid numeric;
  v_new_status text;
  v_org uuid := public.current_user_org_id();
  v_encounter_closed boolean := false;
begin
  select * into v_inv from public.invoices
  where id = p_invoice_id and organization_id = v_org;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  v_new_paid := coalesce(v_inv.paid_amount, 0) + p_amount;

  if v_new_paid >= v_inv.total_amount then
    v_new_status := 'paid';
    v_new_paid := v_inv.total_amount;
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := v_inv.status;
  end if;

  insert into public.invoice_payments (invoice_id, organization_id, amount, payment_method, notes, recorded_by)
  values (p_invoice_id, v_org, p_amount, p_payment_method, p_notes, auth.uid());

  update public.invoices
  set paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  where id = p_invoice_id;

  if v_new_status = 'paid'
    and v_inv.encounter_id is not null
    and public._workflow_enabled(v_inv.branch_id, 'auto_close_encounter_on_payment') then
    v_encounter_closed := public._close_encounter_automation(v_inv.encounter_id);
  end if;

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'status', v_new_status,
    'balance', v_inv.total_amount - v_new_paid,
    'encounter_closed', v_encounter_closed
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard: stale open encounters (prior days â€” EOD leak warning)
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_stats(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_patients bigint;
  v_today_appts bigint;
  v_pending_consents bigint;
  v_queue_waiting bigint;
  v_waitlist_waiting bigint;
  v_open_invoices bigint;
  v_overdue_invoices bigint;
  v_today_collected numeric;
  v_low_stock bigint;
  v_missing_notes bigint;
  v_hmo_draft bigint;
  v_philhealth_pending bigint;
  v_pending_intake_drafts bigint;
  v_appointments_awaiting_checkin bigint;
  v_open_encounters_stale bigint;
begin
  select count(*) into v_patients
  from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts
  from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
    and a.status in ('scheduled', 'confirmed', 'checked_in');

  select count(*) into v_pending_consents
  from public.patient_consents pc
  where pc.organization_id = v_org
    and pc.status = 'pending'
    and (p_branch_id is null or pc.branch_id = p_branch_id);

  select count(*) into v_queue_waiting
  from public.queue_entries qe
  where qe.organization_id = v_org
    and (p_branch_id is null or qe.branch_id = p_branch_id)
    and qe.status in ('waiting', 'ready');

  select count(*) into v_waitlist_waiting
  from public.waitlist_entries we
  where we.organization_id = v_org
    and (p_branch_id is null or we.branch_id = p_branch_id)
    and we.status = 'waiting';

  select count(*) into v_open_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('draft', 'sent', 'partial');

  select count(*) into v_overdue_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('sent', 'partial')
    and inv.due_date is not null
    and inv.due_date < current_date
    and (inv.total_amount - inv.paid_amount) > 0;

  select coalesce(sum(ip.amount), 0) into v_today_collected
  from public.invoice_payments ip
  join public.invoices inv on inv.id = ip.invoice_id
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and ip.created_at::date = current_date;

  if p_branch_id is not null then
    select count(*) into v_low_stock
    from public.inventory_items i
    where i.branch_id = p_branch_id
      and i.organization_id = v_org
      and i.is_active = true
      and (
        i.quantity_on_hand <= i.min_stock_level
        or (i.expiry_date is not null and i.expiry_date < current_date)
      );

    select count(*) into v_missing_notes
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and a.status = 'completed'
      and (a.scheduled_at at time zone 'Asia/Manila')::date >= (now() at time zone 'Asia/Manila')::date - 7
      and not exists (
        select 1 from public.clinical_notes cn
        where cn.patient_id = a.patient_id
          and cn.branch_id = a.branch_id
          and cn.status = 'signed'
          and (cn.appointment_id = a.id or cn.signed_at::date = (a.scheduled_at at time zone 'Asia/Manila')::date)
      );

    select count(*) into v_pending_intake_drafts
    from public.patient_intakes pi
    where pi.organization_id = v_org
      and pi.branch_id = p_branch_id
      and pi.status = 'draft';

    select count(*) into v_appointments_awaiting_checkin
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status in ('scheduled', 'confirmed');

    select count(*) into v_open_encounters_stale
    from public.patient_encounters pe
    where pe.organization_id = v_org
      and pe.branch_id = p_branch_id
      and pe.status = 'open'
      and (pe.opened_at at time zone 'Asia/Manila')::date < (now() at time zone 'Asia/Manila')::date;
  else
    v_low_stock := 0;
    v_missing_notes := 0;
    v_pending_intake_drafts := 0;
    v_appointments_awaiting_checkin := 0;
    v_open_encounters_stale := 0;
  end if;

  select count(*) into v_hmo_draft
  from public.hmo_claims hc
  where hc.organization_id = v_org
    and (p_branch_id is null or hc.branch_id = p_branch_id)
    and hc.status = 'draft';

  select count(*) into v_philhealth_pending
  from public.philhealth_claims pc
  where pc.organization_id = v_org
    and (p_branch_id is null or pc.branch_id = p_branch_id)
    and pc.status in ('draft', 'checklist_incomplete', 'ready', 'sync_failed');

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents,
    'queue_waiting', v_queue_waiting,
    'waitlist_waiting', v_waitlist_waiting,
    'open_invoices', v_open_invoices,
    'overdue_invoices', v_overdue_invoices,
    'today_collected', v_today_collected,
    'low_stock_items', v_low_stock,
    'missing_clinical_notes', v_missing_notes,
    'hmo_draft_claims', v_hmo_draft,
    'philhealth_pending', v_philhealth_pending,
    'pending_intake_drafts', v_pending_intake_drafts,
    'appointments_awaiting_checkin', v_appointments_awaiting_checkin,
    'open_encounters_stale', v_open_encounters_stale
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (re-affirm after CREATE OR REPLACE)
-- ---------------------------------------------------------------------------
grant execute on function public.get_dashboard_stats(uuid) to authenticated;
grant execute on function public.update_queue_status(uuid, text, text) to authenticated;
grant execute on function public.record_invoice_payment(uuid, numeric, text, text) to authenticated;
grant execute on function public.check_in_appointment(uuid, boolean, boolean, uuid) to authenticated;
grant execute on function public.auto_mark_overdue_appointments_no_show(int) to service_role;
grant execute on function public.auto_no_show_for_branch(uuid, int) to authenticated;

