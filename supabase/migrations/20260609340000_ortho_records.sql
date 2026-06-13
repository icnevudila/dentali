-- Module 12: Orthodontic treatment record

create table if not exists public.ortho_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  appliance_type text,
  start_date date,
  contract_amount numeric(12, 2) not null default 0,
  notes text,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ortho_cases_patient on public.ortho_cases(patient_id, status);

create table if not exists public.ortho_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  case_id uuid not null references public.ortho_cases(id) on delete cascade,
  adjustment_date date not null default (now() at time zone 'Asia/Manila')::date,
  procedure text not null,
  next_procedure text,
  next_visit_date date,
  payment_amount numeric(12, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ortho_adjustments_case on public.ortho_adjustments(case_id, adjustment_date desc);

alter table public.ortho_cases enable row level security;
alter table public.ortho_adjustments enable row level security;

create policy ortho_cases_select on public.ortho_cases
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.read', branch_id)
  );

create policy ortho_cases_write on public.ortho_cases
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.write', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.write', branch_id)
  );

create policy ortho_adjustments_select on public.ortho_adjustments
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.read', branch_id)
  );

create policy ortho_adjustments_insert on public.ortho_adjustments
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.write', branch_id)
  );

create or replace function public.calculate_ortho_balance(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_case public.ortho_cases%rowtype;
  v_paid numeric;
begin
  select * into v_case from public.ortho_cases where id = p_case_id;
  if not found then
    raise exception 'Case not found';
  end if;

  if not public.has_permission('dental_chart.read', v_case.branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(sum(payment_amount), 0) into v_paid
  from public.ortho_adjustments where case_id = p_case_id;

  return jsonb_build_object(
    'contract_amount', v_case.contract_amount,
    'total_paid', v_paid,
    'balance', v_case.contract_amount - v_paid
  );
end;
$$;

create or replace function public.log_ortho_adjustment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid := (p_payload->>'case_id')::uuid;
  v_case public.ortho_cases%rowtype;
  v_id uuid;
begin
  select * into v_case from public.ortho_cases where id = v_case_id;
  if not found then raise exception 'Case not found'; end if;
  if v_case.status <> 'active' then raise exception 'Case is closed'; end if;
  if not public.has_permission('dental_chart.write', v_case.branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.ortho_adjustments (
    organization_id, branch_id, case_id,
    adjustment_date, procedure, next_procedure, next_visit_date,
    payment_amount, notes, created_by
  ) values (
    v_case.organization_id, v_case.branch_id, v_case_id,
    coalesce((p_payload->>'adjustment_date')::date, (now() at time zone 'Asia/Manila')::date),
    p_payload->>'procedure',
    nullif(p_payload->>'next_procedure', ''),
    nullif(p_payload->>'next_visit_date', '')::date,
    coalesce((p_payload->>'payment_amount')::numeric, 0),
    nullif(p_payload->>'notes', ''),
    auth.uid()
  )
  returning id into v_id;

  update public.ortho_cases set updated_at = now(), updated_by = auth.uid() where id = v_case_id;

  return public.calculate_ortho_balance(v_case_id) || jsonb_build_object('adjustment_id', v_id);
end;
$$;

grant execute on function public.calculate_ortho_balance(uuid) to authenticated;
grant execute on function public.log_ortho_adjustment(jsonb) to authenticated;
