-- Read-only clinic flow health check (run after APPLY_PATIENT_FLOW_MASTER.sql)
-- All boolean checks in section 1 should be true.

-- 1) RPC / schema smoke
select
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'finalize_closeout_snapshot'
  ) as finalize_closeout_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'closeout_snapshots' and column_name = 'finalized'
  ) as closeout_finalized_col_ok,
  (
    select coalesce(
      pg_get_functiondef(p.oid) ilike '%if v_appt.status = ''checked_in'' then%'
      and pg_get_functiondef(p.oid) ilike '%Appointment is already checked in%',
      false
    )
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_in_appointment'
    limit 1
  ) as check_in_orphan_repair_ok,
  (
    select coalesce(p.prosrc like '%cancelled%' and p.prosrc like '%confirmed%', false)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_queue_status'
    limit 1
  ) as queue_cancel_sync_ok,
  (
    select coalesce(p.prosrc like '%active_patients%', false)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_dashboard_stats'
    limit 1
  ) as dashboard_keys_ok,
  (
    select coalesce(p.prosrc like '%No-show is manual only%', false)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'auto_no_show_for_branch'
    limit 1
  ) as auto_no_show_disabled_ok,
  (
    select coalesce(p.prosrc like '%Mark the patient as Served%', false)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_appointment_status'
    limit 1
  ) as appointment_complete_guard_ok;

-- 2) Today's appointments that SHOULD appear in Queue Check-in
select
  a.id,
  a.status,
  a.scheduled_at at time zone 'Asia/Manila' as manila_time,
  trim(pt.first_name || ' ' || pt.last_name) as patient_name,
  b.name as branch_name
from public.appointments a
join public.patients pt on pt.id = a.patient_id
join public.branches b on b.id = a.branch_id
where (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  and a.status in ('scheduled', 'confirmed', 'checked_in')
  and not exists (
    select 1 from public.queue_entries qe
    where qe.appointment_id = a.id
      and qe.branch_id = a.branch_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  )
order by a.scheduled_at;

-- 3) Stale no_show today wrongly blocking arrivals (ideal: 0 rows)
select a.id, a.status, a.scheduled_at
from public.appointments a
where a.status = 'no_show'
  and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  and not exists (
    select 1 from public.queue_entries qe
    where qe.appointment_id = a.id and qe.status not in ('cancelled')
  );

-- 4) Orphan checked_in today (ideal: 0 rows after master SQL)
select a.id, a.status, a.scheduled_at
from public.appointments a
where a.status = 'checked_in'
  and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  and not exists (
    select 1 from public.queue_entries qe
    where qe.appointment_id = a.id
      and qe.branch_id = a.branch_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  );

-- 5) Served/cancelled queue with appointment still scheduled (informational)
select
  qe.id,
  qe.status,
  qe.appointment_id,
  a.status as appointment_status
from public.queue_entries qe
join public.appointments a on a.id = qe.appointment_id
where (qe.checked_in_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  and qe.status in ('served', 'cancelled')
  and a.status in ('scheduled', 'confirmed');
