-- Workflow gaps: validated staff booking, billing gate enforcement, unapprove plan, backfill invoices

-- ---------------------------------------------------------------------------
-- Workflow defaults: block services when billing gap (override with force flag)
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
    'billing_gate_block_services', true
  );
$$;

-- ---------------------------------------------------------------------------
-- Billing clearance (internal — no billing.read permission required)
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
  v_missing bigint := 0;
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
    raise exception 'Billing clearance required: collect outstanding balance or create missing plan invoice before proceeding. Use billing override to continue (logged).';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff appointment creation (validated slots + booking_source + billing gate)
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
  v_appt_date date;
  v_appt_time time;
  v_slot_taken boolean;
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

  if v_provider_id is not null then
    v_appt_date := (v_scheduled_at at time zone 'Asia/Manila')::date;
    v_appt_time := (v_scheduled_at at time zone 'Asia/Manila')::time;

    perform public.ensure_provider_availability_defaults(v_branch_id, v_provider_id);

    if not exists (
      select 1 from public.provider_availability pa
      where pa.branch_id = v_branch_id
        and pa.provider_id = v_provider_id
        and pa.day_of_week = extract(dow from v_appt_date)::smallint
        and pa.is_available
        and v_appt_time >= pa.start_time
        and v_appt_time < pa.end_time
    ) then
      raise exception 'Provider is not available at this time';
    end if;

    select exists (
      select 1 from public.appointments a
      where a.branch_id = v_branch_id
        and coalesce(a.provider_id, v_provider_id) = v_provider_id
        and a.scheduled_at = v_scheduled_at
        and a.status not in ('cancelled', 'no_show')
    ) into v_slot_taken;

    if v_slot_taken then
      raise exception 'Time slot is already booked';
    end if;
  end if;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, status, booking_source, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_provider_id,
    v_scheduled_at, v_duration, v_purpose, 'scheduled', v_booking_source, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'status', 'scheduled',
    'scheduled_at', v_scheduled_at,
    'booking_source', v_booking_source
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in billing gate
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
    set status = 'confirmed', updated_at = now()
    where id = v_appointment_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'appointment_id', v_appointment_id,
    'status', 'waiting'
  );
end;
$$;

-- Drop legacy single-arg overload so RPC resolves to (uuid, boolean)
drop function if exists public.check_in_appointment(uuid);

create or replace function public.check_in_appointment(
  p_appointment_id uuid,
  p_force_billing_override boolean default false
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
  set status = 'confirmed', updated_at = now()
  where id = v_appt.id;

  return jsonb_build_object(
    'queue_id', v_queue_id,
    'display_code', v_code,
    'appointment_id', v_appt.id,
    'status', 'waiting'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Unapprove treatment plan (revert to proposed; void unpaid draft invoice)
-- ---------------------------------------------------------------------------
create or replace function public.unapprove_treatment_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_inv record;
begin
  select * into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status not in ('approved', 'in_progress') then
    raise exception 'Only approved or in-progress plans can be unapproved';
  end if;

  select * into v_inv
  from public.invoices
  where treatment_plan_id = p_plan_id
    and status <> 'void'
  order by created_at desc
  limit 1;

  if v_inv.id is not null then
    if coalesce(v_inv.paid_amount, 0) > 0 then
      raise exception 'Cannot unapprove: invoice has payments. Adjust in Billing first.';
    end if;
    if v_inv.status = 'paid' then
      raise exception 'Cannot unapprove: invoice is already paid';
    end if;
    perform public.void_invoice(v_inv.id, 'Treatment plan unapproved');
  end if;

  update public.treatment_plans
  set status = 'proposed', approved_at = null, updated_at = now()
  where id = p_plan_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'treatment_plan.unapproved',
    'treatment_plan',
    p_plan_id::text,
    jsonb_build_object('voided_invoice_id', v_inv.id)
  );

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'status', 'proposed',
    'voided_invoice_id', v_inv.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill draft invoices for approved plans missing invoices
-- ---------------------------------------------------------------------------
create or replace function public.backfill_patient_plan_invoices(
  p_patient_id uuid default null,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_created int := 0;
  v_invoice_id uuid;
begin
  if p_branch_id is not null and not public.has_permission('billing.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  for v_plan in
    select tp.id, tp.branch_id
    from public.treatment_plans tp
    where tp.organization_id = public.current_user_org_id()
      and (p_patient_id is null or tp.patient_id = p_patient_id)
      and (p_branch_id is null or tp.branch_id = p_branch_id)
      and tp.status in ('approved', 'in_progress')
      and exists (
        select 1 from public.treatment_plan_items i
        where i.plan_id = tp.id and i.status <> 'cancelled'
      )
      and not exists (
        select 1 from public.invoices inv
        where inv.treatment_plan_id = tp.id and inv.status <> 'void'
      )
  loop
    if public.has_permission('billing.write', v_plan.branch_id) then
      v_invoice_id := public._create_invoice_draft_from_plan(v_plan.id);
      if v_invoice_id is not null then
        v_created := v_created + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('created', v_created);
end;
$$;

-- ---------------------------------------------------------------------------
-- Plan item guard: clearer message (unapprove to edit plan)
-- ---------------------------------------------------------------------------
create or replace function public.guard_treatment_plan_items_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select tp.status
  into v_status
  from public.treatment_plans tp
  where tp.id = coalesce(NEW.plan_id, OLD.plan_id);

  if v_status in ('approved', 'in_progress', 'completed') then
    raise exception 'Cannot modify items on an approved plan. Unapprove the plan to edit procedures, or update the linked invoice in Billing.';
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- Restrict line-item adds on paid invoices
create or replace function public.add_invoice_line_item(
  p_invoice_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1,
  p_tooth_number text default null,
  p_procedure_id uuid default null,
  p_treatment_plan_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_line_total numeric(12,2);
  v_id uuid;
  v_sort int;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status in ('void', 'paid') then
    raise exception 'Cannot add line items to a % invoice', v_inv.status;
  end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  v_line_total := round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0), 2);

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.invoice_line_items where invoice_id = p_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, organization_id, procedure_id, treatment_plan_item_id,
    description, tooth_number, quantity, unit_price, line_total, sort_order
  ) values (
    p_invoice_id, v_inv.organization_id, p_procedure_id, p_treatment_plan_item_id,
    p_description, p_tooth_number, coalesce(p_quantity, 1), coalesce(p_unit_price, 0),
    v_line_total, v_sort
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (must run after all function definitions)
-- ---------------------------------------------------------------------------
grant execute on function public.unapprove_treatment_plan(uuid) to authenticated;
grant execute on function public.backfill_patient_plan_invoices(uuid, uuid) to authenticated;
grant execute on function public.check_in_appointment(uuid, boolean) to authenticated;
grant execute on function public.create_appointment_validated(jsonb) to authenticated;
grant execute on function public.check_in_patient(jsonb) to authenticated;
