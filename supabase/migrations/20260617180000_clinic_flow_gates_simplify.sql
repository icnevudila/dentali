-- Clinic flow simplification: intake-only consent gate at check-in, meaningful billing blocks.

-- ---------------------------------------------------------------------------
-- Intake consents only (DPA merged into general-treatment; keep legacy slug)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Billing gate: soft at check-in/booking, full at checkout and other contexts
-- ---------------------------------------------------------------------------
create or replace function public._assert_patient_billing_clear(
  p_patient_id uuid,
  p_branch_id uuid,
  p_force boolean default false,
  p_context text default 'service'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_invoice_open numeric := 0;
  v_ortho_open numeric := 0;
  v_overdue_open numeric := 0;
  v_missing bigint := 0;
  v_soft_context boolean := p_context in (
    'check_in', 'appointment_check_in', 'kiosk_check_in', 'appointment_book'
  );
  v_meaningful_threshold numeric := 5000;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if p_force then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    )
    select
      p.organization_id,
      p_branch_id,
      auth.uid(),
      'billing.gate_override',
      'patient',
      p_patient_id::text,
      jsonb_build_object('context', p_context)
    from public.patients p
    where p.id = p_patient_id;
    return;
  end if;

  if not public._workflow_enabled(p_branch_id, 'billing_gate_block_services') then
    return;
  end if;

  select p.organization_id into v_org
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_org is null then
    raise exception 'Patient not found';
  end if;

  select coalesce(sum(greatest(inv.total_amount - inv.paid_amount, 0)), 0)
  into v_invoice_open
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_org
    and inv.status <> 'void';

  select coalesce(sum(greatest(
    oc.contract_amount - coalesce((
      select sum(oa.payment_amount) from public.ortho_adjustments oa where oa.case_id = oc.id
    ), 0),
    0
  )), 0)
  into v_ortho_open
  from public.ortho_cases oc
  where oc.patient_id = p_patient_id
    and oc.organization_id = v_org
    and oc.status = 'active';

  if v_soft_context then
    select coalesce(sum(greatest(inv.total_amount - inv.paid_amount, 0)), 0)
    into v_overdue_open
    from public.invoices inv
    where inv.patient_id = p_patient_id
      and inv.organization_id = v_org
      and inv.status <> 'void'
      and inv.due_date is not null
      and inv.due_date < v_today
      and (inv.total_amount - inv.paid_amount) > 0;

    if v_overdue_open > 0 or (v_invoice_open + v_ortho_open) >= v_meaningful_threshold then
      raise exception
        'Billing clearance required: overdue balance or significant outstanding amount. Use billing override to continue (logged).';
    end if;
    return;
  end if;

  select count(*) into v_missing
  from public.treatment_plans tp
  where tp.patient_id = p_patient_id
    and tp.organization_id = v_org
    and tp.status in ('approved', 'in_progress')
    and exists (
      select 1 from public.treatment_plan_items i
      where i.plan_id = tp.id and i.status <> 'cancelled'
    )
    and not exists (
      select 1 from public.invoices inv
      where inv.treatment_plan_id = tp.id and inv.status <> 'void'
    );

  if v_missing > 0 or (v_invoice_open + v_ortho_open) > 0 then
    raise exception
      'Billing clearance required: collect outstanding balance or create missing plan invoice before proceeding. Use billing override to continue (logged).';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_patient: intake consent gate only
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
  v_pending_intake int;
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
    v_pending_intake := public._pending_intake_consent_count(v_patient_id, v_org);

    if v_pending_intake > 0 then
      raise exception
        'Intake consents (data privacy and general treatment) must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if v_force and public._workflow_enabled(v_branch_id, 'consent_gate_checkin') then
    v_pending_intake := public._pending_intake_consent_count(v_patient_id, v_org);
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_patient_id::text,
      jsonb_build_object('pending_intake_consents', v_pending_intake)
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
-- Kiosk: intake consents + soft billing only
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
  v_pending_intake int;
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
    v_pending_intake := public._pending_intake_consent_count(v_patient_id, v_session.organization_id);
    if v_pending_intake > 0 then
      raise exception 'Please see the front desk to sign intake forms before check-in.';
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

  perform public._open_patient_encounter(
    v_session.organization_id,
    v_session.branch_id,
    v_patient_id,
    v_appointment_id,
    v_entry_id,
    case when v_appointment_id is not null then 'appointment' else 'walk_in' end,
    v_code
  );

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
