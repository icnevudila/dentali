-- Ortho modulu tablolari (migration: 20260609340000_ortho_records.sql)
-- RPC'ler zaten _APPLY_FUNCTIONS_ONLY ile yukluyse sadece bu DDL yeterli.

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

drop policy if exists ortho_cases_select on public.ortho_cases;
create policy ortho_cases_select on public.ortho_cases
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.read', branch_id)
  );

drop policy if exists ortho_cases_write on public.ortho_cases
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.write', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.write', branch_id)
  );

drop policy if exists ortho_adjustments_select on public.ortho_adjustments
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.read', branch_id)
  );

drop policy if exists ortho_adjustments_insert on public.ortho_adjustments
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.write', branch_id)
  );
