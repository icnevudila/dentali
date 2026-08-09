-- Recare snooze/dismiss for N days (front-desk worklist).
-- Persistence: patient_branch_links.recare_snoozed_until (Asia/Manila date).
-- RPCs: snooze_recare_patient / unsnooze_recare_patient (appointments.write + audit).
-- list_recare_due_patients + count_recare_due_patients exclude active snoozes.
--
-- REMOTE APPLY: this file is the source of truth in-repo. Apply on the linked
-- Supabase project (CLI `supabase db push` / SQL Editor / MCP apply_migration)
-- before relying on snooze in deployed environments. Local/CI may not auto-apply.

alter table public.patient_branch_links
  add column if not exists recare_snoozed_until date;

comment on column public.patient_branch_links.recare_snoozed_until is
  'Asia/Manila calendar date until which this patient is hidden from recare due lists for the branch; null = not snoozed.';

create index if not exists idx_patient_branch_links_recare_snooze
  on public.patient_branch_links (branch_id, recare_snoozed_until)
  where recare_snoozed_until is not null;

-- ---------------------------------------------------------------------------
-- snooze_recare_patient
-- ---------------------------------------------------------------------------
create or replace function public.snooze_recare_patient(
  p_branch_id uuid,
  p_patient_id uuid,
  p_days int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_days int := coalesce(p_days, 0);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_until date;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null or p_patient_id is null then
    raise exception 'Branch and patient are required';
  end if;
  if v_days < 1 or v_days > 90 then
    raise exception 'Snooze days must be between 1 and 90';
  end if;
  if not public.has_permission('appointments.write', p_branch_id) then
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
  if not exists (
    select 1
    from public.patients p
    where p.id = p_patient_id
      and p.organization_id = v_org
  ) then
    raise exception 'Patient not found';
  end if;
  if not exists (
    select 1
    from public.patient_branch_links pbl
    where pbl.patient_id = p_patient_id
      and pbl.branch_id = p_branch_id
  ) then
    raise exception 'Patient is not linked to this branch';
  end if;

  v_until := v_today + v_days;

  update public.patient_branch_links
  set recare_snoozed_until = v_until
  where patient_id = p_patient_id
    and branch_id = p_branch_id;

  -- Audit: ids + days only (no names/phone).
  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    p_branch_id,
    auth.uid(),
    'recare.snooze',
    'patient',
    p_patient_id::text,
    jsonb_build_object(
      'days', v_days,
      'snoozed_until', v_until,
      'as_of_date', v_today
    )
  );

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'branch_id', p_branch_id,
    'days', v_days,
    'snoozed_until', v_until,
    'as_of_date', v_today
  );
end;
$$;

revoke all on function public.snooze_recare_patient(uuid, uuid, int) from public;
revoke all on function public.snooze_recare_patient(uuid, uuid, int) from anon;
grant execute on function public.snooze_recare_patient(uuid, uuid, int) to authenticated;

comment on function public.snooze_recare_patient(uuid, uuid, int) is
  'Snoozes a patient from recare due lists for 1–90 days (Asia/Manila); requires appointments.write; audits without PHI names.';

-- ---------------------------------------------------------------------------
-- unsnooze_recare_patient (undo)
-- ---------------------------------------------------------------------------
create or replace function public.unsnooze_recare_patient(
  p_branch_id uuid,
  p_patient_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_prev date;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null or p_patient_id is null then
    raise exception 'Branch and patient are required';
  end if;
  if not public.has_permission('appointments.write', p_branch_id) then
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
  if not exists (
    select 1
    from public.patients p
    where p.id = p_patient_id
      and p.organization_id = v_org
  ) then
    raise exception 'Patient not found';
  end if;

  select pbl.recare_snoozed_until
  into v_prev
  from public.patient_branch_links pbl
  where pbl.patient_id = p_patient_id
    and pbl.branch_id = p_branch_id;

  if not found then
    raise exception 'Patient is not linked to this branch';
  end if;

  update public.patient_branch_links
  set recare_snoozed_until = null
  where patient_id = p_patient_id
    and branch_id = p_branch_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    p_branch_id,
    auth.uid(),
    'recare.unsnooze',
    'patient',
    p_patient_id::text,
    jsonb_build_object(
      'previous_snoozed_until', v_prev,
      'as_of_date', v_today
    )
  );

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'branch_id', p_branch_id,
    'snoozed_until', null,
    'as_of_date', v_today
  );
end;
$$;

revoke all on function public.unsnooze_recare_patient(uuid, uuid) from public;
revoke all on function public.unsnooze_recare_patient(uuid, uuid) from anon;
grant execute on function public.unsnooze_recare_patient(uuid, uuid) to authenticated;

comment on function public.unsnooze_recare_patient(uuid, uuid) is
  'Clears recare snooze for a branch patient; requires appointments.write; audits without PHI names.';

-- ---------------------------------------------------------------------------
-- list_recare_due_patients (exclude active snooze)
-- ---------------------------------------------------------------------------
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
      and (pbl.recare_snoozed_until is null or pbl.recare_snoozed_until < v_today)
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
  'Lists active patients due for recall; excludes snoozed until Asia/Manila date; appointments.read; no phone in payload.';

-- ---------------------------------------------------------------------------
-- count_recare_due_patients (exclude active snooze)
-- ---------------------------------------------------------------------------
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
    and (pbl.recare_snoozed_until is null or pbl.recare_snoozed_until < v_today)
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
  'Due-for-recall count; excludes snoozed until Asia/Manila date; appointments.read; integer only (no PHI).';
