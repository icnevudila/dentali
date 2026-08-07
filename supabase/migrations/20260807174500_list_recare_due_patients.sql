-- Front-desk recare worklist: patients due for hygiene/recall based on
-- patient_branch_links.last_visit_at + interval (default 6 months, matching
-- enqueue_hygiene_recalls). Excludes patients who already have a future booking.

create or replace function public.list_recare_due_patients(
  p_branch_id uuid,
  p_months int default 6,
  p_limit int default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_months int := greatest(coalesce(p_months, 6), 1);
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cutoff date := (v_today - make_interval(months => v_months))::date;
  v_rows jsonb;
  v_has_visit_history boolean;
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

  select exists (
    select 1
    from public.patient_branch_links pbl
    join public.patients p on p.id = pbl.patient_id
    where pbl.branch_id = p_branch_id
      and p.organization_id = v_org
      and pbl.last_visit_at is not null
  )
  into v_has_visit_history;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'patient_id', t.patient_id,
        'first_name', t.first_name,
        'last_name', t.last_name,
        'last_visit_date', t.last_visit_date,
        'due_date', t.due_date,
        'days_overdue', t.days_overdue
      )
      order by t.last_visit_at asc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      p.id as patient_id,
      p.first_name,
      p.last_name,
      pbl.last_visit_at,
      (pbl.last_visit_at at time zone 'Asia/Manila')::date as last_visit_date,
      (
        (pbl.last_visit_at at time zone 'Asia/Manila')::date
        + make_interval(months => v_months)
      )::date as due_date,
      greatest(
        0,
        v_today - (
          (pbl.last_visit_at at time zone 'Asia/Manila')::date
          + make_interval(months => v_months)
        )::date
      ) as days_overdue
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
      )
    order by pbl.last_visit_at asc
    limit v_limit
  ) t;

  -- No PHI in return metadata; rows omit phone/email for worklist MVP.
  return jsonb_build_object(
    'interval_months', v_months,
    'as_of_date', v_today,
    'cutoff_date', v_cutoff,
    'has_visit_history', coalesce(v_has_visit_history, false),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_recare_due_patients(uuid, int, int) from public;
revoke all on function public.list_recare_due_patients(uuid, int, int) from anon;
grant execute on function public.list_recare_due_patients(uuid, int, int) to authenticated;

comment on function public.list_recare_due_patients(uuid, int, int) is
  'Lists active patients due for recall (last visit + months) for appointments.read; Asia/Manila dates; no phone in payload.';
