-- Count-only recare due KPI for dashboard attention (no PHI in payload).
-- Same eligibility rules as list_recare_due_patients / enqueue_hygiene_recalls.

create or replace function public.count_recare_due_patients(
  p_branch_id uuid,
  p_months int default 6
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_months int := greatest(coalesce(p_months, 6), 1);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cutoff date := (v_today - make_interval(months => v_months))::date;
  v_count bigint := 0;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;
  if not exists (
    select 1
    from public.branches b
    where b.id = p_branch_id
      and b.organization_id = v_org
      and b.is_active
  ) then
    raise exception 'Branch not found';
  end if;

  select count(*)::bigint
  into v_count
  from public.patient_branch_links pbl
  join public.patients p on p.id = pbl.patient_id
  where pbl.branch_id = p_branch_id
    and p.organization_id = v_org
    and p.status = 'active'
    and pbl.last_visit_at is not null
    and (pbl.last_visit_at at time zone 'Asia/Manila')::date <= v_cutoff
    and not exists (
      select 1
      from public.appointments a
      where a.patient_id = pbl.patient_id
        and a.branch_id = p_branch_id
        and a.organization_id = v_org
        and a.status in ('scheduled', 'confirmed', 'checked_in')
        and a.scheduled_at >= now()
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.count_recare_due_patients(uuid, int) from public;
revoke all on function public.count_recare_due_patients(uuid, int) from anon;
grant execute on function public.count_recare_due_patients(uuid, int) to authenticated;

comment on function public.count_recare_due_patients(uuid, int) is
  'Returns due-for-recall patient count for appointments.read; Asia/Manila cutoff; integer only (no PHI).';
