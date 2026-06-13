-- Dental chart / odontogram tables + RPCs (get_patient_odontogram, upsert_tooth_finding)

create table if not exists public.dental_charts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'locked')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_dental_charts_active_patient_branch
  on public.dental_charts (patient_id, branch_id)
  where status = 'active';

create index if not exists idx_dental_charts_branch on public.dental_charts (branch_id, patient_id);

create table if not exists public.tooth_findings (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.dental_charts(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  tooth_number text not null,
  dentition_type text not null default 'permanent' check (dentition_type in ('permanent', 'primary')),
  condition text,
  surfaces text[] not null default '{}',
  restoration_type text,
  surgery_type text,
  notes text,
  status text not null default 'active' check (status in ('active', 'voided')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tooth_findings_active_tooth
  on public.tooth_findings (chart_id, tooth_number)
  where status = 'active';

create index if not exists idx_tooth_findings_branch on public.tooth_findings (branch_id, status);

create table if not exists public.dental_chart_audit_events (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.dental_charts(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  action text not null check (action in ('INSERT', 'UPDATE', 'VOID')),
  tooth_number text,
  before_json jsonb,
  after_json jsonb,
  actor_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_dental_chart_audit_patient
  on public.dental_chart_audit_events (patient_id, created_at desc);

alter table public.dental_charts enable row level security;
alter table public.tooth_findings enable row level security;
alter table public.dental_chart_audit_events enable row level security;

drop policy if exists dental_charts_select on public.dental_charts;
create policy dental_charts_select on public.dental_charts for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

drop policy if exists dental_charts_insert on public.dental_charts;
create policy dental_charts_insert on public.dental_charts for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists dental_charts_update on public.dental_charts;
create policy dental_charts_update on public.dental_charts for update using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists tooth_findings_select on public.tooth_findings;
create policy tooth_findings_select on public.tooth_findings for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

drop policy if exists tooth_findings_insert on public.tooth_findings;
create policy tooth_findings_insert on public.tooth_findings for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists tooth_findings_update on public.tooth_findings;
create policy tooth_findings_update on public.tooth_findings for update using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists dental_chart_audit_select on public.dental_chart_audit_events;
create policy dental_chart_audit_select on public.dental_chart_audit_events for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

-- ---------------------------------------------------------------------------
-- get_patient_odontogram
-- (DROP required when an older signature used parameter defaults)
-- ---------------------------------------------------------------------------
drop function if exists public.get_patient_odontogram(uuid, uuid);

create or replace function public.get_patient_odontogram(p_patient_id uuid, p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_chart record;
  v_findings jsonb;
begin
  if p_branch_id is not null and not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select * into v_chart
  from public.dental_charts dc
  where dc.patient_id = p_patient_id
    and dc.organization_id = v_org
    and (p_branch_id is null or dc.branch_id = p_branch_id)
    and dc.status = 'active'
  order by dc.updated_at desc
  limit 1;

  if v_chart.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tf.id,
      'tooth_number', tf.tooth_number,
      'dentition_type', tf.dentition_type,
      'condition', tf.condition,
      'surfaces', tf.surfaces,
      'restoration_type', tf.restoration_type,
      'surgery_type', tf.surgery_type,
      'notes', tf.notes,
      'status', tf.status,
      'created_at', tf.created_at,
      'updated_at', tf.updated_at
    ) order by tf.tooth_number
  ), '[]'::jsonb)
  into v_findings
  from public.tooth_findings tf
  where tf.chart_id = v_chart.id
    and tf.status = 'active';

  return jsonb_build_object(
    'id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'findings', v_findings
  );
end;
$$;

grant execute on function public.get_patient_odontogram(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_tooth_finding
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_tooth_finding(
  uuid, uuid, uuid, uuid, text, text, text, text[], text, text, text, uuid
);

create or replace function public.upsert_tooth_finding(
  p_organization_id uuid,
  p_branch_id uuid,
  p_chart_id uuid,
  p_patient_id uuid,
  p_tooth_number text,
  p_dentition_type text,
  p_condition text,
  p_surfaces text[],
  p_restoration_type text,
  p_surgery_type text,
  p_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_row public.tooth_findings%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_permission('dental_chart.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  select * into v_existing
  from public.tooth_findings
  where chart_id = p_chart_id
    and tooth_number = p_tooth_number
    and status = 'active'
  limit 1;

  if v_existing.id is not null then
    v_before := jsonb_build_object(
      'tooth_number', v_existing.tooth_number,
      'condition', v_existing.condition,
      'surfaces', v_existing.surfaces,
      'restoration_type', v_existing.restoration_type,
      'surgery_type', v_existing.surgery_type,
      'notes', v_existing.notes
    );

    update public.tooth_findings
    set
      condition = p_condition,
      dentition_type = coalesce(p_dentition_type, dentition_type),
      surfaces = coalesce(p_surfaces, '{}'),
      restoration_type = p_restoration_type,
      surgery_type = p_surgery_type,
      notes = p_notes,
      updated_by = p_actor_user_id,
      updated_at = now()
    where id = v_existing.id
    returning * into v_row;

    v_after := jsonb_build_object(
      'tooth_number', v_row.tooth_number,
      'condition', v_row.condition,
      'surfaces', v_row.surfaces,
      'restoration_type', v_row.restoration_type,
      'surgery_type', v_row.surgery_type,
      'notes', v_row.notes
    );

    insert into public.dental_chart_audit_events (
      chart_id, patient_id, organization_id, branch_id,
      action, tooth_number, before_json, after_json, actor_user_id
    ) values (
      p_chart_id, p_patient_id, p_organization_id, p_branch_id,
      'UPDATE', p_tooth_number, v_before, v_after, p_actor_user_id
    );
  else
    insert into public.tooth_findings (
      chart_id, patient_id, organization_id, branch_id,
      tooth_number, dentition_type, condition, surfaces,
      restoration_type, surgery_type, notes,
      created_by, updated_by
    ) values (
      p_chart_id, p_patient_id, p_organization_id, p_branch_id,
      p_tooth_number, coalesce(p_dentition_type, 'permanent'), p_condition,
      coalesce(p_surfaces, '{}'),
      p_restoration_type, p_surgery_type, p_notes,
      p_actor_user_id, p_actor_user_id
    )
    returning * into v_row;

    v_after := jsonb_build_object(
      'tooth_number', v_row.tooth_number,
      'condition', v_row.condition,
      'surfaces', v_row.surfaces,
      'restoration_type', v_row.restoration_type,
      'surgery_type', v_row.surgery_type,
      'notes', v_row.notes
    );

    insert into public.dental_chart_audit_events (
      chart_id, patient_id, organization_id, branch_id,
      action, tooth_number, before_json, after_json, actor_user_id
    ) values (
      p_chart_id, p_patient_id, p_organization_id, p_branch_id,
      'INSERT', p_tooth_number, null, v_after, p_actor_user_id
    );
  end if;

  update public.dental_charts
  set updated_by = p_actor_user_id, updated_at = now()
  where id = p_chart_id;

  return jsonb_build_object(
    'id', v_row.id,
    'tooth_number', v_row.tooth_number,
    'dentition_type', v_row.dentition_type,
    'condition', v_row.condition,
    'surfaces', v_row.surfaces,
    'restoration_type', v_row.restoration_type,
    'surgery_type', v_row.surgery_type,
    'notes', v_row.notes,
    'status', v_row.status,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.upsert_tooth_finding(
  uuid, uuid, uuid, uuid, text, text, text, text[], text, text, text, uuid
) to authenticated;
