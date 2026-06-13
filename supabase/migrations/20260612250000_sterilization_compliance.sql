-- Module 24: Sterilization / compliance cycle logs

create table if not exists public.compliance_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cycle_type text not null default 'sterilization'
    check (cycle_type in ('sterilization')),
  equipment_name text not null,
  load_description text,
  cycle_method text not null default 'gravity'
    check (cycle_method in ('gravity', 'pre_vacuum', 'statim', 'other')),
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  temperature_c numeric(5, 1),
  biological_indicator text not null default 'not_used'
    check (biological_indicator in ('pass', 'fail', 'pending', 'not_used')),
  chemical_indicator text not null default 'pending'
    check (chemical_indicator in ('pass', 'fail', 'pending', 'not_used')),
  result_status text not null default 'pending'
    check (result_status in ('pass', 'fail', 'pending', 'aborted')),
  operator_name text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_compliance_cycles_branch_started
  on public.compliance_cycles (branch_id, started_at desc);

create index if not exists idx_compliance_cycles_org_started
  on public.compliance_cycles (organization_id, started_at desc);

alter table public.compliance_cycles enable row level security;

drop policy if exists compliance_cycles_select on public.compliance_cycles;
create policy compliance_cycles_select on public.compliance_cycles
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('compliance.read', branch_id)
  );

drop policy if exists compliance_cycles_insert on public.compliance_cycles;
create policy compliance_cycles_insert on public.compliance_cycles
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('compliance.write', branch_id)
  );

-- Append-only: no update/delete policies for compliance records

insert into public.permissions (name, description) values
  ('compliance.read', 'View sterilization and compliance logs'),
  ('compliance.write', 'Log sterilization cycles')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.name in ('compliance.read', 'compliance.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('dentist', 'assistant')
  and p.name in ('compliance.read', 'compliance.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'receptionist'
  and p.name = 'compliance.read'
on conflict do nothing;

create or replace function public._evaluate_compliance_result(
  p_biological text,
  p_chemical text,
  p_result text
)
returns text
language plpgsql
immutable
as $$
begin
  if p_result in ('fail', 'aborted') then
    return p_result;
  end if;
  if p_biological = 'fail' or p_chemical = 'fail' then
    return 'fail';
  end if;
  if p_biological = 'pending' or p_chemical = 'pending' then
    return 'pending';
  end if;
  if p_biological in ('pass', 'not_used') and p_chemical = 'pass' then
    return 'pass';
  end if;
  if p_biological = 'pass' and p_chemical = 'not_used' then
    return 'pass';
  end if;
  return coalesce(p_result, 'pending');
end;
$$;

create or replace function public.log_compliance_cycle(
  p_branch_id uuid,
  p_equipment_name text,
  p_load_description text default null,
  p_cycle_method text default 'gravity',
  p_started_at timestamptz default now(),
  p_completed_at timestamptz default null,
  p_duration_minutes integer default null,
  p_temperature_c numeric default null,
  p_biological_indicator text default 'not_used',
  p_chemical_indicator text default 'pending',
  p_result_status text default 'pending',
  p_operator_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
  v_result text;
begin
  if p_equipment_name is null or trim(p_equipment_name) = '' then
    raise exception 'Equipment name is required';
  end if;

  select organization_id into v_org
  from public.branches
  where id = p_branch_id;

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  if v_org <> public.current_user_org_id() then
    raise exception 'Branch not in organization';
  end if;

  if not public.has_permission('compliance.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  v_result := public._evaluate_compliance_result(
    coalesce(p_biological_indicator, 'not_used'),
    coalesce(p_chemical_indicator, 'pending'),
    coalesce(p_result_status, 'pending')
  );

  insert into public.compliance_cycles (
    organization_id,
    branch_id,
    equipment_name,
    load_description,
    cycle_method,
    started_at,
    completed_at,
    duration_minutes,
    temperature_c,
    biological_indicator,
    chemical_indicator,
    result_status,
    operator_name,
    notes,
    created_by
  )
  values (
    v_org,
    p_branch_id,
    trim(p_equipment_name),
    nullif(trim(coalesce(p_load_description, '')), ''),
    coalesce(p_cycle_method, 'gravity'),
    coalesce(p_started_at, now()),
    p_completed_at,
    p_duration_minutes,
    p_temperature_c,
    coalesce(p_biological_indicator, 'not_used'),
    coalesce(p_chemical_indicator, 'pending'),
    v_result,
    nullif(trim(coalesce(p_operator_name, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.organization_audit_logs (
    organization_id,
    branch_id,
    profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_org,
    p_branch_id,
    auth.uid(),
    'compliance.cycle_logged',
    'compliance_cycle',
    v_id,
    jsonb_build_object(
      'equipment_name', trim(p_equipment_name),
      'result_status', v_result,
      'cycle_method', coalesce(p_cycle_method, 'gravity')
    )
  );

  return v_id;
end;
$$;

grant execute on function public.log_compliance_cycle(
  uuid, text, text, text, timestamptz, timestamptz, integer, numeric, text, text, text, text, text
) to authenticated;

create or replace function public.get_compliance_cycles(
  p_branch_id uuid,
  p_limit integer default 100,
  p_since timestamptz default null
)
returns table (
  id uuid,
  branch_id uuid,
  equipment_name text,
  load_description text,
  cycle_method text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  temperature_c numeric,
  biological_indicator text,
  chemical_indicator text,
  result_status text,
  operator_name text,
  notes text,
  created_by uuid,
  created_at timestamptz,
  logged_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Branch access denied';
  end if;

  if not public.has_permission('compliance.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    c.id,
    c.branch_id,
    c.equipment_name,
    c.load_description,
    c.cycle_method,
    c.started_at,
    c.completed_at,
    c.duration_minutes,
    c.temperature_c,
    c.biological_indicator,
    c.chemical_indicator,
    c.result_status,
    c.operator_name,
    c.notes,
    c.created_by,
    c.created_at,
    coalesce(p.full_name, p.email, 'Staff') as logged_by_name
  from public.compliance_cycles c
  left join public.profiles p on p.id = c.created_by
  where c.branch_id = p_branch_id
    and (p_since is null or c.started_at >= p_since)
  order by c.started_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

grant execute on function public.get_compliance_cycles(uuid, integer, timestamptz) to authenticated;

create or replace function public.get_compliance_summary(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - interval '30 days';
  v_result jsonb;
begin
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Branch access denied';
  end if;

  if not public.has_permission('compliance.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select jsonb_build_object(
    'total_30d', count(*) filter (where started_at >= v_since),
    'passed_30d', count(*) filter (where started_at >= v_since and result_status = 'pass'),
    'failed_30d', count(*) filter (where started_at >= v_since and result_status = 'fail'),
    'pending_30d', count(*) filter (where started_at >= v_since and result_status = 'pending'),
    'last_cycle_at', max(started_at),
    'last_pass_at', max(started_at) filter (where result_status = 'pass')
  )
  into v_result
  from public.compliance_cycles
  where branch_id = p_branch_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_compliance_summary(uuid) to authenticated;
