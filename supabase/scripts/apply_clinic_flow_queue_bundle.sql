-- =============================================================================
-- dentQL — Clinic flow SQL paketi (Queue check-in + Closeout + Dashboard)
-- =============================================================================
-- NEREYE: Supabase Dashboard → SQL Editor → yapıştır → Run
-- TEKRAR ÇALIŞTIRMA: Güvenli (CREATE OR REPLACE, IF NOT EXISTS, DROP IF EXISTS)
-- ÖN KOŞUL: Önceki migration'ların hiçbiri uygulanmamış olsa da çalışır.
--             Kısmen uygulanmış ortamda da çalışır.
--
-- Bu paket şunları yapar:
--   1) Bugün yanlışlıkla no_show olan randevuları scheduled'a geri alır
--   2) Geçmiş saate randevu oluşturmayı engeller
--   3) Otomatik no-show'u kapatır (manuel işaretleme)
--   4) Closeout: taslak snapshot kilitlemez; sadece finalize edilince kilitler
--   5) Dashboard "awaiting check-in" sayısını aktif kuyrukla hizalar
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Data repair — wrongly hidden same-day arrivals (no queue check-in yet)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2) Booking guard — no past-time appointments (walk-ins use queue arrival)
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
-- 3) Auto no-show OFF — staff marks manually
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
-- 4) Closeout — draft snapshot vs finalize (billing lock only when finalized)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.closeout_snapshots') is not null then
    alter table public.closeout_snapshots
      add column if not exists finalized boolean not null default false;

    update public.closeout_snapshots
    set finalized = false
    where finalized is distinct from true;
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
-- 5) Dashboard awaiting check-in — exclude active queue board entries
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
      and a.status in ('scheduled', 'confirmed')
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

-- =============================================================================
-- DOĞRULAMA (sadece okuma — hata vermez)
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
    where n.nspname = 'public' and p.proname = 'create_appointment_validated'
  ) as create_appointment_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'closeout_snapshots'
      and column_name = 'finalized'
  ) as closeout_finalized_column_ok,
  (
    select (p.prosrc like '%disabled%true%')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'auto_no_show_for_branch'
    limit 1
  ) as auto_no_show_disabled_ok;
