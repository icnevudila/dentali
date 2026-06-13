-- Wave 3: Procedures, treatment plans, invoices (MVP)

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  category text default 'general',
  base_price numeric(12,2) not null default 0,
  tooth_required boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','proposed','approved','in_progress','completed','cancelled')),
  total_estimated numeric(12,2) default 0,
  notes text,
  approved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.treatment_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.treatment_plans(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  tooth_number text,
  description text not null,
  estimated_price numeric(12,2) not null default 0,
  priority text default 'restorative' check (priority in ('urgent','restorative','cosmetic','ortho')),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  invoice_number text,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','partial','paid','void')),
  due_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.procedures enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.treatment_plan_items enable row level security;
alter table public.invoices enable row level security;

create policy procedures_org on public.procedures for all using (organization_id = public.current_user_org_id());
create policy treatment_plans_org on public.treatment_plans for all using (organization_id = public.current_user_org_id());
create policy treatment_plan_items_via_plan on public.treatment_plan_items for all using (
  exists (select 1 from public.treatment_plans tp where tp.id = treatment_plan_items.plan_id and tp.organization_id = public.current_user_org_id())
);
create policy invoices_org on public.invoices for all using (organization_id = public.current_user_org_id());

-- Seed default procedures per org on bootstrap (called from app or trigger)
create or replace function public.seed_default_procedures(p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.procedures (organization_id, code, name, category, base_price, tooth_required) values
    (p_org_id, 'EXAM', 'Oral Examination', 'preventive', 500, false),
    (p_org_id, 'PROPH', 'Prophylaxis / Cleaning', 'preventive', 2500, false),
    (p_org_id, 'FILL', 'Composite Filling', 'restorative', 3500, true),
    (p_org_id, 'RCT', 'Root Canal Treatment', 'restorative', 12000, true),
    (p_org_id, 'EXT', 'Tooth Extraction', 'surgery', 4000, true),
    (p_org_id, 'CRWN', 'Jacket Crown', 'restorative', 15000, true)
  on conflict do nothing;
end; $$;

-- Update bootstrap to seed procedures
create or replace function public.bootstrap_clinic(p_org_name text, p_branch_name text default 'Main Clinic')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_branch_id uuid; v_owner_role_id uuid; v_user_id uuid := auth.uid(); v_email text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_user_id) then
    return jsonb_build_object('status', 'already_bootstrapped');
  end if;
  select email into v_email from auth.users where id = v_user_id;
  insert into public.organizations (name) values (p_org_name) returning id into v_org_id;
  insert into public.branches (organization_id, name) values (v_org_id, p_branch_name) returning id into v_branch_id;
  insert into public.organization_settings (organization_id) values (v_org_id);
  insert into public.profiles (id, organization_id, email, full_name)
    values (v_user_id, v_org_id, coalesce(v_email, ''), split_part(coalesce(v_email, 'Owner'), '@', 1));
  insert into public.staff_profiles (profile_id) values (v_user_id);
  select id into v_owner_role_id from public.roles where name = 'owner' limit 1;
  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
    values (v_user_id, v_branch_id, v_owner_role_id);
  perform public.seed_default_procedures(v_org_id);
  perform public.ensure_branch_clinic_hours(v_branch_id);
  return jsonb_build_object('status', 'created', 'organization_id', v_org_id, 'branch_id', v_branch_id);
end; $$;

create or replace function public.get_patient_appointments(p_patient_id uuid, p_limit int default 20)
returns table (id uuid, scheduled_at timestamptz, purpose text, status text)
language sql stable security definer set search_path = public as $$
  select a.id, a.scheduled_at, a.purpose, a.status
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.patient_id = p_patient_id and p.organization_id = public.current_user_org_id()
  order by a.scheduled_at desc limit p_limit;
$$;

create or replace function public.get_patient_treatment_plans(p_patient_id uuid)
returns table (
  id uuid, title text, status text, total_estimated numeric, created_at timestamptz, item_count bigint
) language sql stable security definer set search_path = public as $$
  select tp.id, tp.title, tp.status, tp.total_estimated, tp.created_at,
    (select count(*) from public.treatment_plan_items i where i.plan_id = tp.id)
  from public.treatment_plans tp
  where tp.patient_id = p_patient_id and tp.organization_id = public.current_user_org_id()
  order by tp.created_at desc;
$$;
