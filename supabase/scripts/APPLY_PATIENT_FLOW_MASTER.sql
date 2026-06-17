-- =============================================================================
-- dentQL — PATIENT FLOW MASTER SQL (tek paket, tekrar çalıştırılabilir)
-- =============================================================================
-- NEREYE: Supabase Dashboard → SQL Editor → tümünü yapıştır → Run
-- ÖN KOŞUL: Temel migration'lar (queue, appointments, encounters, closeout)
-- TEKRAR: Güvenli — CREATE OR REPLACE, IF NOT EXISTS, idempotent repair
--
-- Bu paket şunları yapar:
--   A) Veri onarımı (no_show, yetim checked_in)
--   B) Workflow varsayılanları (hasta akışı açık, otomatik no-show kapalı)
--   C) Geçmiş saate randevu engeli
--   D) Closeout: taslak kilitlemez, finalize kilitle
--   E) check_in_appointment: yetim checked_in otomatik onarım
--   F2) update_appointment_status: completed yalnızca Queue Served sonrası
--   G) update_queue_status: iptal → randevu confirmed, served → completed
--   G) Dashboard KPI anahtarları (UI ile uyumlu)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A) Veri onarımı
-- -----------------------------------------------------------------------------

-- Bugün yanlışlıkla no_show olan, kuyruğa hiç girmemiş randevular
update public.appointments a
set status = 'scheduled',
    updated_at = now()
where a.status = 'no_show'
  and not exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = a.id
      and qe.status <> 'cancelled'
  )
  and (
    (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
    or (
      a.created_at >= now() - interval '12 hours'
      and (a.scheduled_at at time zone 'Asia/Manila')::date >= (now() at time zone 'Asia/Manila')::date
    )
  );

-- Bugün checked_in ama aktif kuyrukta değil → confirmed (yeniden check-in)
update public.appointments a
set status = 'confirmed',
    updated_at = now()
where a.status = 'checked_in'
  and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  and not exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = a.id
      and qe.branch_id = a.branch_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  );

-- -----------------------------------------------------------------------------
-- B) Workflow varsayılanları — hasta akışı otomasyonu açık, no-show manuel
-- -----------------------------------------------------------------------------
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
    'auto_no_show_after_grace', false,
    'auto_draft_soap_on_chair', true,
    'auto_served_creates_invoice', true,
    'auto_close_encounter_on_payment', true,
    'billing_gate_block_services', true
  );
$$;

-- Mevcut şubeler: hasta akışı toggle'ları yoksa aç; no-show otomasyonunu kapat
do $$
begin
  if to_regclass('public.branch_workflow_settings') is not null then
    update public.branch_workflow_settings bws
    set settings = coalesce(bws.settings, '{}'::jsonb)
      || jsonb_build_object(
        'auto_checkin_updates_appointment',
          coalesce((bws.settings->>'auto_checkin_updates_appointment')::boolean, true),
        'auto_served_completes_appointment',
          coalesce((bws.settings->>'auto_served_completes_appointment')::boolean, true),
        'auto_served_creates_invoice',
          coalesce((bws.settings->>'auto_served_creates_invoice')::boolean, true),
        'auto_close_encounter_on_payment',
          coalesce((bws.settings->>'auto_close_encounter_on_payment')::boolean, true),
        'auto_draft_soap_on_chair',
          coalesce((bws.settings->>'auto_draft_soap_on_chair')::boolean, true),
        'auto_no_show_after_grace', false
      ),
      updated_at = now();
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- C) Geçmiş saate randevu engeli
-- -----------------------------------------------------------------------------
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

  if v_scheduled_at < now() - interval '1 minute' then
    raise exception 'Cannot book an appointment in the past. Use Patient arrival for patients already in clinic.';
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
    select 1
    from public.patients p
    where p.id = v_patient_id
      and p.organization_id = v_org_id
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

grant execute on function public.create_appointment_validated(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- D) Otomatik no-show kapalı (personel manuel işaretler)
-- -----------------------------------------------------------------------------
create or replace function public.auto_no_show_for_branch(
  p_branch_id uuid,
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_branch_id is null then
    raise exception 'branch_id is required';
  end if;

  if not public._user_can_check_in(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'marked', 0,
    'skipped', 0,
    'grace_minutes', p_grace_minutes,
    'disabled', true,
    'reason', 'No-show is manual only'
  );
end;
$$;

create or replace function public.auto_mark_overdue_appointments_no_show(
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'marked', 0,
    'skipped', 0,
    'grace_minutes', p_grace_minutes,
    'disabled', true,
    'reason', 'No-show is manual only'
  );
end;
$$;

grant execute on function public.auto_no_show_for_branch(uuid, int) to authenticated;
grant execute on function public.auto_mark_overdue_appointments_no_show(int) to service_role;

-- -----------------------------------------------------------------------------
-- E) Closeout — taslak kilitlemez, finalize kilitle
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.closeout_snapshots') is not null then
    alter table public.closeout_snapshots
      add column if not exists finalized boolean not null default false;
  end if;
end $$;

create or replace function public.check_closeout_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_branch_id uuid;
  v_org_id uuid;
begin
  if coalesce(current_setting('app.bypass_closeout_lock', true), '') = 'true' then
    if TG_OP = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    if TG_TABLE_NAME = 'invoices' then
      v_date := (old.created_at at time zone 'Asia/Manila')::date;
      v_branch_id := old.branch_id;
      v_org_id := old.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := (old.created_at at time zone 'Asia/Manila')::date;
      v_org_id := old.organization_id;
      select branch_id into v_branch_id from public.invoices where id = old.invoice_id;
    end if;
  else
    if TG_TABLE_NAME = 'invoices' then
      v_date := (new.created_at at time zone 'Asia/Manila')::date;
      v_branch_id := new.branch_id;
      v_org_id := new.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := (new.created_at at time zone 'Asia/Manila')::date;
      v_org_id := new.organization_id;
      select branch_id into v_branch_id from public.invoices where id = new.invoice_id;
    end if;
  end if;

  if exists (
    select 1
    from public.closeout_snapshots cs
    where cs.organization_id = v_org_id
      and (cs.branch_id is null or cs.branch_id = v_branch_id)
      and cs.snapshot_date = v_date
      and cs.finalized = true
  ) then
    raise exception 'This calendar day has been closed out. Financial records for closed days cannot be modified or deleted.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists trg_invoices_closeout_lock on public.invoices;
drop trigger if exists trg_invoice_payments_closeout_lock on public.invoice_payments;

do $$
begin
  if to_regclass('public.invoices') is not null then
    create trigger trg_invoices_closeout_lock
      before update or delete on public.invoices
      for each row execute function public.check_closeout_lock();
  end if;

  if to_regclass('public.invoice_payments') is not null then
    create trigger trg_invoice_payments_closeout_lock
      before update or delete on public.invoice_payments
      for each row execute function public.check_closeout_lock();
  end if;
end $$;

create or replace function public.save_closeout_snapshot(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_payload jsonb;
  v_id uuid;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  v_payload := public.get_daily_closeout(p_branch_id, p_date);

  select cs.id
  into v_id
  from public.closeout_snapshots cs
  where cs.organization_id = v_org
    and cs.snapshot_date = p_date
    and cs.branch_id is not distinct from p_branch_id
  limit 1;

  if v_id is not null then
    update public.closeout_snapshots
    set payload = v_payload,
        created_by = auth.uid(),
        created_at = now(),
        finalized = false
    where id = v_id
      and finalized = false;
    if not found then
      raise exception 'This day is already finalized. Billing is locked for this clinic day.';
    end if;
    return v_id;
  end if;

  insert into public.closeout_snapshots (
    organization_id, branch_id, snapshot_date, payload, created_by, finalized
  )
  values (v_org, p_branch_id, p_date, v_payload, auth.uid(), false)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.finalize_closeout_snapshot(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_payload jsonb;
  v_id uuid;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  v_payload := public.get_daily_closeout(p_branch_id, p_date);

  select cs.id
  into v_id
  from public.closeout_snapshots cs
  where cs.organization_id = v_org
    and cs.snapshot_date = p_date
    and cs.branch_id is not distinct from p_branch_id
  limit 1;

  if v_id is not null then
    update public.closeout_snapshots
    set payload = v_payload,
        created_by = auth.uid(),
        created_at = now(),
        finalized = true
    where id = v_id;
    return v_id;
  end if;

  insert into public.closeout_snapshots (
    organization_id, branch_id, snapshot_date, payload, created_by, finalized
  )
  values (v_org, p_branch_id, p_date, v_payload, auth.uid(), true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_closeout_history(
  p_branch_id uuid default null,
  p_limit int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cs.id,
      'snapshot_date', cs.snapshot_date,
      'branch_id', cs.branch_id,
      'payload', cs.payload,
      'created_at', cs.created_at,
      'finalized', cs.finalized
    ) order by cs.snapshot_date desc, cs.created_at desc)
    from (
      select * from public.closeout_snapshots cs
      where cs.organization_id = public.current_user_org_id()
        and (p_branch_id is null or cs.branch_id = p_branch_id)
      order by cs.snapshot_date desc, cs.created_at desc
      limit greatest(p_limit, 1)
    ) cs
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.save_closeout_snapshot(uuid, date) to authenticated;
grant execute on function public.finalize_closeout_snapshot(uuid, date) to authenticated;
grant execute on function public.get_closeout_history(uuid, int) to authenticated;

-- -----------------------------------------------------------------------------
-- F) check_in_appointment — yetim checked_in otomatik onarım
-- -----------------------------------------------------------------------------
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
  v_has_active_queue boolean;
begin
  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;

  select exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = v_appt.id
      and qe.branch_id = v_appt.branch_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) into v_has_active_queue;

  if v_appt.status = 'checked_in' then
    if v_has_active_queue then
      raise exception 'Appointment is already checked in';
    end if;

    update public.appointments
    set status = 'confirmed',
        updated_at = now()
    where id = v_appt.id;

    v_appt.status := 'confirmed';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment cannot be checked in (status: %)', v_appt.status;
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

grant execute on function public.check_in_appointment(uuid, boolean, boolean, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- F2) update_appointment_status — completed yalnızca Queue Served sonrası
-- -----------------------------------------------------------------------------
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

  if p_status = 'completed' and not exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = p_appointment_id
      and qe.status = 'served'
  ) then
    raise exception 'Mark the patient as Served on the Queue board before completing this appointment.';
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

grant execute on function public.update_appointment_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- G) update_queue_status — iptal senkronu + served tamamlama
-- -----------------------------------------------------------------------------
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

  if p_status = 'cancelled'
    and v_entry.status is distinct from 'cancelled'
    and v_entry.appointment_id is not null then
    update public.appointments
    set status = 'confirmed', updated_at = now()
    where id = v_entry.appointment_id
      and status = 'checked_in';
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

grant execute on function public.update_queue_status(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- H) Dashboard KPI — UI anahtarları ile uyumlu (active_patients, low_stock_items, …)
-- -----------------------------------------------------------------------------
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
    and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair');

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
      and a.status in ('scheduled', 'confirmed', 'checked_in')
      and not exists (
        select 1
        from public.queue_entries qe
        where qe.appointment_id = a.id
          and qe.branch_id = p_branch_id
          and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
      );

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

grant execute on function public.get_dashboard_stats(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- I) Queue arrivals access — Queue role can read day schedule
-- -----------------------------------------------------------------------------
create or replace function public.get_day_schedule(p_branch_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_total int;
  v_scheduled int;
  v_completed int;
  v_cancelled int;
begin
  if not (
    public.has_permission('appointments.read', p_branch_id)
    or public.has_permission('queue.manage', p_branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'scheduled_at', a.scheduled_at,
      'purpose', a.purpose,
      'status', a.status,
      'patient_id', a.patient_id,
      'patient_name', trim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, '')),
      'provider_id', a.provider_id,
      'provider_name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
      'duration_minutes', a.duration_minutes
    ) order by a.scheduled_at
  ), '[]'::jsonb)
  into v_rows
  from public.appointments a
  join public.patients pt on pt.id = a.patient_id
  left join public.profiles pr on pr.id = a.provider_id
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  select
    count(*)::int,
    count(*) filter (where a.status in ('scheduled', 'confirmed'))::int,
    count(*) filter (where a.status = 'completed')::int,
    count(*) filter (where a.status = 'cancelled')::int
  into v_total, v_scheduled, v_completed, v_cancelled
  from public.appointments a
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'date', p_date,
    'summary', jsonb_build_object(
      'total', v_total,
      'scheduled', v_scheduled,
      'completed', v_completed,
      'cancelled', v_cancelled
    ),
    'appointments', v_rows
  );
end;
$$;

grant execute on function public.get_day_schedule(uuid, date) to authenticated;

commit;

-- =============================================================================
-- DOĞRULAMA (commit sonrası — hata vermez, sonuçları kontrol et)
-- =============================================================================
select
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'finalize_closeout_snapshot'
  ) as finalize_closeout_ok,
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_in_appointment'
  ) as check_in_appointment_ok,
  (
    select coalesce(
      pg_get_functiondef(p.oid) ilike '%if v_appt.status = ''checked_in'' then%'
      and pg_get_functiondef(p.oid) ilike '%Appointment is already checked in%',
      false
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_in_appointment'
    limit 1
  ) as check_in_orphan_repair_ok,
  (
    select coalesce(p.prosrc like '%Mark the patient as Served%', false)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_appointment_status'
    limit 1
  ) as appointment_complete_guard_ok,
  (
    select coalesce(p.prosrc like '%cancelled%' and p.prosrc like '%confirmed%', false)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_queue_status'
    limit 1
  ) as queue_cancel_sync_ok,
  (
    select coalesce(p.prosrc like '%active_patients%', false)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_dashboard_stats'
    limit 1
  ) as dashboard_keys_ok,
  (
    select coalesce(p.prosrc like '%No-show is manual only%', false)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'auto_no_show_for_branch'
    limit 1
  ) as auto_no_show_disabled_ok;
