-- W5-01: Align enqueue_hygiene_recalls with list/count snooze exclusion.
-- Active snoozes (patient_branch_links.recare_snoozed_until >= Asia/Manila today)
-- must not be queued for hygiene recall SMS by cron.
--
-- Previous definition: 20260612220000_recall_owner_automation.sql (no snooze filter).
-- Snooze column + list/count filters: 20260809091500_recare_snooze.sql.

create or replace function public.enqueue_hygiene_recalls(
  p_branch_id uuid,
  p_months int default 6
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row record;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cutoff date := (v_today - make_interval(months => greatest(p_months, 1)))::date;
  v_window_start date := v_cutoff - 7;
begin
  if not public._workflow_enabled(p_branch_id, 'auto_hygiene_recall') then
    return 0;
  end if;

  for v_row in
    select
      b.organization_id,
      pbl.branch_id,
      pbl.patient_id,
      pbl.last_visit_at::date as last_visit_date
    from public.patient_branch_links pbl
    join public.patients p on p.id = pbl.patient_id
    join public.branches b on b.id = pbl.branch_id
    where pbl.branch_id = p_branch_id
      and b.is_active
      and p.status = 'active'
      and pbl.last_visit_at is not null
      and pbl.last_visit_at::date >= v_window_start
      and pbl.last_visit_at::date <= v_cutoff
      and (pbl.recare_snoozed_until is null or pbl.recare_snoozed_until < v_today)
      and coalesce(length(trim(p.phone)), 0) > 0
      and not exists (
        select 1 from public.appointments a
        where a.patient_id = pbl.patient_id
          and a.branch_id = p_branch_id
          and a.status in ('scheduled', 'confirmed', 'checked_in')
          and a.scheduled_at >= now()
      )
      and not exists (
        select 1 from public.patient_recall_dispatches d
        where d.patient_id = pbl.patient_id
          and d.branch_id = p_branch_id
          and d.sent_at > now() - interval '150 days'
      )
      and not exists (
        select 1 from public.patient_recall_queue q
        where q.patient_id = pbl.patient_id
          and q.branch_id = p_branch_id
          and q.processed_at is null
      )
  loop
    insert into public.patient_recall_queue (
      organization_id, branch_id, patient_id, last_visit_date
    ) values (
      v_row.organization_id, v_row.branch_id, v_row.patient_id, v_row.last_visit_date
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_hygiene_recalls(uuid, int) from public;
revoke all on function public.enqueue_hygiene_recalls(uuid, int) from anon;
grant execute on function public.enqueue_hygiene_recalls(uuid, int) to service_role;

comment on function public.enqueue_hygiene_recalls(uuid, int) is
  'Queues hygiene recall SMS candidates; excludes active recare snoozes (Asia/Manila today); service_role only; no PHI in return.';

notify pgrst, 'reload schema';
