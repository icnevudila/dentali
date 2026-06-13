-- AUTO-GENERATED: 62 migration dosyasi (sirali)
-- Supabase Dashboard > SQL Editor > Run
-- Not: Bazi satirlar "already exists" verebilir; guvenli olanlar idempotent.
-- Tercih edilen yol: npm run db:push


-- ===== 20240609_init_foundation.sql =====

-- 20240609_init_foundation.sql â€“ create foundation tables

create schema if not exists public;

-- organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- branches
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- profiles (Supabase Auth users)
create table if not exists public.profiles (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

-- permissions
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

-- role_permissions (many-to-many)
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- staff_branch_assignments
create table if not exists public.staff_branch_assignments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamp with time zone default now(),
  primary key (profile_id, branch_id)
);

-- branch_settings
create table if not exists public.branch_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamp with time zone default now()
);

-- audit_logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id),
  profile_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  payload jsonb,
  created_at timestamp with time zone default now()
);

-- indexes
create index if not exists idx_profiles_org on public.profiles (organization_id);
create index if not exists idx_branches_org on public.branches (organization_id);
create index if not exists idx_staff_branch on public.staff_branch_assignments (branch_id);
create index if not exists idx_audit_org_branch on public.audit_logs (organization_id, branch_id);

-- functions for RLS (placeholders, will be refined later)
create or replace function public.current_user_org_id() returns uuid language sql stable security definer as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.user_has_branch_access(p_branch uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.staff_branch_assignments
    where profile_id = auth.uid() and branch_id = p_branch
  );
$$;

create or replace function public.has_permission(p_permission text, p_branch uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.staff_branch_assignments sba
    join public.role_permissions rp on rp.role_id = sba.role_id
    join public.permissions p on p.id = rp.permission_id
    where sba.profile_id = auth.uid()
      and (sba.branch_id = p_branch or sba.branch_id is null)
      and p.name = p_permission
  );
$$;

-- RLS policies (basic skeleton, to be refined per table)

-- organizations: owners/admins can see their org
create policy org_select on public.organizations for select using (id = public.current_user_org_id());
create policy org_insert on public.organizations for insert with check (auth.role() = 'owner' or auth.role() = 'admin');
create policy org_update on public.organizations for update using (id = public.current_user_org_id()) with check (auth.role() = 'owner' or auth.role() = 'admin');

-- branches: only members of the org can read, branch managers can see assigned branches
create policy branch_select on public.branches for select using (
  organization_id = public.current_user_org_id()
  and (
    public.user_has_branch_access(id) or auth.role() = 'owner' or auth.role() = 'admin'
  )
);
create policy branch_insert on public.branches for insert with check (
  organization_id = public.current_user_org_id() and (auth.role() = 'owner' or auth.role() = 'admin')
);
create policy branch_update on public.branches for update using (
  organization_id = public.current_user_org_id() and (auth.role() = 'owner' or auth.role() = 'admin')
) with check (true);

-- profiles: each user sees their own profile
create policy profile_select on public.profiles for select using (id = auth.uid());
create policy profile_insert on public.profiles for insert with check (id = auth.uid());
create policy profile_update on public.profiles for update using (id = auth.uid());

-- staff_branch_assignments: owners/admins see all, others see their own rows
create policy sba_select on public.staff_branch_assignments for select using (
  auth.role() in ('owner','admin') or profile_id = auth.uid()
);
create policy sba_insert on public.staff_branch_assignments for insert with check (
  auth.role() in ('owner','admin')
);
create policy sba_update on public.staff_branch_assignments for update using (
  auth.role() in ('owner','admin')
);

-- branch_settings: similar to branches
create policy bs_select on public.branch_settings for select using (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner','admin')
);
create policy bs_insert on public.branch_settings for insert with check (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner','admin')
);
create policy bs_update on public.branch_settings for update using (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner','admin')
);

-- audit_logs: owners/admins can read all logs for their org
create policy audit_select on public.audit_logs for select using (
  organization_id = public.current_user_org_id() and (auth.role() in ('owner','admin') or profile_id = auth.uid())
);

-- Enable Row Level Security
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_branch_assignments enable row level security;
alter table public.branch_settings enable row level security;
alter table public.audit_logs enable row level security;


-- ===== 20260609180000_wave1_foundation.sql =====

-- 20260609180000_wave1_foundation.sql

-- 1. Alter organizations table
alter table public.organizations
add column if not exists logo_url text,
add column if not exists timezone text default 'Asia/Manila',
add column if not exists address text,
add column if not exists contact_number text;

-- 2. Alter branches table
alter table public.branches
add column if not exists address text,
add column if not exists contact_number text,
add column if not exists is_active boolean default true;

-- 3. staff_profiles (extends profiles for staff specific info)
create table if not exists public.staff_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text,
  specialization text,
  is_active boolean default true,
  updated_at timestamp with time zone default now()
);

alter table public.staff_profiles enable row level security;
create policy sp_select on public.staff_profiles for select using (
  exists (select 1 from public.profiles p where p.id = staff_profiles.profile_id and p.organization_id = public.current_user_org_id())
);
create policy sp_insert on public.staff_profiles for insert with check (auth.role() in ('owner', 'admin'));
create policy sp_update on public.staff_profiles for update using (auth.role() in ('owner', 'admin') or profile_id = auth.uid());

-- 4. organization_settings
create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  default_timezone text default 'Asia/Manila',
  currency_code text default 'PHP',
  updated_at timestamp with time zone default now()
);

alter table public.organization_settings enable row level security;
create policy os_select on public.organization_settings for select using (
  organization_id = public.current_user_org_id()
);
create policy os_update on public.organization_settings for update using (
  organization_id = public.current_user_org_id() and auth.role() in ('owner', 'admin')
);

-- 5. clinic_hours
create table if not exists public.clinic_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sunday
  open_time time,
  close_time time,
  is_closed boolean default false,
  unique(branch_id, day_of_week)
);

alter table public.clinic_hours enable row level security;
create policy ch_select on public.clinic_hours for select using (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner', 'admin')
);
create policy ch_update on public.clinic_hours for update using (
  public.user_has_branch_access(branch_id) and auth.role() in ('owner', 'admin')
);

-- 6. Seed default roles
insert into public.roles (name, description) values
('owner', 'Organization Owner'),
('admin', 'Clinic Administrator'),
('dentist', 'Dentist / Provider'),
('assistant', 'Dental Assistant'),
('receptionist', 'Front Desk / Receptionist')
on conflict (name) do nothing;


-- ===== 20260609200000_wave1_auth_permissions.sql =====

-- Wave 1: Auth, Roles & Permissions â€” seed + RPC helpers

-- ---------------------------------------------------------------------------
-- Helper: org-wide admin (owner / admin role on any branch assignment)
-- ---------------------------------------------------------------------------
create or replace function public.user_is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_branch_assignments sba
    join public.roles r on r.id = sba.role_id
    where sba.profile_id = auth.uid()
      and r.name in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- has_permission â€” branch-scoped; owner/admin bypass
-- ---------------------------------------------------------------------------
create or replace function public.has_permission(p_permission text, p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_is_org_admin()
    or exists (
      select 1
      from public.staff_branch_assignments sba
      join public.role_permissions rp on rp.role_id = sba.role_id
      join public.permissions p on p.id = rp.permission_id
      where sba.profile_id = auth.uid()
        and sba.branch_id = p_branch
        and p.name = p_permission
    );
$$;

-- ---------------------------------------------------------------------------
-- get_my_permissions(branch_id?) â€” returns permission keys for active branch
-- ---------------------------------------------------------------------------
create or replace function public.get_my_permissions(p_branch_id uuid default null)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.name
  from public.permissions p
  where public.user_is_org_admin()

  union

  select p.name
  from public.staff_branch_assignments sba
  join public.role_permissions rp on rp.role_id = sba.role_id
  join public.permissions p on p.id = rp.permission_id
  where sba.profile_id = auth.uid()
    and p_branch_id is not null
    and sba.branch_id = p_branch_id
    and not public.user_is_org_admin();
$$;

-- ---------------------------------------------------------------------------
-- get_my_branch_ids â€” branch ids the user may access
-- ---------------------------------------------------------------------------
create or replace function public.get_my_branch_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.branches b
  where b.organization_id = public.current_user_org_id()
    and coalesce(b.is_active, true)
    and (
      public.user_is_org_admin()
      or public.user_has_branch_access(b.id)
    );
$$;

-- ---------------------------------------------------------------------------
-- get_my_branches â€” branch list with role for UI
-- ---------------------------------------------------------------------------
create or replace function public.get_my_branches()
returns table (
  id uuid,
  name text,
  organization_id uuid,
  address text,
  contact_number text,
  is_active boolean,
  role_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (b.id)
    b.id,
    b.name,
    b.organization_id,
    b.address,
    b.contact_number,
    coalesce(b.is_active, true),
    coalesce(r.name, 'member')
  from public.branches b
  left join public.staff_branch_assignments sba
    on sba.branch_id = b.id and sba.profile_id = auth.uid()
  left join public.roles r on r.id = sba.role_id
  where b.organization_id = public.current_user_org_id()
    and coalesce(b.is_active, true)
    and (
      public.user_is_org_admin()
      or sba.profile_id is not null
    )
  order by b.id, r.name nulls last;
$$;

-- ---------------------------------------------------------------------------
-- get_branch_context â€” timezone / currency for active branch
-- ---------------------------------------------------------------------------
create or replace function public.get_branch_context(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'branch_id', b.id,
    'branch_name', b.name,
    'organization_id', b.organization_id,
    'timezone', coalesce(os.default_timezone, o.timezone, 'Asia/Manila'),
    'currency_code', coalesce(os.currency_code, 'PHP')
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id
  left join public.organization_settings os on os.organization_id = b.organization_id
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or public.user_has_branch_access(p_branch_id)
    );
$$;

-- ---------------------------------------------------------------------------
-- session_audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.session_audit_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  event_type text not null check (event_type in ('login', 'logout')),
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

alter table public.session_audit_logs enable row level security;

create policy session_audit_select on public.session_audit_logs
  for select using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

create policy session_audit_insert on public.session_audit_logs
  for insert with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed permissions (docs/08_BACKEND_ARCHITECTURE.md)
-- ---------------------------------------------------------------------------
insert into public.permissions (name, description) values
  ('patients.read', 'View patient registry'),
  ('patients.write', 'Create and update patients'),
  ('patients.medical_history.read', 'View medical history'),
  ('patients.medical_history.write', 'Update medical history'),
  ('consents.manage', 'Manage consent forms'),
  ('dental_chart.read', 'View dental chart'),
  ('dental_chart.write', 'Edit dental chart'),
  ('appointments.read', 'View appointments'),
  ('appointments.write', 'Manage appointments'),
  ('queue.manage', 'Manage check-in queue'),
  ('billing.read', 'View invoices and payments'),
  ('billing.write', 'Create invoices and record payments'),
  ('hmo.read', 'View HMO claims'),
  ('hmo.write', 'Manage HMO claims'),
  ('staff.manage', 'Manage staff and assignments'),
  ('settings.manage', 'Manage org and branch settings'),
  ('audit.read', 'View audit logs')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Seed role_permissions
-- ---------------------------------------------------------------------------
-- owner + admin â†’ all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('owner', 'admin')
on conflict do nothing;

-- dentist
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'dentist'
  and p.name in (
    'patients.read', 'patients.write',
    'patients.medical_history.read', 'patients.medical_history.write',
    'consents.manage',
    'dental_chart.read', 'dental_chart.write',
    'appointments.read', 'appointments.write',
    'billing.read'
  )
on conflict do nothing;

-- assistant
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'assistant'
  and p.name in (
    'patients.read',
    'dental_chart.read', 'dental_chart.write',
    'appointments.read'
  )
on conflict do nothing;

-- receptionist
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'receptionist'
  and p.name in (
    'patients.read', 'patients.write',
    'appointments.read', 'appointments.write',
    'queue.manage',
    'billing.read'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS: profiles org read for admins; roles/permissions readable
-- ---------------------------------------------------------------------------
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles
  for select using (
    id = auth.uid()
    or (
      organization_id = public.current_user_org_id()
      and public.user_is_org_admin()
    )
  );

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated using (true);

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated using (true);

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (true);


-- ===== 20260609220000_patients_and_bootstrap.sql =====

-- Module 05: Patient Registry

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text,
  phone text,
  email text,
  address text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.patient_contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  contact_type text not null default 'emergency',
  name text not null,
  phone text,
  relationship text,
  created_at timestamptz default now()
);

create table if not exists public.patient_branch_links (
  patient_id uuid not null references public.patients(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  primary key (patient_id, branch_id)
);

create index if not exists idx_patients_org on public.patients(organization_id);
create index if not exists idx_patients_phone on public.patients(organization_id, phone);
create index if not exists idx_patients_name on public.patients(organization_id, last_name, first_name);

alter table public.patients enable row level security;
alter table public.patient_contacts enable row level security;
alter table public.patient_branch_links enable row level security;

create policy patients_select on public.patients for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('patients.read', (
    select pbl.branch_id from public.patient_branch_links pbl
    where pbl.patient_id = patients.id limit 1
  ))
);

create policy patients_insert on public.patients for insert with check (
  organization_id = public.current_user_org_id()
);

create policy patients_update on public.patients for update using (
  organization_id = public.current_user_org_id()
);

create policy patient_contacts_all on public.patient_contacts for all using (
  exists (
    select 1 from public.patients p
    where p.id = patient_contacts.patient_id
      and p.organization_id = public.current_user_org_id()
  )
);

create policy patient_branch_links_all on public.patient_branch_links for all using (
  exists (
    select 1 from public.patients p
    where p.id = patient_branch_links.patient_id
      and p.organization_id = public.current_user_org_id()
  )
);

create or replace function public.search_patients(p_query text, p_branch_id uuid default null)
returns table (
  id uuid, first_name text, last_name text, phone text, email text,
  status text, last_visit_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.first_name, p.last_name, p.phone, p.email, p.status, pbl.last_visit_at
  from public.patients p
  left join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
  where p.organization_id = public.current_user_org_id()
    and p.status = 'active'
    and (
      p_query is null or p_query = ''
      or p.first_name ilike '%' || p_query || '%'
      or p.last_name ilike '%' || p_query || '%'
      or p.phone ilike '%' || p_query || '%'
    )
  order by p.last_name, p.first_name
  limit 50;
$$;

-- Bootstrap: first authenticated user creates org + branch + owner assignment
create or replace function public.bootstrap_clinic(
  p_org_name text,
  p_branch_name text default 'Main Clinic'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_owner_role_id uuid;
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

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

  return jsonb_build_object(
    'status', 'created',
    'organization_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;


-- ===== 20260609230000_wave2_clinical_ops.sql =====

-- Wave 2: Audit logs, medical history, consents, appointments (MVP)

-- General audit log (separate from session login/logout)
create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.organization_audit_logs enable row level security;

create policy org_audit_select on public.organization_audit_logs for select using (
  organization_id = public.current_user_org_id() and public.user_is_org_admin()
);

create policy org_audit_insert on public.organization_audit_logs for insert with check (
  organization_id = public.current_user_org_id() and profile_id = auth.uid()
);

-- Medical history (versioned snapshot MVP)
create table if not exists public.patient_medical_histories (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null default 1,
  allergies jsonb default '[]'::jsonb,
  medications jsonb default '[]'::jsonb,
  conditions jsonb default '[]'::jsonb,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_medical_history_patient on public.patient_medical_histories(patient_id, version desc);

alter table public.patient_medical_histories enable row level security;

create policy medical_history_select on public.patient_medical_histories for select using (
  organization_id = public.current_user_org_id()
);

create policy medical_history_insert on public.patient_medical_histories for insert with check (
  organization_id = public.current_user_org_id()
);

-- Consent forms
create table if not exists public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  body text not null,
  version text not null default '1.0',
  is_active boolean default true,
  unique(organization_id, slug)
);

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  template_slug text not null,
  template_name text not null,
  status text not null default 'pending' check (status in ('pending', 'signed', 'voided')),
  signed_at timestamptz,
  signed_by uuid references public.profiles(id),
  signature_data text,
  created_at timestamptz default now(),
  unique(patient_id, template_slug)
);

alter table public.consent_templates enable row level security;
alter table public.patient_consents enable row level security;

create policy consent_templates_select on public.consent_templates for select using (
  organization_id is null or organization_id = public.current_user_org_id()
);

create policy patient_consents_all on public.patient_consents for all using (
  organization_id = public.current_user_org_id()
);

-- Appointments MVP
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  provider_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer default 30,
  purpose text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_appointments_branch_date on public.appointments(branch_id, scheduled_at);

alter table public.appointments enable row level security;

create policy appointments_select on public.appointments for select using (
  organization_id = public.current_user_org_id()
);

create policy appointments_insert on public.appointments for insert with check (
  organization_id = public.current_user_org_id()
);

create policy appointments_update on public.appointments for update using (
  organization_id = public.current_user_org_id()
);

-- Dashboard stats RPC
create or replace function public.get_dashboard_stats(p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public.current_user_org_id();
declare v_patients bigint; v_today_appts bigint; v_pending_consents bigint;
begin
  select count(*) into v_patients from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and a.scheduled_at::date = current_date
    and a.status in ('scheduled', 'confirmed');

  select count(*) into v_pending_consents from public.patient_consents pc
  where pc.organization_id = v_org and pc.status = 'pending'
    and (p_branch_id is null or pc.branch_id = p_branch_id);

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents
  );
end; $$;

-- Staff list RPC
create or replace function public.get_org_staff()
returns table (
  profile_id uuid, full_name text, email text, is_active boolean,
  role_name text, branch_names text[]
) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, coalesce(sp.is_active, true),
    coalesce(max(r.name), 'staff'),
    array_agg(distinct b.name order by b.name)
  from public.profiles p
  left join public.staff_profiles sp on sp.profile_id = p.id
  left join public.staff_branch_assignments sba on sba.profile_id = p.id
  left join public.roles r on r.id = sba.role_id
  left join public.branches b on b.id = sba.branch_id
  where p.organization_id = public.current_user_org_id()
  group by p.id, p.full_name, p.email, sp.is_active
  order by p.full_name;
$$;

-- Seed global consent templates
insert into public.consent_templates (organization_id, slug, name, body, version) values
(null, 'dpa-consent', 'Data Privacy Act (DPA) Consent',
 'I consent to the collection, use, and processing of my personal and health information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).', '2.1'),
(null, 'general-treatment', 'General Treatment Consent',
 'I consent to dental examination, diagnosis, and treatment as recommended by my dental provider.', '1.0'),
(null, 'ortho-agreement', 'Orthodontic Agreement',
 'I understand that orthodontic treatment involves braces or aligners. Risks include decay, root resorption, and relapse if retainers are not worn.', '1.2')
on conflict do nothing;

-- Default clinic hours for branches without hours
create or replace function public.ensure_branch_clinic_hours(p_branch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d integer;
begin
  for d in 0..6 loop
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values (p_branch_id, d,
      case when d in (0, 6) then null else '09:00'::time end,
      case when d in (0, 6) then null else '18:00'::time end,
      d in (0, 6))
    on conflict (branch_id, day_of_week) do nothing;
  end loop;
end; $$;


-- ===== 20260609240000_wave3_billing_clinical.sql =====

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


-- ===== 20260609250000_invoice_payments.sql =====

-- Wave 4: Invoice payments ledger

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_invoice_payments_invoice on public.invoice_payments(invoice_id);

alter table public.invoice_payments enable row level security;

create policy invoice_payments_org on public.invoice_payments for all using (
  organization_id = public.current_user_org_id()
);

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv record;
  v_new_paid numeric;
  v_new_status text;
  v_org uuid := public.current_user_org_id();
begin
  select * into v_inv from public.invoices
  where id = p_invoice_id and organization_id = v_org;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  v_new_paid := coalesce(v_inv.paid_amount, 0) + p_amount;

  if v_new_paid >= v_inv.total_amount then
    v_new_status := 'paid';
    v_new_paid := v_inv.total_amount;
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := v_inv.status;
  end if;

  insert into public.invoice_payments (invoice_id, organization_id, amount, payment_method, notes, recorded_by)
  values (p_invoice_id, v_org, p_amount, p_payment_method, p_notes, auth.uid());

  update public.invoices
  set paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  where id = p_invoice_id;

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'status', v_new_status,
    'balance', v_inv.total_amount - v_new_paid
  );
end;
$$;


-- ===== 20260609260000_search_patients_pagination.sql =====

-- Pagination + total count for patient search
create or replace function public.search_patients(
  p_query text,
  p_branch_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  email text,
  status text,
  last_visit_at timestamptz,
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.phone,
    p.email,
    p.status,
    pbl.last_visit_at,
    count(*) over() as total_count
  from public.patients p
  left join public.patient_branch_links pbl
    on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
  where p.organization_id = public.current_user_org_id()
    and p.status = 'active'
    and (
      p_query is null or p_query = ''
      or p.first_name ilike '%' || p_query || '%'
      or p.last_name ilike '%' || p_query || '%'
      or p.phone ilike '%' || p_query || '%'
    )
  order by p.last_name, p.first_name
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;


-- ===== 20260609270000_clinical_notes.sql =====

-- Wave 5: Clinical notes & patient timeline (MVP)

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null default 'Clinical Note',
  subjective text,
  objective text,
  assessment text,
  plan text,
  body text,
  status text not null default 'draft' check (status in ('draft', 'signed')),
  version integer not null default 1,
  signed_at timestamptz,
  signed_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clinical_notes_patient on public.clinical_notes(patient_id, created_at desc);

create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.clinical_notes(id) on delete cascade,
  version integer not null,
  content jsonb not null default '{}'::jsonb,
  signed_by uuid references public.profiles(id),
  signed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.clinical_notes enable row level security;
alter table public.note_versions enable row level security;

create policy clinical_notes_select on public.clinical_notes for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

create policy clinical_notes_insert on public.clinical_notes for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

create policy clinical_notes_update on public.clinical_notes for update using (
  organization_id = public.current_user_org_id()
  and status = 'draft'
  and public.has_permission('dental_chart.write', branch_id)
);

create policy note_versions_select on public.note_versions for select using (
  exists (
    select 1 from public.clinical_notes cn
    where cn.id = note_id
      and cn.organization_id = public.current_user_org_id()
      and public.has_permission('dental_chart.read', cn.branch_id)
  )
);

create policy note_versions_insert on public.note_versions for insert with check (
  exists (
    select 1 from public.clinical_notes cn
    where cn.id = note_id
      and cn.organization_id = public.current_user_org_id()
      and public.has_permission('dental_chart.write', cn.branch_id)
  )
);

-- Sign note: snapshot version + lock
create or replace function public.sign_clinical_note(p_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.clinical_notes%rowtype;
begin
  select * into v_note
  from public.clinical_notes
  where id = p_note_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Note not found';
  end if;

  if v_note.status = 'signed' then
    return jsonb_build_object('status', 'already_signed');
  end if;

  if not public.has_permission('dental_chart.write', v_note.branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.note_versions (note_id, version, content, signed_by, signed_at)
  values (
    v_note.id,
    v_note.version,
    jsonb_build_object(
      'title', v_note.title,
      'subjective', v_note.subjective,
      'objective', v_note.objective,
      'assessment', v_note.assessment,
      'plan', v_note.plan,
      'body', v_note.body
    ),
    auth.uid(),
    now()
  );

  update public.clinical_notes
  set status = 'signed',
      signed_at = now(),
      signed_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_note_id;

  return jsonb_build_object('status', 'signed', 'note_id', p_note_id);
end;
$$;

-- Patient timeline: notes + appointments
create or replace function public.get_patient_timeline(p_patient_id uuid)
returns table (
  event_type text,
  event_id uuid,
  occurred_at timestamptz,
  title text,
  subtitle text,
  status text,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select
      'clinical_note'::text as event_type,
      cn.id as event_id,
      coalesce(cn.signed_at, cn.created_at) as occurred_at,
      cn.title,
      coalesce(
        nullif(trim(concat_ws(' â€” ', cn.assessment, cn.plan)), ''),
        left(coalesce(cn.body, cn.subjective, ''), 120)
      ) as subtitle,
      cn.status,
      jsonb_build_object(
        'branch_id', cn.branch_id,
        'version', cn.version,
        'signed', cn.status = 'signed'
      ) as metadata
    from public.clinical_notes cn
    where cn.patient_id = p_patient_id
      and cn.organization_id = public.current_user_org_id()

    union all

    select
      'appointment'::text,
      a.id,
      a.scheduled_at,
      coalesce(a.purpose, 'Appointment'),
      a.notes,
      a.status,
      jsonb_build_object('branch_id', a.branch_id, 'duration_minutes', a.duration_minutes)
    from public.appointments a
    where a.patient_id = p_patient_id
      and a.organization_id = public.current_user_org_id()
  ) timeline
  order by timeline.occurred_at desc nulls last;
$$;


-- ===== 20260609280000_branch_procedure_prices.sql =====

-- Branch-level procedure price overrides

create table if not exists public.branch_procedure_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  price_override numeric(12,2) not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now(),
  unique (branch_id, procedure_id)
);

create index if not exists idx_branch_procedure_prices_branch on public.branch_procedure_prices(branch_id);

alter table public.branch_procedure_prices enable row level security;

create policy branch_procedure_prices_org on public.branch_procedure_prices for all using (
  organization_id = public.current_user_org_id()
);

-- Effective price for a procedure at a branch (override or base)
create or replace function public.get_procedure_effective_price(
  p_procedure_id uuid,
  p_branch_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select bpp.price_override
      from public.branch_procedure_prices bpp
      where bpp.procedure_id = p_procedure_id
        and bpp.branch_id = p_branch_id
        and bpp.organization_id = public.current_user_org_id()
    ),
    (
      select p.base_price
      from public.procedures p
      where p.id = p_procedure_id
        and p.organization_id = public.current_user_org_id()
    )
  );
$$;


-- ===== 20260609290000_staff_invitations.sql =====

-- Staff email invitations (accepted on first login via accept_staff_invitation)

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create unique index if not exists idx_staff_invitations_pending_email
  on public.staff_invitations (organization_id, lower(email))
  where status = 'pending';

alter table public.staff_invitations enable row level security;

create policy staff_invitations_select on public.staff_invitations for select using (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

create policy staff_invitations_insert on public.staff_invitations for insert with check (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

create policy staff_invitations_update on public.staff_invitations for update using (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

-- Accept pending invite for the authenticated user (called after magic link / invite login)
create or replace function public.accept_staff_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_inv public.staff_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  select * into v_inv
  from public.staff_invitations
  where lower(email) = lower(v_email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('status', 'no_invitation');
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, organization_id, email, full_name)
    values (
      v_user_id,
      v_inv.organization_id,
      v_email,
      coalesce(v_inv.full_name, split_part(v_email, '@', 1))
    );
    insert into public.staff_profiles (profile_id, is_active)
    values (v_user_id, true);
  else
    update public.profiles
    set organization_id = v_inv.organization_id,
        full_name = coalesce(full_name, v_inv.full_name)
    where id = v_user_id;
  end if;

  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
  values (v_user_id, v_inv.branch_id, v_inv.role_id)
  on conflict (profile_id, branch_id) do update set role_id = excluded.role_id;

  update public.staff_invitations
  set status = 'accepted'
  where id = v_inv.id;

  return jsonb_build_object(
    'status', 'accepted',
    'organization_id', v_inv.organization_id,
    'branch_id', v_inv.branch_id
  );
end;
$$;


-- ===== 20260609300000_waitlist.sql =====

-- Module 14: Waitlist (branch-scoped, appointment conversion)

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'contacted', 'booked', 'cancelled', 'expired')),
  urgency text not null default 'normal'
    check (urgency in ('normal', 'urgent', 'high')),
  preferred_date date,
  preferred_time_start time,
  preferred_time_end time,
  notes text,
  appointment_id uuid references public.appointments(id) on delete set null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_waitlist_branch_status
  on public.waitlist_entries(branch_id, status, created_at);

create table if not exists public.waitlist_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  waitlist_entry_id uuid not null references public.waitlist_entries(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  note text,
  outcome text not null default 'reached'
    check (outcome in ('reached', 'no_answer', 'voicemail', 'declined', 'other')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_contact_entry
  on public.waitlist_contact_attempts(waitlist_entry_id, created_at desc);

alter table public.waitlist_entries enable row level security;
alter table public.waitlist_contact_attempts enable row level security;

create policy waitlist_entries_select on public.waitlist_entries
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy waitlist_entries_insert on public.waitlist_entries
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

create policy waitlist_entries_update on public.waitlist_entries
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

create policy waitlist_contact_select on public.waitlist_contact_attempts
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy waitlist_contact_insert on public.waitlist_contact_attempts
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

-- Mark patient as contacted + log attempt
create or replace function public.mark_waitlist_contacted(
  p_entry_id uuid,
  p_note text default null,
  p_outcome text default 'reached'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be contacted in status %', v_entry.status;
  end if;

  insert into public.waitlist_contact_attempts (
    waitlist_entry_id, organization_id, branch_id, note, outcome, created_by
  ) values (
    v_entry.id, v_entry.organization_id, v_entry.branch_id, p_note, p_outcome, auth.uid()
  );

  update public.waitlist_entries
  set status = case when p_outcome = 'declined' then 'cancelled' else 'contacted' end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('id', p_entry_id, 'status', case when p_outcome = 'declined' then 'cancelled' else 'contacted' end);
end;
$$;

-- Book appointment from waitlist entry
create or replace function public.book_waitlist_entry(
  p_entry_id uuid,
  p_scheduled_at timestamptz,
  p_purpose text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_appt_id uuid;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be booked in status %', v_entry.status;
  end if;

  insert into public.appointments (
    organization_id, branch_id, patient_id, scheduled_at, purpose, created_by
  ) values (
    v_entry.organization_id, v_entry.branch_id, v_entry.patient_id,
    p_scheduled_at, coalesce(p_purpose, v_entry.notes), auth.uid()
  )
  returning id into v_appt_id;

  update public.waitlist_entries
  set status = 'booked',
      appointment_id = v_appt_id,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('entry_id', p_entry_id, 'appointment_id', v_appt_id);
end;
$$;

-- Expire stale entries (callable from cron or admin)
create or replace function public.expire_old_waitlist_entries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.waitlist_entries
  set status = 'expired',
      updated_at = now()
  where status in ('waiting', 'contacted')
    and expires_at is not null
    and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_waitlist_contacted(uuid, text, text) to authenticated;
grant execute on function public.book_waitlist_entry(uuid, timestamptz, text) to authenticated;
grant execute on function public.expire_old_waitlist_entries() to authenticated;


-- ===== 20260609310000_queue_entries.sql =====

-- Module 15: Check-in queue board

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  display_code text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled')),
  chair_label text,
  notes text,
  checked_in_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_queue_branch_status
  on public.queue_entries(branch_id, status, checked_in_at);

alter table public.queue_entries enable row level security;

create policy queue_entries_select on public.queue_entries
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy queue_entries_insert on public.queue_entries
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

create policy queue_entries_update on public.queue_entries
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

create or replace function public._next_queue_display_code(p_branch_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_num integer;
begin
  select count(*) + 1 into v_num
  from public.queue_entries
  where branch_id = p_branch_id
    and checked_in_at::date = (now() at time zone 'Asia/Manila')::date;

  return 'Q' || lpad(v_num::text, 3, '0');
end;
$$;

create or replace function public.check_in_patient(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_appointment_id uuid := nullif(p_payload->>'appointment_id', '')::uuid;
  v_notes text := nullif(p_payload->>'notes', '');
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if not public.has_permission('queue.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  v_code := public._next_queue_display_code(v_branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_org, v_branch_id, v_patient_id, v_appointment_id,
    v_code, v_notes, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'display_code', v_code, 'status', 'waiting');
end;
$$;

create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    raise exception 'Queue entry not found';
  end if;

  if not public.has_permission('queue.manage', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status not in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  update public.queue_entries
  set status = p_status,
      chair_label = coalesce(p_chair_label, chair_label),
      called_at = case when p_status = 'now_serving' and called_at is null then now() else called_at end,
      completed_at = case when p_status = 'served' then now() else completed_at end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('id', p_entry_id, 'status', p_status);
end;
$$;

create or replace function public.call_next_patient(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_code text;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select id, display_code into v_entry_id, v_code
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('waiting', 'ready')
  order by checked_in_at asc
  limit 1
  for update skip locked;

  if v_entry_id is null then
    return jsonb_build_object('found', false);
  end if;

  update public.queue_entries
  set status = 'now_serving',
      called_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_entry_id;

  return jsonb_build_object('found', true, 'id', v_entry_id, 'display_code', v_code);
end;
$$;

grant execute on function public.check_in_patient(jsonb) to authenticated;
grant execute on function public.update_queue_status(uuid, text, text) to authenticated;
grant execute on function public.call_next_patient(uuid) to authenticated;


-- ===== 20260609320000_kiosk_display_tokens.sql =====

-- Module 16â€“17: Kiosk + TV display public tokens

create table if not exists public.branch_public_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  token_type text not null check (token_type in ('kiosk', 'display')),
  label text,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_branch_public_tokens_branch
  on public.branch_public_tokens(branch_id, token_type, is_active);

create table if not exists public.kiosk_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  token_id uuid not null references public.branch_public_tokens(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kiosk_sessions_expires on public.kiosk_sessions(expires_at);

alter table public.branch_public_tokens enable row level security;
alter table public.kiosk_sessions enable row level security;

create policy branch_public_tokens_staff on public.branch_public_tokens
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

-- Staff: generate token
create or replace function public.generate_branch_public_token(
  p_branch_id uuid,
  p_token_type text,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_token text;
  v_id uuid;
begin
  if p_token_type not in ('kiosk', 'display') then
    raise exception 'Invalid token type';
  end if;

  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.branch_public_tokens (
    organization_id, branch_id, token_type, label, created_by
  ) values (
    v_org, p_branch_id, p_token_type, p_label, auth.uid()
  )
  returning id, token into v_id, v_token;

  return jsonb_build_object('id', v_id, 'token', v_token, 'token_type', p_token_type);
end;
$$;

-- Anon: open kiosk session
create or replace function public.create_kiosk_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_session_id uuid;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'kiosk'
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid or expired kiosk link';
  end if;

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  insert into public.kiosk_sessions (organization_id, branch_id, token_id, expires_at)
  values (v_t.organization_id, v_t.branch_id, v_t.id, now() + interval '30 minutes')
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'expires_at', (now() + interval '30 minutes')
  );
end;
$$;

-- Anon: patient self check-in via kiosk
create or replace function public.submit_kiosk_checkin(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_code text;
  v_entry_id uuid;
  v_phone_norm text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please check with the front desk.';
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_session.branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'You are already checked in. Please wait to be called.';
  end if;

  v_code := public._next_queue_display_code(v_session.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, display_code, notes
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, v_code, 'Kiosk check-in'
  )
  returning id into v_entry_id;

  return jsonb_build_object('entry_id', v_entry_id, 'display_code', v_code);
end;
$$;

-- Anon: TV queue display (codes only â€” no PHI)
create or replace function public.get_public_queue_display(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_now_serving jsonb;
  v_waiting jsonb;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'display'
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid display link';
  end if;

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  select coalesce(jsonb_agg(jsonb_build_object('display_code', display_code) order by called_at nulls last), '[]'::jsonb)
  into v_now_serving
  from public.queue_entries
  where branch_id = v_t.branch_id and status = 'now_serving';

  select coalesce(jsonb_agg(jsonb_build_object('display_code', display_code) order by checked_in_at), '[]'::jsonb)
  into v_waiting
  from public.queue_entries
  where branch_id = v_t.branch_id and status in ('waiting', 'ready');

  return jsonb_build_object(
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;

grant execute on function public.generate_branch_public_token(uuid, text, text) to authenticated;
grant execute on function public.create_kiosk_session(text) to anon, authenticated;
grant execute on function public.submit_kiosk_checkin(uuid, text, text) to anon, authenticated;
grant execute on function public.get_public_queue_display(text) to anon, authenticated;


-- ===== 20260609330000_notifications.sql =====

-- Module 18: Notification templates + logs (SMS MVP, dry-run default)

insert into public.permissions (name, description) values
  ('notifications.read', 'View notification templates and logs'),
  ('notifications.write', 'Edit templates and send test messages')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.name in ('notifications.read', 'notifications.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'receptionist'
  and p.name = 'notifications.read'
on conflict do nothing;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  template_key text not null,
  name text not null,
  channel text not null default 'sms' check (channel in ('sms', 'email')),
  body text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_notification_templates_key
  on public.notification_templates(organization_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), template_key);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  template_id uuid references public.notification_templates(id) on delete set null,
  template_key text,
  recipient_phone text,
  body_preview text not null,
  status text not null default 'dry_run'
    check (status in ('dry_run', 'queued', 'sent', 'failed', 'delivered')),
  error_message text,
  provider_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_logs_branch
  on public.notification_logs(branch_id, created_at desc);

create table if not exists public.notification_branch_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dry_run_mode boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_templates enable row level security;
alter table public.notification_logs enable row level security;
alter table public.notification_branch_settings enable row level security;

create policy notification_templates_select on public.notification_templates
  for select to authenticated using (
    organization_id = public.current_user_org_id()
  );

create policy notification_templates_insert on public.notification_templates
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
  );

create policy notification_templates_update on public.notification_templates
  for update to authenticated using (
    organization_id = public.current_user_org_id()
  );

create policy notification_logs_select on public.notification_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (branch_id is null or public.user_has_branch_access(branch_id))
  );

create policy notification_logs_insert on public.notification_logs
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
  );

create policy notification_branch_settings_all on public.notification_branch_settings
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('notifications.write', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('notifications.write', branch_id)
  );

-- Seed default templates for an org
create or replace function public.seed_notification_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.notification_templates where organization_id = p_org_id limit 1) then
    return;
  end if;

  insert into public.notification_templates (organization_id, template_key, name, body) values
    (p_org_id, 'appointment_reminder',
     'Appointment reminder',
     'Hi {{patient_name}}, reminder: your appointment at {{clinic_name}} is on {{appointment_date}} at {{appointment_time}}.'),
    (p_org_id, 'waitlist_slot',
     'Waitlist slot available',
     'Hi {{patient_name}}, a slot opened at {{clinic_name}}. Please call us to confirm your appointment.'),
    (p_org_id, 'payment_reminder',
     'Payment reminder',
     'Hi {{patient_name}}, you have an outstanding balance of {{amount}} at {{clinic_name}}. Thank you.'),
    (p_org_id, 'queue_called',
     'Queue called',
     '{{clinic_name}}: Queue number {{queue_code}} â€” please proceed to the front desk.');
end;
$$;

-- Render {{var}} placeholders
create or replace function public._render_notification_body(p_body text, p_vars jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_result text := p_body;
  v_key text;
  v_val text;
begin
  for v_key, v_val in select * from jsonb_each_text(coalesce(p_vars, '{}'::jsonb))
  loop
    v_result := replace(v_result, '{{' || v_key || '}}', v_val);
  end loop;
  return v_result;
end;
$$;

create or replace function public.send_test_notification(
  p_template_id uuid,
  p_phone text,
  p_variables jsonb default '{}'::jsonb,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tpl public.notification_templates%rowtype;
  v_branch_id uuid := p_branch_id;
  v_dry_run boolean := true;
  v_body text;
  v_log_id uuid;
  v_status text;
begin
  select * into v_tpl from public.notification_templates where id = p_template_id;
  if not found then
    raise exception 'Template not found';
  end if;

  v_branch_id := coalesce(p_branch_id, v_tpl.branch_id);
  if v_branch_id is null then
    select id into v_branch_id from public.branches
    where organization_id = v_tpl.organization_id and is_active = true
    order by created_at limit 1;
  end if;

  if not public.has_permission('notifications.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(nbs.dry_run_mode, true) into v_dry_run
  from public.notification_branch_settings nbs
  where nbs.branch_id = v_branch_id;

  if not found then
    v_dry_run := true;
  end if;

  v_body := public._render_notification_body(v_tpl.body, p_variables);
  v_status := case when v_dry_run then 'dry_run' else 'queued' end;

  insert into public.notification_logs (
    organization_id, branch_id, template_id, template_key,
    recipient_phone, body_preview, status, created_by
  ) values (
    v_tpl.organization_id, v_branch_id, v_tpl.id, v_tpl.template_key,
    p_phone, v_body, v_status, auth.uid()
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'log_id', v_log_id,
    'status', v_status,
    'dry_run', v_dry_run,
    'body_preview', v_body
  );
end;
$$;

create or replace function public.get_notification_status(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dry_run boolean := true;
  v_sent bigint;
  v_failed bigint;
  v_dry bigint;
begin
  if not public.has_permission('notifications.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(nbs.dry_run_mode, true) into v_dry_run
  from public.notification_branch_settings nbs where nbs.branch_id = p_branch_id;

  select count(*) into v_sent from public.notification_logs
  where branch_id = p_branch_id and status in ('sent', 'delivered')
    and created_at >= (now() at time zone 'Asia/Manila')::date;

  select count(*) into v_failed from public.notification_logs
  where branch_id = p_branch_id and status = 'failed'
    and created_at >= (now() at time zone 'Asia/Manila')::date;

  select count(*) into v_dry from public.notification_logs
  where branch_id = p_branch_id and status = 'dry_run'
    and created_at >= (now() at time zone 'Asia/Manila')::date;

  return jsonb_build_object(
    'dry_run_mode', coalesce(v_dry_run, true),
    'sent_today', v_sent,
    'failed_today', v_failed,
    'dry_run_today', v_dry
  );
end;
$$;

grant execute on function public.seed_notification_templates(uuid) to authenticated;
grant execute on function public.send_test_notification(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.get_notification_status(uuid) to authenticated;

-- Seed templates for existing orgs
do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations
  loop
    perform public.seed_notification_templates(v_org);
  end loop;
end;
$$;


-- ===== 20260609340000_ortho_records.sql =====

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


-- ===== 20260609350000_hmo_claims.sql =====

-- Module 21: HMO claims

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin') and p.name in ('hmo.read', 'hmo.write')
on conflict do nothing;

create table if not exists public.hmo_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hmo_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  provider_id uuid references public.hmo_providers(id) on delete set null,
  claim_number text,
  member_id text,
  claimed_amount numeric(12, 2) not null,
  approved_amount numeric(12, 2),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid')),
  rejection_reason text,
  payment_ref text,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hmo_claims_branch on public.hmo_claims(branch_id, status, created_at desc);

alter table public.hmo_providers enable row level security;
alter table public.hmo_claims enable row level security;

create policy hmo_providers_select on public.hmo_providers
  for select to authenticated using (organization_id = public.current_user_org_id());

create policy hmo_claims_select on public.hmo_claims
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('hmo.read', branch_id)
  );

create policy hmo_claims_write on public.hmo_claims
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('hmo.write', branch_id)
  )
  with check (organization_id = public.current_user_org_id() and public.has_permission('hmo.write', branch_id));

create or replace function public.seed_hmo_providers(p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.hmo_providers where organization_id = p_org_id limit 1) then return; end if;
  insert into public.hmo_providers (organization_id, name, code) values
    (p_org_id, 'Maxicare', 'MAX'), (p_org_id, 'Intellicare', 'INT'), (p_org_id, 'Medicard', 'MED'), (p_org_id, 'Avega', 'AVG');
end; $$;

create or replace function public.submit_hmo_claim(p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  if v.status <> 'draft' then raise exception 'Only draft claims can be submitted'; end if;
  update public.hmo_claims set status = 'submitted', submitted_at = now(), updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'submitted');
end; $$;

create or replace function public.approve_hmo_claim(p_claim_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  update public.hmo_claims set status = 'approved', approved_amount = p_amount, updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'approved');
end; $$;

create or replace function public.reject_hmo_claim(p_claim_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  update public.hmo_claims set status = 'rejected', rejection_reason = p_reason, updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'rejected');
end; $$;

create or replace function public.mark_hmo_claim_paid(p_claim_id uuid, p_payment_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  if v.status <> 'approved' then raise exception 'Only approved claims can be marked paid'; end if;
  update public.hmo_claims set status = 'paid', payment_ref = p_payment_ref, paid_at = now(), updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'paid');
end; $$;

grant execute on function public.seed_hmo_providers(uuid) to authenticated;
grant execute on function public.submit_hmo_claim(uuid) to authenticated;
grant execute on function public.approve_hmo_claim(uuid, numeric) to authenticated;
grant execute on function public.reject_hmo_claim(uuid, text) to authenticated;
grant execute on function public.mark_hmo_claim_paid(uuid, text) to authenticated;

do $$ declare v_org uuid; begin
  for v_org in select id from public.organizations loop perform public.seed_hmo_providers(v_org); end loop;
end; $$;


-- ===== 20260609360000_philhealth_stub.sql =====

-- Module 22: PhilHealth eClaims readiness stub

create table if not exists public.philhealth_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  philhealth_id text,
  case_rate_code text,
  status text not null default 'draft'
    check (status in ('draft', 'checklist_incomplete', 'ready', 'submitted', 'sync_failed', 'acknowledged')),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.philhealth_sync_logs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.philhealth_claims(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('pending', 'success', 'failed')),
  response_summary text,
  created_at timestamptz not null default now()
);

alter table public.philhealth_claims enable row level security;
alter table public.philhealth_sync_logs enable row level security;

create policy philhealth_claims_all on public.philhealth_claims
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

create policy philhealth_sync_select on public.philhealth_sync_logs
  for select to authenticated using (organization_id = public.current_user_org_id());

create policy philhealth_sync_insert on public.philhealth_sync_logs
  for insert to authenticated with check (organization_id = public.current_user_org_id());

create or replace function public.queue_philhealth_sync(p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.philhealth_claims%rowtype;
declare v_log_id uuid;
begin
  select * into v from public.philhealth_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if v.status <> 'ready' then raise exception 'Claim must pass readiness checklist first'; end if;

  insert into public.philhealth_sync_logs (claim_id, organization_id, status, response_summary)
  values (p_claim_id, v.organization_id, 'pending', 'Queued for eClaims sync (stub â€” no live API yet)')
  returning id into v_log_id;

  update public.philhealth_claims set status = 'submitted', updated_at = now() where id = p_claim_id;

  return jsonb_build_object('sync_log_id', v_log_id, 'status', 'submitted');
end; $$;

grant execute on function public.queue_philhealth_sync(uuid) to authenticated;


-- ===== 20260609370000_inventory.sql =====

-- Module 23: Inventory & supplies

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  unit text default 'pc',
  quantity_on_hand numeric(12, 2) not null default 0,
  min_stock_level numeric(12, 2) not null default 0,
  expiry_date date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity numeric(12, 2) not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_branch on public.inventory_items(branch_id, is_active);
create index if not exists idx_inventory_movements_item on public.inventory_movements(item_id, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy inventory_items_all on public.inventory_items
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy inventory_movements_insert on public.inventory_movements
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('settings.manage', branch_id)
  );

create or replace function public.adjust_inventory_stock(
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item public.inventory_items%rowtype;
declare v_delta numeric;
declare v_new_qty numeric;
begin
  select * into v_item from public.inventory_items where id = p_item_id;
  if not found then raise exception 'Item not found'; end if;
  if not public.has_permission('settings.manage', v_item.branch_id) then raise exception 'Permission denied'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  v_delta := case p_movement_type when 'out' then -p_quantity else p_quantity end;
  v_new_qty := v_item.quantity_on_hand + v_delta;
  if v_new_qty < 0 then raise exception 'Insufficient stock'; end if;

  insert into public.inventory_movements (organization_id, branch_id, item_id, movement_type, quantity, notes, created_by)
  values (v_item.organization_id, v_item.branch_id, p_item_id, p_movement_type, p_quantity, p_notes, auth.uid());

  update public.inventory_items set quantity_on_hand = v_new_qty, updated_at = now() where id = p_item_id;

  return jsonb_build_object('item_id', p_item_id, 'quantity_on_hand', v_new_qty);
end; $$;

grant execute on function public.adjust_inventory_stock(uuid, text, numeric, text) to authenticated;


-- ===== 20260609380000_unified_audit.sql =====

-- Module 24: Unified audit trail (organization + session)

-- Allow audit.read holders (not only org admins)
drop policy if exists org_audit_select on public.organization_audit_logs;
create policy org_audit_select on public.organization_audit_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or exists (
        select 1
        from public.staff_branch_assignments sba
        join public.role_permissions rp on rp.role_id = sba.role_id
        join public.permissions perm on perm.id = rp.permission_id
        where sba.profile_id = auth.uid()
          and perm.name = 'audit.read'
          and (
            organization_audit_logs.branch_id is null
            or sba.branch_id = organization_audit_logs.branch_id
          )
      )
    )
  );

drop policy if exists session_audit_select on public.session_audit_logs;
create policy session_audit_select on public.session_audit_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or exists (
        select 1
        from public.staff_branch_assignments sba
        join public.role_permissions rp on rp.role_id = sba.role_id
        join public.permissions perm on perm.id = rp.permission_id
        where sba.profile_id = auth.uid()
          and perm.name = 'audit.read'
      )
    )
  );

create or replace function public.get_unified_audit_trail(
  p_branch_id uuid default null,
  p_source text default 'all',
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid,
  source text,
  action text,
  entity_type text,
  entity_id text,
  branch_id uuid,
  profile_id uuid,
  actor_name text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_branch uuid := coalesce(
    p_branch_id,
    (select sba.branch_id from public.staff_branch_assignments sba where sba.profile_id = auth.uid() limit 1)
  );
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.user_is_org_admin()
    or public.has_permission('audit.read', v_branch)
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select *
  from (
    select
      oal.id,
      'organization'::text as source,
      oal.action,
      oal.entity_type,
      oal.entity_id,
      oal.branch_id,
      oal.profile_id,
      coalesce(pr.full_name, pr.email, 'Unknown') as actor_name,
      coalesce(oal.metadata, '{}'::jsonb) as metadata,
      null::text as ip_address,
      null::text as user_agent,
      oal.created_at
    from public.organization_audit_logs oal
    left join public.profiles pr on pr.id = oal.profile_id
    where oal.organization_id = v_org
      and (p_branch_id is null or oal.branch_id is null or oal.branch_id = p_branch_id)
      and p_source in ('all', 'organization')

    union all

    select
      sal.id,
      'session'::text as source,
      sal.event_type as action,
      'session'::text as entity_type,
      sal.event_type as entity_id,
      null::uuid as branch_id,
      sal.profile_id,
      coalesce(pr.full_name, pr.email, 'Unknown') as actor_name,
      '{}'::jsonb as metadata,
      sal.ip_address,
      sal.user_agent,
      sal.created_at
    from public.session_audit_logs sal
    left join public.profiles pr on pr.id = sal.profile_id
    where sal.organization_id = v_org
      and p_source in ('all', 'session')
  ) combined
  order by combined.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_unified_audit_trail(uuid, text, int, int) to authenticated;


-- ===== 20260609390000_payment_gateway_stub.sql =====

-- Module 20: Payment gateway stub (GCash / PayMongo)

create table if not exists public.payment_gateway_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null check (provider in ('gcash', 'paymongo')),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'expired')),
  external_ref text not null,
  checkout_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_intents_invoice
  on public.payment_gateway_intents(invoice_id, created_at desc);

alter table public.payment_gateway_intents enable row level security;

create policy payment_intents_select on public.payment_gateway_intents
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  );

create policy payment_intents_insert on public.payment_gateway_intents
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.write', branch_id)
  );

create policy payment_intents_update on public.payment_gateway_intents
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.write', branch_id)
  );

create or replace function public.create_payment_intent(
  p_invoice_id uuid,
  p_provider text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_ref text;
  v_url text;
  v_intent_id uuid;
begin
  select i.id, i.organization_id, i.branch_id, i.total_amount, i.paid_amount, i.status
  into v_inv
  from public.invoices i
  where i.id = p_invoice_id;

  if v_inv.id is null then
    raise exception 'Invoice not found';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Cannot pay void invoice';
  end if;

  if p_amount <= 0 or p_amount > (v_inv.total_amount - v_inv.paid_amount) then
    raise exception 'Invalid amount';
  end if;

  if p_provider not in ('gcash', 'paymongo') then
    raise exception 'Unsupported provider';
  end if;

  v_ref := upper(p_provider) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_url := 'https://checkout.stub.ph-dental.local/' || lower(p_provider) || '/' || v_ref;

  insert into public.payment_gateway_intents (
    organization_id, branch_id, invoice_id, provider, amount,
    external_ref, checkout_url, created_by
  ) values (
    v_inv.organization_id, v_inv.branch_id, p_invoice_id, p_provider, p_amount,
    v_ref, v_url, auth.uid()
  )
  returning id into v_intent_id;

  return jsonb_build_object(
    'id', v_intent_id,
    'provider', p_provider,
    'amount', p_amount,
    'status', 'pending',
    'external_ref', v_ref,
    'checkout_url', v_url
  );
end;
$$;

create or replace function public.complete_payment_intent(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_payment jsonb;
begin
  select *
  into v_intent
  from public.payment_gateway_intents
  where id = p_intent_id
  for update;

  if v_intent.id is null then
    raise exception 'Intent not found';
  end if;

  if not public.has_permission('billing.write', v_intent.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'Intent is not pending';
  end if;

  v_payment := public.record_invoice_payment(
    v_intent.invoice_id,
    v_intent.amount,
    v_intent.provider,
    'Online payment via ' || v_intent.provider || ' (' || v_intent.external_ref || ')'
  );

  update public.payment_gateway_intents
  set status = 'completed', completed_at = now()
  where id = p_intent_id;

  return v_payment || jsonb_build_object('intent_id', p_intent_id);
end;
$$;

grant execute on function public.create_payment_intent(uuid, text, numeric) to authenticated;
grant execute on function public.complete_payment_intent(uuid) to authenticated;


-- ===== 20260609400000_dashboard_kpi_realtime.sql =====

-- Dashboard KPI extension + Realtime queue

create or replace function public.get_dashboard_stats(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_patients bigint;
  v_today_appts bigint;
  v_pending_consents bigint;
  v_queue_waiting bigint;
  v_open_invoices bigint;
  v_today_collected numeric;
begin
  select count(*) into v_patients
  from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts
  from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and a.scheduled_at::date = current_date
    and a.status in ('scheduled', 'confirmed');

  select count(*) into v_pending_consents
  from public.patient_consents pc
  where pc.organization_id = v_org
    and pc.status = 'pending'
    and (p_branch_id is null or pc.branch_id = p_branch_id);

  select count(*) into v_queue_waiting
  from public.queue_entries qe
  where qe.organization_id = v_org
    and (p_branch_id is null or qe.branch_id = p_branch_id)
    and qe.status in ('waiting', 'ready');

  select count(*) into v_open_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('draft', 'sent', 'partial');

  select coalesce(sum(ip.amount), 0) into v_today_collected
  from public.invoice_payments ip
  join public.invoices inv on inv.id = ip.invoice_id
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and ip.created_at::date = current_date;

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents,
    'queue_waiting', v_queue_waiting,
    'open_invoices', v_open_invoices,
    'today_collected', v_today_collected
  );
end;
$$;

-- Enable Realtime for queue board (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queue_entries'
  ) then
    alter publication supabase_realtime add table public.queue_entries;
  end if;
end;
$$;


-- ===== 20260609410000_lock_signed_consent.sql =====

-- Module 08: Lock signed consent (immutable after sign)

create or replace function public.lock_signed_consent(
  p_consent_id uuid,
  p_signature_data text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status = 'signed' then
    raise exception 'Consent already signed';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is voided';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = auth.uid(),
    signature_data = p_signature_data
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.signed',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object('template_slug', v_consent.template_slug)
  );
end;
$$;

grant execute on function public.lock_signed_consent(uuid, text) to authenticated;


-- ===== 20260609420000_treatment_plan_rpc.sql =====

-- Module 10: Treatment plan approve + estimate RPCs

create or replace function public.calculate_treatment_estimate(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_total numeric;
  v_count bigint;
begin
  select *
  into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id();

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  select coalesce(sum(estimated_price), 0), count(*)
  into v_total, v_count
  from public.treatment_plan_items
  where plan_id = p_plan_id;

  update public.treatment_plans
  set total_estimated = v_total, updated_at = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'total_estimated', v_total,
    'item_count', v_count,
    'status', v_plan.status
  );
end;
$$;

create or replace function public.approve_treatment_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_estimate jsonb;
  v_count bigint;
begin
  select *
  into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status not in ('draft', 'proposed') then
    raise exception 'Plan cannot be approved from status %', v_plan.status;
  end if;

  select count(*) into v_count
  from public.treatment_plan_items
  where plan_id = p_plan_id;

  if v_count = 0 then
    raise exception 'Add at least one procedure before approving';
  end if;

  v_estimate := public.calculate_treatment_estimate(p_plan_id);

  update public.treatment_plans
  set status = 'approved', approved_at = now(), updated_at = now()
  where id = p_plan_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'treatment_plan.approved',
    'treatment_plan',
    p_plan_id::text,
    jsonb_build_object(
      'total_estimated', v_estimate->'total_estimated',
      'item_count', v_estimate->'item_count'
    )
  );

  return v_estimate || jsonb_build_object('status', 'approved', 'approved_at', now());
end;
$$;

grant execute on function public.calculate_treatment_estimate(uuid) to authenticated;
grant execute on function public.approve_treatment_plan(uuid) to authenticated;


-- ===== 20260609430000_patient_documents.sql =====

-- Module 05: Patient documents

create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size >= 0),
  storage_path text not null,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_documents_patient
  on public.patient_documents(patient_id, created_at desc);

alter table public.patient_documents enable row level security;

create policy patient_documents_select on public.patient_documents
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

create policy patient_documents_insert on public.patient_documents
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

create policy patient_documents_delete on public.patient_documents
  for delete to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

create policy patient_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy patient_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy patient_documents_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create or replace function public.register_patient_document(
  p_patient_id uuid,
  p_branch_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_storage_path text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_id uuid;
begin
  select p.id, p.organization_id
  into v_patient
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_patient.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.has_permission('patients.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.patient_documents (
    organization_id, branch_id, patient_id, file_name, file_type,
    file_size, storage_path, notes, uploaded_by
  ) values (
    v_patient.organization_id, p_branch_id, p_patient_id, p_file_name, p_file_type,
    p_file_size, p_storage_path, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.register_patient_document(uuid, uuid, text, text, bigint, text, text) to authenticated;


-- ===== 20260609440000_detect_duplicate_patient.sql =====

-- Module 05: Duplicate patient detection stub

create or replace function public.detect_duplicate_patient(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date default null,
  p_phone text default null
)
returns table (
  patient_id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  match_reason text,
  score int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_phone_norm text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.phone,
    case
      when v_phone_norm is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone_norm
        then 'phone'
      when p_date_of_birth is not null
        and p.date_of_birth = p_date_of_birth
        and lower(p.first_name) = lower(trim(p_first_name))
        and lower(p.last_name) = lower(trim(p_last_name))
        then 'name_dob'
      else 'name'
    end as match_reason,
    case
      when v_phone_norm is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone_norm then 100
      when p_date_of_birth is not null
        and p.date_of_birth = p_date_of_birth
        and lower(p.first_name) = lower(trim(p_first_name))
        and lower(p.last_name) = lower(trim(p_last_name)) then 90
      else 60
    end as score
  from public.patients p
  where p.organization_id = v_org
    and p.status = 'active'
    and (
      (v_phone_norm is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone_norm)
      or (
        lower(p.first_name) = lower(trim(p_first_name))
        and lower(p.last_name) = lower(trim(p_last_name))
        and (p_date_of_birth is null or p.date_of_birth = p_date_of_birth)
      )
    )
  order by score desc
  limit 10;
end;
$$;

grant execute on function public.detect_duplicate_patient(text, text, date, text) to authenticated;


-- ===== 20260609450000_void_invoice.sql =====

-- Module 20: Void invoice RPC

create or replace function public.void_invoice(
  p_invoice_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select *
  into v_inv
  from public.invoices
  where id = p_invoice_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_inv.id is null then
    raise exception 'Invoice not found';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Invoice is already void';
  end if;

  if coalesce(v_inv.paid_amount, 0) > 0 then
    raise exception 'Cannot void invoice with recorded payments';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Void reason is required';
  end if;

  update public.invoices
  set status = 'void', updated_at = now()
  where id = p_invoice_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id,
    v_inv.branch_id,
    auth.uid(),
    'invoice.voided',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'reason', trim(p_reason),
      'invoice_number', v_inv.invoice_number,
      'total_amount', v_inv.total_amount
    )
  );

  return jsonb_build_object(
    'id', p_invoice_id,
    'status', 'void',
    'reason', trim(p_reason)
  );
end;
$$;

grant execute on function public.void_invoice(uuid, text) to authenticated;


-- ===== 20260609460000_merge_patients.sql =====

-- Module 05: Merge patients stub

alter table public.patients
  add column if not exists merged_into_patient_id uuid references public.patients(id) on delete set null;

create index if not exists idx_patients_merged_into
  on public.patients(merged_into_patient_id)
  where merged_into_patient_id is not null;

create or replace function public.merge_patients(
  p_master_id uuid,
  p_duplicate_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_duplicate record;
begin
  if p_master_id = p_duplicate_id then
    raise exception 'Cannot merge patient into itself';
  end if;

  select *
  into v_master
  from public.patients
  where id = p_master_id
    and organization_id = public.current_user_org_id();

  select *
  into v_duplicate
  from public.patients
  where id = p_duplicate_id
    and organization_id = public.current_user_org_id();

  if v_master.id is null or v_duplicate.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Only org admins can merge patients';
  end if;

  if v_duplicate.status = 'archived' and v_duplicate.merged_into_patient_id is not null then
    raise exception 'Duplicate patient is already merged';
  end if;

  update public.patients
  set
    status = 'archived',
    merged_into_patient_id = p_master_id,
    updated_at = now()
  where id = p_duplicate_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_master.organization_id,
    null,
    auth.uid(),
    'patient.merged',
    'patient',
    p_duplicate_id::text,
    jsonb_build_object(
      'master_id', p_master_id,
      'master_name', v_master.first_name || ' ' || v_master.last_name,
      'duplicate_name', v_duplicate.first_name || ' ' || v_duplicate.last_name,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Duplicate merge')
    )
  );

  return jsonb_build_object(
    'master_id', p_master_id,
    'duplicate_id', p_duplicate_id,
    'status', 'archived'
  );
end;
$$;

grant execute on function public.merge_patients(uuid, uuid, text) to authenticated;


-- ===== 20260609470000_get_patient_balance.sql =====

-- Module 20: Patient balance RPC

create or replace function public.get_patient_balance(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_open_balance numeric;
  v_total_billed numeric;
  v_total_paid numeric;
  v_open_count bigint;
begin
  select p.id, p.organization_id
  into v_patient
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_patient.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.has_permission('billing.read', (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  )) then
    raise exception 'Permission denied';
  end if;

  select
    coalesce(sum(greatest(inv.total_amount - inv.paid_amount, 0)), 0),
    coalesce(sum(inv.total_amount), 0),
    coalesce(sum(inv.paid_amount), 0),
    count(*) filter (where inv.status in ('draft', 'sent', 'partial'))
  into v_open_balance, v_total_billed, v_total_paid, v_open_count
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_patient.organization_id
    and inv.status <> 'void';

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'open_balance', v_open_balance,
    'total_billed', v_total_billed,
    'total_paid', v_total_paid,
    'open_invoice_count', v_open_count
  );
end;
$$;

grant execute on function public.get_patient_balance(uuid) to authenticated;


-- ===== 20260609480000_consent_signed_pdf.sql =====

-- Module 08: Signed consent PDF/HTML storage stub

alter table public.patient_consents
  add column if not exists signed_pdf_path text;

insert into storage.buckets (id, name, public)
values ('consent-documents', 'consent-documents', false)
on conflict (id) do nothing;

create policy consent_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy consent_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy consent_documents_storage_update on storage.objects
  for update to authenticated using (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create or replace function public.register_signed_consent_pdf(
  p_consent_id uuid,
  p_storage_path text,
  p_file_size bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
begin
  if p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception 'Storage path required';
  end if;

  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status <> 'signed' then
    raise exception 'Consent must be signed before storing export';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set signed_pdf_path = p_storage_path
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.pdf_stored',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'storage_path', p_storage_path,
      'file_size', coalesce(p_file_size, 0)
    )
  );

  return jsonb_build_object(
    'consent_id', p_consent_id,
    'signed_pdf_path', p_storage_path
  );
end;
$$;

grant execute on function public.register_signed_consent_pdf(uuid, text, bigint) to authenticated;


-- ===== 20260609490000_void_patient_consent.sql =====

-- Module 08: Void signed consent (admin only)

create or replace function public.void_patient_consent(
  p_consent_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
begin
  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Only org admins can void consents';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is already voided';
  end if;

  if v_consent.status <> 'signed' then
    raise exception 'Only signed consents can be voided';
  end if;

  update public.patient_consents
  set status = 'voided'
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.voided',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Admin void')
    )
  );

  return jsonb_build_object(
    'consent_id', p_consent_id,
    'status', 'voided'
  );
end;
$$;

grant execute on function public.void_patient_consent(uuid, text) to authenticated;


-- ===== 20260609500000_medical_risk_flags.sql =====

-- Module 07: Medical risk flags RPC stub

create or replace function public.calculate_medical_risk_flags(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_history record;
  v_allergies text;
  v_medications text;
  v_conditions text;
  v_flags jsonb := '[]'::jsonb;
begin
  select pmh.allergies, pmh.medications, pmh.conditions
  into v_history
  from public.patient_medical_histories pmh
  where pmh.patient_id = p_patient_id
    and pmh.organization_id = public.current_user_org_id()
  order by pmh.version desc
  limit 1;

  if v_history is null then
    return jsonb_build_object('patient_id', p_patient_id, 'flags', v_flags, 'risk_level', 'none');
  end if;

  v_allergies := lower(coalesce(array_to_string(v_history.allergies, ' '), ''));
  v_medications := lower(coalesce(array_to_string(v_history.medications, ' '), ''));
  v_conditions := lower(coalesce(array_to_string(v_history.conditions, ' '), ''));

  if v_allergies ~ '(latex|rubber)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'latex_allergy', 'severity', 'high', 'label', 'Latex allergy'));
  end if;

  if v_allergies ~ '(penicillin|amoxicillin|cephalosporin)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'antibiotic_allergy', 'severity', 'high', 'label', 'Antibiotic allergy'));
  end if;

  if v_medications ~ '(warfarin|aspirin|clopidogrel|heparin|apixaban)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'bleeding_risk', 'severity', 'medium', 'label', 'Anticoagulant / bleeding risk'));
  end if;

  if v_conditions ~ '(diabetes|hypertension|heart|asthma|pregnancy)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'chronic_condition', 'severity', 'medium', 'label', 'Chronic medical condition'));
  end if;

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'flags', v_flags,
    'risk_level', case
      when jsonb_array_length(v_flags) = 0 then 'none'
      when exists (select 1 from jsonb_array_elements(v_flags) f where f->>'severity' = 'high') then 'high'
      else 'medium'
    end
  );
end;
$$;

grant execute on function public.calculate_medical_risk_flags(uuid) to authenticated;


-- ===== 20260609510000_provider_availability.sql =====

-- Module 13: Provider availability stub

create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  slot_minutes integer not null default 30 check (slot_minutes > 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, provider_id, day_of_week)
);

create index if not exists idx_provider_availability_branch
  on public.provider_availability(branch_id, provider_id);

alter table public.provider_availability enable row level security;

create policy provider_availability_select on public.provider_availability
  for select to authenticated using (
    organization_id = public.current_user_org_id()
  );

create policy provider_availability_write on public.provider_availability
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.write', branch_id)
  ) with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.write', branch_id)
  );

create or replace function public.ensure_provider_availability_defaults(
  p_branch_id uuid,
  p_provider_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_hour record;
begin
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  perform public.ensure_branch_clinic_hours(p_branch_id);

  for v_hour in
    select ch.day_of_week, ch.open_time, ch.close_time, ch.is_closed
    from public.clinic_hours ch
    where ch.branch_id = p_branch_id
  loop
    insert into public.provider_availability (
      organization_id, branch_id, provider_id, day_of_week,
      start_time, end_time, slot_minutes, is_available
    ) values (
      v_org_id, p_branch_id, p_provider_id, v_hour.day_of_week,
      coalesce(v_hour.open_time, '09:00'::time),
      coalesce(v_hour.close_time, '17:00'::time),
      30,
      not coalesce(v_hour.is_closed, false)
    )
    on conflict (branch_id, provider_id, day_of_week) do nothing;
  end loop;
end;
$$;

create or replace function public.get_branch_provider_availability(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'provider_id', pa.provider_id,
      'provider_name', coalesce(p.full_name, p.email, 'Provider'),
      'day_of_week', pa.day_of_week,
      'start_time', to_char(pa.start_time, 'HH24:MI'),
      'end_time', to_char(pa.end_time, 'HH24:MI'),
      'slot_minutes', pa.slot_minutes,
      'is_available', pa.is_available
    ) order by pa.provider_id, pa.day_of_week
  ), '[]'::jsonb)
  into v_result
  from public.provider_availability pa
  join public.profiles p on p.id = pa.provider_id
  where pa.branch_id = p_branch_id
    and pa.organization_id = public.current_user_org_id();

  return jsonb_build_object('branch_id', p_branch_id, 'rows', v_result);
end;
$$;

create or replace function public.get_available_appointment_slots(
  p_branch_id uuid,
  p_provider_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dow smallint;
  v_avail record;
  v_slots jsonb := '[]'::jsonb;
  v_cursor time;
  v_end time;
  v_slot interval;
  v_ts timestamptz;
  v_taken boolean;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  v_dow := extract(dow from p_date)::smallint;

  select pa.start_time, pa.end_time, pa.slot_minutes, pa.is_available
  into v_avail
  from public.provider_availability pa
  where pa.branch_id = p_branch_id
    and pa.provider_id = p_provider_id
    and pa.day_of_week = v_dow
    and pa.organization_id = public.current_user_org_id();

  if v_avail is null or not v_avail.is_available then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  v_cursor := v_avail.start_time;
  v_end := v_avail.end_time;
  v_slot := make_interval(mins => v_avail.slot_minutes);

  while v_cursor < v_end loop
    v_ts := (p_date + v_cursor) at time zone 'Asia/Manila';
    select exists (
      select 1 from public.appointments a
      where a.branch_id = p_branch_id
        and coalesce(a.provider_id, p_provider_id) = p_provider_id
        and a.scheduled_at = v_ts
        and a.status not in ('cancelled', 'no_show')
    ) into v_taken;

    v_slots := v_slots || jsonb_build_array(jsonb_build_object(
      'time', to_char(v_cursor, 'HH24:MI'),
      'available', not v_taken
    ));

    v_cursor := v_cursor + v_slot;
  end loop;

  return jsonb_build_object(
    'date', p_date,
    'provider_id', p_provider_id,
    'slots', v_slots
  );
end;
$$;

grant execute on function public.ensure_provider_availability_defaults(uuid, uuid) to authenticated;
grant execute on function public.get_branch_provider_availability(uuid) to authenticated;
grant execute on function public.get_available_appointment_slots(uuid, uuid, date) to authenticated;


-- ===== 20260609520000_create_appointment_validated.sql =====

-- Module 13: Validated appointment creation + check-in from appointment

create or replace function public.create_appointment_validated(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_provider_id uuid := nullif(p_payload->>'provider_id', '')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_scheduled_at timestamptz := (p_payload->>'scheduled_at')::timestamptz;
  v_purpose text := nullif(trim(p_payload->>'purpose'), '');
  v_duration integer := coalesce((p_payload->>'duration_minutes')::integer, 30);
  v_appt_date date;
  v_appt_time time;
  v_slot_taken boolean;
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null or v_org_id is null or v_scheduled_at is null then
    raise exception 'branch_id, patient_id, organization_id, and scheduled_at are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = v_patient_id and p.organization_id = v_org_id
  ) then
    raise exception 'Patient not found';
  end if;

  if v_provider_id is not null then
    v_appt_date := (v_scheduled_at at time zone 'Asia/Manila')::date;
    v_appt_time := (v_scheduled_at at time zone 'Asia/Manila')::time;

    perform public.ensure_provider_availability_defaults(v_branch_id, v_provider_id);

    if not exists (
      select 1 from public.provider_availability pa
      where pa.branch_id = v_branch_id
        and pa.provider_id = v_provider_id
        and pa.day_of_week = extract(dow from v_appt_date)::smallint
        and pa.is_available
        and v_appt_time >= pa.start_time
        and v_appt_time < pa.end_time
    ) then
      raise exception 'Provider is not available at this time';
    end if;

    select exists (
      select 1 from public.appointments a
      where a.branch_id = v_branch_id
        and coalesce(a.provider_id, v_provider_id) = v_provider_id
        and a.scheduled_at = v_scheduled_at
        and a.status not in ('cancelled', 'no_show')
    ) into v_slot_taken;

    if v_slot_taken then
      raise exception 'Time slot is already booked';
    end if;
  end if;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_provider_id,
    v_scheduled_at, v_duration, v_purpose, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'status', 'scheduled',
    'scheduled_at', v_scheduled_at
  );
end;
$$;

create or replace function public.check_in_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_code text;
  v_queue_id uuid;
begin
  select a.*
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment cannot be checked in';
  end if;

  if not public.has_permission('queue.manage', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if exists (
    select 1 from public.queue_entries qe
    where qe.branch_id = v_appt.branch_id
      and qe.patient_id = v_appt.patient_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  v_code := public._next_queue_display_code(v_appt.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_appt.organization_id, v_appt.branch_id, v_appt.patient_id, v_appt.id,
    v_code, coalesce(v_appt.purpose, 'Appointment check-in'), auth.uid()
  )
  returning id into v_queue_id;

  update public.appointments
  set status = 'confirmed', updated_at = now()
  where id = v_appt.id;

  return jsonb_build_object(
    'queue_id', v_queue_id,
    'display_code', v_code,
    'appointment_id', v_appt.id,
    'status', 'waiting'
  );
end;
$$;

grant execute on function public.create_appointment_validated(jsonb) to authenticated;
grant execute on function public.check_in_appointment(uuid) to authenticated;


-- ===== 20260609530000_get_day_schedule.sql =====

-- Module 13: Day schedule RPC for appointments day view

create or replace function public.get_day_schedule(p_branch_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_total int;
  v_scheduled int;
  v_completed int;
  v_cancelled int;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'scheduled_at', a.scheduled_at,
      'purpose', a.purpose,
      'status', a.status,
      'patient_id', a.patient_id,
      'patient_name', trim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, '')),
      'provider_id', a.provider_id,
      'provider_name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
      'duration_minutes', a.duration_minutes
    ) order by a.scheduled_at
  ), '[]'::jsonb)
  into v_rows
  from public.appointments a
  join public.patients pt on pt.id = a.patient_id
  left join public.profiles pr on pr.id = a.provider_id
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  select
    count(*)::int,
    count(*) filter (where a.status in ('scheduled', 'confirmed'))::int,
    count(*) filter (where a.status = 'completed')::int,
    count(*) filter (where a.status = 'cancelled')::int
  into v_total, v_scheduled, v_completed, v_cancelled
  from public.appointments a
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'date', p_date,
    'summary', jsonb_build_object(
      'total', v_total,
      'scheduled', v_scheduled,
      'completed', v_completed,
      'cancelled', v_cancelled
    ),
    'appointments', v_rows
  );
end;
$$;

grant execute on function public.get_day_schedule(uuid, date) to authenticated;


-- ===== 20260609540000_get_effective_settings.sql =====

-- Module 04: Effective settings RPC (org + branch overrides + clinic hours)

create or replace function public.get_effective_settings(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_branch record;
  v_org_settings record;
  v_org_timezone text;
  v_branch_overrides jsonb;
  v_hours jsonb;
begin
  select b.id, b.name, b.organization_id
  into v_branch
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_branch.id is null then
    raise exception 'Branch not found';
  end if;

  if not public.user_has_branch_access(p_branch_id)
    and not public.has_permission('settings.manage', p_branch_id) then
    if not public.has_permission('appointments.read', p_branch_id) then
      raise exception 'Permission denied';
    end if;
  end if;

  insert into public.organization_settings (organization_id)
  values (v_branch.organization_id)
  on conflict (organization_id) do nothing;

  perform public.ensure_branch_clinic_hours(p_branch_id);

  select o.timezone into v_org_timezone
  from public.organizations o
  where o.id = v_branch.organization_id;

  select os.default_timezone, os.currency_code
  into v_org_settings
  from public.organization_settings os
  where os.organization_id = v_branch.organization_id;

  select coalesce(jsonb_object_agg(bs.key, bs.value), '{}'::jsonb)
  into v_branch_overrides
  from public.branch_settings bs
  where bs.branch_id = p_branch_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'day_of_week', ch.day_of_week,
      'open_time', to_char(ch.open_time, 'HH24:MI'),
      'close_time', to_char(ch.close_time, 'HH24:MI'),
      'is_closed', ch.is_closed
    ) order by ch.day_of_week
  ), '[]'::jsonb)
  into v_hours
  from public.clinic_hours ch
  where ch.branch_id = p_branch_id;

  return jsonb_build_object(
    'branch_id', v_branch.id,
    'branch_name', v_branch.name,
    'organization_id', v_branch.organization_id,
    'timezone', coalesce(v_org_timezone, v_org_settings.default_timezone, 'Asia/Manila'),
    'currency_code', coalesce(v_org_settings.currency_code, 'PHP'),
    'branch_overrides', coalesce(v_branch_overrides, '{}'::jsonb),
    'clinic_hours', v_hours
  );
end;
$$;

grant execute on function public.get_effective_settings(uuid) to authenticated;


-- ===== 20260609550000_procedure_catalog_rpc.sql =====

-- Module 19: Procedure categories + catalog RPC stubs

create table if not exists public.procedure_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (organization_id, slug)
);

create index if not exists idx_procedure_categories_org on public.procedure_categories(organization_id);

alter table public.procedure_categories enable row level security;

create policy procedure_categories_org on public.procedure_categories for all using (
  organization_id = public.current_user_org_id()
);

-- Branch overrides (MVP name: procedure_prices in module docs)
create or replace view public.procedure_prices as
select
  id,
  organization_id,
  branch_id,
  procedure_id,
  price_override as price,
  updated_by,
  updated_at
from public.branch_procedure_prices;

create or replace function public.ensure_procedure_categories(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.procedure_categories (organization_id, slug, name, sort_order) values
    (p_org_id, 'preventive', 'Preventive', 1),
    (p_org_id, 'restorative', 'Restorative', 2),
    (p_org_id, 'surgery', 'Surgery', 3),
    (p_org_id, 'ortho', 'Orthodontics', 4),
    (p_org_id, 'general', 'General', 99)
  on conflict (organization_id, slug) do nothing;
end;
$$;

create or replace function public.get_effective_procedure_price(
  p_procedure_id uuid,
  p_branch_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.get_procedure_effective_price(p_procedure_id, p_branch_id);
$$;

create or replace function public.get_procedure_catalog(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_categories jsonb;
  v_procedures jsonb;
begin
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  if not public.has_permission('settings.manage', p_branch_id)
    and not public.has_permission('billing.read', p_branch_id)
    and not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public.ensure_procedure_categories(v_org_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pc.id,
      'slug', pc.slug,
      'name', pc.name,
      'sort_order', pc.sort_order
    ) order by pc.sort_order, pc.name
  ), '[]'::jsonb)
  into v_categories
  from public.procedure_categories pc
  where pc.organization_id = v_org_id
    and pc.is_active;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'name', p.name,
      'category', p.category,
      'base_price', p.base_price,
      'effective_price', public.get_effective_procedure_price(p.id, p_branch_id),
      'branch_override', (
        select bpp.price_override
        from public.branch_procedure_prices bpp
        where bpp.procedure_id = p.id
          and bpp.branch_id = p_branch_id
        limit 1
      ),
      'tooth_required', p.tooth_required,
      'is_active', p.is_active
    ) order by p.name
  ), '[]'::jsonb)
  into v_procedures
  from public.procedures p
  where p.organization_id = v_org_id
    and p.is_active;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'categories', v_categories,
    'procedures', v_procedures
  );
end;
$$;

grant execute on function public.ensure_procedure_categories(uuid) to authenticated;
grant execute on function public.get_effective_procedure_price(uuid, uuid) to authenticated;
grant execute on function public.get_procedure_catalog(uuid) to authenticated;


-- ===== 20260609560000_create_medical_history_version.sql =====

-- Module 07: Versioned medical history RPC

create or replace function public.create_medical_history_version(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_allergies jsonb := coalesce(p_payload->'allergies', '[]'::jsonb);
  v_medications jsonb := coalesce(p_payload->'medications', '[]'::jsonb);
  v_conditions jsonb := coalesce(p_payload->'conditions', '[]'::jsonb);
  v_notes text := nullif(trim(p_payload->>'notes'), '');
  v_branch_id uuid := nullif(p_payload->>'branch_id', '')::uuid;
  v_next_version integer;
  v_id uuid;
begin
  if v_patient_id is null or v_org_id is null then
    raise exception 'patient_id and organization_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = v_patient_id and p.organization_id = v_org_id
  ) then
    raise exception 'Patient not found';
  end if;

  if v_branch_id is not null then
    if not public.has_permission('patients.medical_history.write', v_branch_id) then
      raise exception 'Permission denied';
    end if;
  elsif not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  select coalesce(max(h.version), 0) + 1
  into v_next_version
  from public.patient_medical_histories h
  where h.patient_id = v_patient_id;

  insert into public.patient_medical_histories (
    patient_id, organization_id, version,
    allergies, medications, conditions, notes, created_by
  ) values (
    v_patient_id, v_org_id, v_next_version,
    v_allergies, v_medications, v_conditions, v_notes, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'patient_id', v_patient_id,
    'version', v_next_version,
    'risk', public.calculate_medical_risk_flags(v_patient_id)
  );
end;
$$;

grant execute on function public.create_medical_history_version(jsonb) to authenticated;


-- ===== 20260609570000_finalize_patient_intake.sql =====

-- Module 06: Patient intake finalize RPC

create table if not exists public.patient_intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  payload jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_patient_intakes_branch on public.patient_intakes(branch_id, created_at desc);

alter table public.patient_intakes enable row level security;

create policy patient_intakes_org on public.patient_intakes for all using (
  organization_id = public.current_user_org_id()
);

create or replace function public.finalize_patient_intake(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid;
  v_intake_id uuid;
  v_address text;
  v_medical_alerts text := nullif(trim(p_payload->>'medical_alerts'), '');
begin
  if v_org_id is null or v_branch_id is null then
    raise exception 'organization_id and branch_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('patients.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if nullif(trim(p_payload->>'first_name'), '') is null
    or nullif(trim(p_payload->>'last_name'), '') is null then
    raise exception 'first_name and last_name are required';
  end if;

  v_address := nullif(trim(concat_ws(', ',
    nullif(trim(p_payload->>'address_line1'), ''),
    nullif(trim(p_payload->>'city'), '')
  )), '');

  insert into public.patients (
    organization_id, first_name, last_name, date_of_birth, gender,
    phone, email, address, created_by, updated_by
  ) values (
    v_org_id,
    trim(p_payload->>'first_name'),
    trim(p_payload->>'last_name'),
    nullif(p_payload->>'date_of_birth', '')::date,
    coalesce(nullif(p_payload->>'gender', ''), 'prefer_not_to_say'),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'email'), ''),
    v_address,
    auth.uid(),
    auth.uid()
  )
  returning id into v_patient_id;

  insert into public.patient_branch_links (
    patient_id, branch_id, first_visit_at, last_visit_at
  ) values (
    v_patient_id, v_branch_id, now(), now()
  );

  if nullif(trim(p_payload->>'emergency_contact_name'), '') is not null then
    insert into public.patient_contacts (
      patient_id, contact_type, name, phone
    ) values (
      v_patient_id,
      'emergency',
      trim(p_payload->>'emergency_contact_name'),
      nullif(trim(p_payload->>'emergency_contact_phone'), '')
    );
  end if;

  if v_medical_alerts is not null then
    insert into public.patient_medical_histories (
      patient_id, organization_id, version,
      allergies, medications, conditions, notes, created_by
    ) values (
      v_patient_id, v_org_id, 1,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, v_medical_alerts, auth.uid()
    );
  end if;

  insert into public.patient_intakes (
    organization_id, branch_id, patient_id, status, payload, finalized_at, finalized_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, 'finalized', p_payload, now(), auth.uid()
  )
  returning id into v_intake_id;

  return jsonb_build_object(
    'patient_id', v_patient_id,
    'intake_id', v_intake_id,
    'status', 'finalized'
  );
end;
$$;

grant execute on function public.finalize_patient_intake(jsonb) to authenticated;


-- ===== 20260609580000_patient_insurance_profiles.sql =====

-- Module 06: Patient insurance profiles (Phase 2 stub)

create table if not exists public.patient_insurance_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  payer_type text not null default 'none'
    check (payer_type in ('none', 'hmo', 'philhealth', 'private')),
  payer_name text,
  member_id text,
  plan_name text,
  is_primary boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (patient_id, payer_type)
);

create index if not exists idx_patient_insurance_patient on public.patient_insurance_profiles(patient_id);

alter table public.patient_insurance_profiles enable row level security;

create policy patient_insurance_org on public.patient_insurance_profiles for all using (
  organization_id = public.current_user_org_id()
);

create or replace function public.get_patient_insurance_profiles(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.organization_id = public.current_user_org_id()
  ) then
    raise exception 'Patient not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pip.id,
      'payer_type', pip.payer_type,
      'payer_name', pip.payer_name,
      'member_id', pip.member_id,
      'plan_name', pip.plan_name,
      'is_primary', pip.is_primary,
      'notes', pip.notes
    ) order by pip.is_primary desc, pip.payer_type
  ), '[]'::jsonb)
  into v_rows
  from public.patient_insurance_profiles pip
  where pip.patient_id = p_patient_id;

  return jsonb_build_object('patient_id', p_patient_id, 'profiles', v_rows);
end;
$$;

create or replace function public.upsert_patient_insurance_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_payer_type text := coalesce(nullif(p_payload->>'payer_type', ''), 'none');
  v_id uuid;
begin
  if v_patient_id is null or v_org_id is null then
    raise exception 'patient_id and organization_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_is_org_admin()
    and not exists (
      select 1 from public.patient_branch_links pbl
      where pbl.patient_id = v_patient_id
        and public.has_permission('patients.write', pbl.branch_id)
    ) then
    raise exception 'Permission denied';
  end if;

  insert into public.patient_insurance_profiles (
    organization_id, patient_id, payer_type, payer_name, member_id, plan_name, notes,
    is_primary, created_by, updated_by
  ) values (
    v_org_id, v_patient_id, v_payer_type,
    nullif(trim(p_payload->>'payer_name'), ''),
    nullif(trim(p_payload->>'member_id'), ''),
    nullif(trim(p_payload->>'plan_name'), ''),
    nullif(trim(p_payload->>'notes'), ''),
    coalesce((p_payload->>'is_primary')::boolean, true),
    auth.uid(), auth.uid()
  )
  on conflict (patient_id, payer_type) do update set
    payer_name = excluded.payer_name,
    member_id = excluded.member_id,
    plan_name = excluded.plan_name,
    notes = excluded.notes,
    is_primary = excluded.is_primary,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'payer_type', v_payer_type, 'status', 'saved');
end;
$$;

grant execute on function public.get_patient_insurance_profiles(uuid) to authenticated;
grant execute on function public.upsert_patient_insurance_profile(jsonb) to authenticated;


-- ===== 20260609590000_bulk_upsert_procedures.sql =====

-- Module 19: Bulk procedure upsert stub

create or replace function public.bulk_upsert_procedures(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_item jsonb;
  v_inserted int := 0;
  v_updated int := 0;
  v_code text;
begin
  if v_org_id is null or v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'procedures', '[]'::jsonb))
  loop
    v_code := nullif(trim(v_item->>'code'), '');

    if v_code is not null and exists (
      select 1 from public.procedures p
      where p.organization_id = v_org_id and p.code = v_code
    ) then
      update public.procedures set
        name = coalesce(nullif(trim(v_item->>'name'), ''), name),
        category = coalesce(nullif(trim(v_item->>'category'), ''), category),
        base_price = coalesce((v_item->>'base_price')::numeric, base_price),
        is_active = coalesce((v_item->>'is_active')::boolean, is_active)
      where organization_id = v_org_id and code = v_code;
      v_updated := v_updated + 1;
    else
      insert into public.procedures (
        organization_id, code, name, category, base_price, tooth_required, is_active
      ) values (
        v_org_id,
        v_code,
        coalesce(nullif(trim(v_item->>'name'), ''), 'Unnamed procedure'),
        coalesce(nullif(trim(v_item->>'category'), ''), 'general'),
        coalesce((v_item->>'base_price')::numeric, 0),
        coalesce((v_item->>'tooth_required')::boolean, false),
        coalesce((v_item->>'is_active')::boolean, true)
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  perform public.ensure_procedure_categories(v_org_id);

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'total', v_inserted + v_updated
  );
end;
$$;

grant execute on function public.bulk_upsert_procedures(jsonb) to authenticated;


-- ===== 20260609600000_validate_intake_completeness.sql =====

-- Module 06: Intake completeness validation RPC

create or replace function public.validate_intake_completeness(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_missing text[] := '{}';
  v_warnings text[] := '{}';
  v_phone text := nullif(trim(p_payload->>'phone'), '');
  v_email text := nullif(trim(p_payload->>'email'), '');
begin
  if nullif(trim(p_payload->>'first_name'), '') is null then
    v_missing := array_append(v_missing, 'first_name');
  end if;

  if nullif(trim(p_payload->>'last_name'), '') is null then
    v_missing := array_append(v_missing, 'last_name');
  end if;

  if nullif(p_payload->>'date_of_birth', '') is null then
    v_missing := array_append(v_missing, 'date_of_birth');
  end if;

  if v_phone is null then
    v_missing := array_append(v_missing, 'phone');
  elsif length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then
    v_warnings := array_append(v_warnings, 'phone_format');
  end if;

  if nullif(trim(p_payload->>'address_line1'), '') is null then
    v_missing := array_append(v_missing, 'address_line1');
  end if;

  if nullif(trim(p_payload->>'city'), '') is null then
    v_missing := array_append(v_missing, 'city');
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_warnings := array_append(v_warnings, 'email_format');
  end if;

  if nullif(trim(p_payload->>'emergency_contact_name'), '') is not null
    and nullif(trim(p_payload->>'emergency_contact_phone'), '') is null then
    v_warnings := array_append(v_warnings, 'emergency_phone_missing');
  end if;

  return jsonb_build_object(
    'valid', cardinality(v_missing) = 0,
    'missing_fields', to_jsonb(v_missing),
    'warnings', to_jsonb(v_warnings)
  );
end;
$$;

grant execute on function public.validate_intake_completeness(jsonb) to authenticated;


-- ===== 20260609610000_submit_kiosk_intake.sql =====

-- Module 06: Kiosk intake draft submission (staff review required before finalize)

create or replace function public.submit_kiosk_intake(
  p_session_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_intake_id uuid;
  v_payload jsonb;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  if nullif(trim(p_payload->>'first_name'), '') is null
    or nullif(trim(p_payload->>'last_name'), '') is null then
    raise exception 'first_name and last_name are required';
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'source', 'kiosk',
    'submitted_at', now()
  );

  insert into public.patient_intakes (
    organization_id, branch_id, status, payload
  ) values (
    v_session.organization_id,
    v_session.branch_id,
    'draft',
    v_payload
  )
  returning id into v_intake_id;

  return jsonb_build_object(
    'intake_id', v_intake_id,
    'status', 'draft',
    'branch_id', v_session.branch_id
  );
end;
$$;

grant execute on function public.submit_kiosk_intake(uuid, jsonb) to anon, authenticated, service_role;


-- ===== 20260609620000_display_branch_id_realtime.sql =====

-- Expose branch_id on public display payload for Realtime subscriptions

create or replace function public.get_public_queue_display(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_now_serving jsonb;
  v_waiting jsonb;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'display'
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid display link';
  end if;

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  select coalesce(jsonb_agg(jsonb_build_object('display_code', display_code) order by called_at nulls last), '[]'::jsonb)
  into v_now_serving
  from public.queue_entries
  where branch_id = v_t.branch_id and status = 'now_serving';

  select coalesce(jsonb_agg(jsonb_build_object('display_code', display_code) order by checked_in_at), '[]'::jsonb)
  into v_waiting
  from public.queue_entries
  where branch_id = v_t.branch_id and status in ('waiting', 'ready');

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;


-- ===== 20260609630000_patient_document_category.sql =====

-- Patient document category for registry uploads

alter table public.patient_documents
  add column if not exists category text not null default 'other'
    check (category in ('xray', 'id', 'referral', 'insurance', 'other'));

create or replace function public.register_patient_document(
  p_patient_id uuid,
  p_branch_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_storage_path text,
  p_notes text default null,
  p_category text default 'other'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_id uuid;
begin
  if p_category not in ('xray', 'id', 'referral', 'insurance', 'other') then
    raise exception 'Invalid document category';
  end if;

  select p.id, p.organization_id
  into v_patient
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_patient.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.has_permission('patients.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.patient_documents (
    organization_id, branch_id, patient_id, file_name, file_type,
    file_size, storage_path, notes, uploaded_by, category
  ) values (
    v_patient.organization_id, p_branch_id, p_patient_id, p_file_name, p_file_type,
    p_file_size, p_storage_path, p_notes, auth.uid(), p_category
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.register_patient_document(uuid, uuid, text, text, bigint, text, text, text) to authenticated;


-- ===== 20260609640000_branch_settings_context.sql =====

-- Branch settings key-value + get_branch_context polish

alter table public.branch_settings drop constraint if exists branch_settings_pkey;
alter table public.branch_settings add constraint branch_settings_pkey primary key (branch_id, key);

create or replace function public.set_branch_setting(
  p_branch_id uuid,
  p_key text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in ('timezone', 'currency_code', 'display_name') then
    raise exception 'Unsupported branch setting key';
  end if;

  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.branch_settings (branch_id, key, value, updated_at)
  values (p_branch_id, p_key, p_value, now())
  on conflict (branch_id, key) do update
    set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.set_branch_setting(uuid, text, text) to authenticated;

create or replace function public.get_branch_context(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'branch_id', b.id,
    'branch_name', b.name,
    'organization_id', b.organization_id,
    'is_active', b.is_active,
    'timezone', coalesce(bs_tz.value, os.default_timezone, o.timezone, 'Asia/Manila'),
    'currency_code', coalesce(bs_cur.value, os.currency_code, 'PHP'),
    'branch_overrides', coalesce((
      select jsonb_object_agg(bs.key, bs.value)
      from public.branch_settings bs
      where bs.branch_id = b.id
    ), '{}'::jsonb)
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id
  left join public.organization_settings os on os.organization_id = b.organization_id
  left join public.branch_settings bs_tz on bs_tz.branch_id = b.id and bs_tz.key = 'timezone'
  left join public.branch_settings bs_cur on bs_cur.branch_id = b.id and bs_cur.key = 'currency_code'
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or public.user_has_branch_access(p_branch_id)
    );
$$;

grant execute on function public.get_branch_context(uuid) to authenticated;


-- ===== 20260609650000_revoke_staff_invitation.sql =====

-- Revoke pending staff invitations (admin)

create or replace function public.revoke_staff_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.staff_invitations%rowtype;
begin
  select * into v_inv
  from public.staff_invitations
  where id = p_invitation_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  update public.staff_invitations
  set status = 'revoked'
  where id = p_invitation_id;

  return jsonb_build_object('status', 'revoked', 'invitation_id', p_invitation_id);
end;
$$;

grant execute on function public.revoke_staff_invitation(uuid) to authenticated;


-- ===== 20260609660000_invoice_line_items.sql =====

-- Module 20: Invoice line items

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  treatment_plan_item_id uuid references public.treatment_plan_items(id) on delete set null,
  description text not null,
  tooth_number text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_line_items_invoice
  on public.invoice_line_items(invoice_id, sort_order);

alter table public.invoice_line_items enable row level security;

create policy invoice_line_items_select on public.invoice_line_items
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.invoices inv
      where inv.id = invoice_line_items.invoice_id
        and public.has_permission('billing.read', inv.branch_id)
    )
  );

create policy invoice_line_items_insert on public.invoice_line_items
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.invoices inv
      where inv.id = invoice_line_items.invoice_id
        and public.has_permission('billing.write', inv.branch_id)
        and inv.status <> 'void'
    )
  );

create or replace function public.recalc_invoice_total_from_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_new_total numeric(12,2);
begin
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);

  select coalesce(sum(line_total), 0) into v_new_total
  from public.invoice_line_items
  where invoice_id = v_invoice_id;

  update public.invoices
  set total_amount = v_new_total,
      updated_at = now()
  where id = v_invoice_id;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_invoice_line_items_recalc on public.invoice_line_items;
create trigger trg_invoice_line_items_recalc
  after insert or update or delete on public.invoice_line_items
  for each row execute function public.recalc_invoice_total_from_lines();

create or replace function public.add_invoice_line_item(
  p_invoice_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1,
  p_tooth_number text default null,
  p_procedure_id uuid default null,
  p_treatment_plan_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_line_total numeric(12,2);
  v_id uuid;
  v_sort int;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status = 'void' then raise exception 'Cannot edit void invoice'; end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  v_line_total := round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0), 2);

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.invoice_line_items where invoice_id = p_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, organization_id, procedure_id, treatment_plan_item_id,
    description, tooth_number, quantity, unit_price, line_total, sort_order
  ) values (
    p_invoice_id, v_inv.organization_id, p_procedure_id, p_treatment_plan_item_id,
    p_description, p_tooth_number, coalesce(p_quantity, 1), coalesce(p_unit_price, 0),
    v_line_total, v_sort
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid) to authenticated;


-- ===== 20260609670000_deactivate_branch_audit.sql =====

-- Branch deactivate with audit trail + admin branch listing

create or replace function public.get_org_branches_for_settings()
returns table (
  id uuid,
  name text,
  organization_id uuid,
  address text,
  contact_number text,
  is_active boolean,
  role_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.name,
    b.organization_id,
    b.address,
    b.contact_number,
    coalesce(b.is_active, true),
    'admin'::text
  from public.branches b
  where b.organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  order by b.is_active desc, b.name;
$$;

grant execute on function public.get_org_branches_for_settings() to authenticated;

create or replace function public.deactivate_branch(
  p_branch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch public.branches%rowtype;
  v_active_count int;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Deactivation reason is required (min 3 characters)';
  end if;

  select * into v_branch
  from public.branches
  where id = p_branch_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Branch not found';
  end if;

  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if coalesce(v_branch.is_active, true) = false then
    raise exception 'Branch is already inactive';
  end if;

  select count(*)::int into v_active_count
  from public.branches
  where organization_id = v_branch.organization_id
    and coalesce(is_active, true) = true
    and id <> p_branch_id;

  if v_active_count = 0 then
    raise exception 'Cannot deactivate the last active branch in the organization';
  end if;

  update public.branches
  set is_active = false, updated_at = now()
  where id = p_branch_id;

  update public.branch_public_tokens
  set is_active = false
  where branch_id = p_branch_id and is_active = true;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_branch.organization_id,
    p_branch_id,
    auth.uid(),
    'branch.deactivate',
    'branch',
    p_branch_id::text,
    jsonb_build_object('reason', trim(p_reason), 'branch_name', v_branch.name)
  );

  return jsonb_build_object(
    'status', 'deactivated',
    'branch_id', p_branch_id,
    'branch_name', v_branch.name
  );
end;
$$;

grant execute on function public.deactivate_branch(uuid, text) to authenticated;


-- ===== 20260609680000_dashboard_realtime_publication.sql =====

-- Dashboard KPI: enable Realtime on tables that drive get_dashboard_stats

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments',
    'patient_consents',
    'invoices',
    'invoice_payments',
    'patients',
    'queue_entries'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;


-- ===== 20260609690000_reschedule_appointment.sql =====

-- Module 13: Drag-reschedule validated update

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_scheduled_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_appt_date date;
  v_appt_time time;
  v_slot_taken boolean;
  v_old_at timestamptz;
begin
  if p_appointment_id is null or p_scheduled_at is null then
    raise exception 'appointment_id and scheduled_at are required';
  end if;

  select a.*
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Only scheduled or confirmed appointments can be rescheduled';
  end if;

  if v_appt.provider_id is not null then
    v_appt_date := (p_scheduled_at at time zone 'Asia/Manila')::date;
    v_appt_time := (p_scheduled_at at time zone 'Asia/Manila')::time;

    perform public.ensure_provider_availability_defaults(v_appt.branch_id, v_appt.provider_id);

    if not exists (
      select 1 from public.provider_availability pa
      where pa.branch_id = v_appt.branch_id
        and pa.provider_id = v_appt.provider_id
        and pa.day_of_week = extract(dow from v_appt_date)::smallint
        and pa.is_available
        and v_appt_time >= pa.start_time
        and v_appt_time < pa.end_time
    ) then
      raise exception 'Provider is not available at this time';
    end if;

    select exists (
      select 1 from public.appointments a
      where a.branch_id = v_appt.branch_id
        and coalesce(a.provider_id, v_appt.provider_id) = v_appt.provider_id
        and a.scheduled_at = p_scheduled_at
        and a.id <> p_appointment_id
        and a.status not in ('cancelled', 'no_show')
    ) into v_slot_taken;

    if v_slot_taken then
      raise exception 'Time slot is already booked';
    end if;
  end if;

  v_old_at := v_appt.scheduled_at;

  update public.appointments
  set scheduled_at = p_scheduled_at,
      updated_at = now()
  where id = p_appointment_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id,
    v_appt.branch_id,
    auth.uid(),
    'appointment.rescheduled',
    'appointment',
    p_appointment_id,
    jsonb_build_object(
      'from', v_old_at,
      'to', p_scheduled_at,
      'patient_id', v_appt.patient_id
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'scheduled_at', p_scheduled_at,
    'status', v_appt.status
  );
end;
$$;

grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;


-- ===== 20260609700000_patient_treatment_timeline.sql =====

-- Patient chart: treatment plan timeline for odontogram context

create or replace function public.get_patient_treatment_timeline(
  p_patient_id uuid,
  p_branch_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'plan_id', tp.id,
        'plan_title', tp.title,
        'plan_status', tp.status,
        'plan_created_at', tp.created_at,
        'plan_approved_at', tp.approved_at,
        'item_id', i.id,
        'description', i.description,
        'tooth_number', i.tooth_number,
        'priority', i.priority,
        'item_status', i.status,
        'estimated_price', i.estimated_price,
        'item_created_at', i.created_at
      )
      order by
        case tp.status
          when 'in_progress' then 0
          when 'approved' then 1
          when 'proposed' then 2
          when 'draft' then 3
          else 4
        end,
        case i.priority
          when 'urgent' then 0
          when 'restorative' then 1
          when 'cosmetic' then 2
          when 'ortho' then 3
          else 4
        end,
        i.created_at
    ),
    '[]'::jsonb
  )
  from public.treatment_plans tp
  join public.treatment_plan_items i on i.plan_id = tp.id
  join public.patients p on p.id = tp.patient_id
  where tp.patient_id = p_patient_id
    and p.organization_id = public.current_user_org_id()
    and tp.status not in ('cancelled', 'completed')
    and i.status not in ('cancelled', 'completed')
    and (p_branch_id is null or tp.branch_id = p_branch_id);
$$;

grant execute on function public.get_patient_treatment_timeline(uuid, uuid) to authenticated;


-- ===== 20260609710000_consent_signature_validation.sql =====

-- Module 08: E-signature payload validation on lock

create or replace function public.lock_signed_consent(
  p_consent_id uuid,
  p_signature_data text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_parsed jsonb;
  v_image text;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
  end if;

  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status = 'signed' then
    raise exception 'Consent already signed';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is voided';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = auth.uid(),
    signature_data = p_signature_data
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.signed',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient'),
      'captured_at', coalesce(v_parsed->>'capturedAt', now()::text)
    )
  );
end;
$$;


-- ===== 20260609720000_inventory_low_stock_alerts.sql =====

-- Module 23: Low-stock alert query

create or replace function public.get_inventory_low_stock_alerts(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'sku', i.sku,
        'quantity_on_hand', i.quantity_on_hand,
        'min_stock_level', i.min_stock_level,
        'unit', i.unit,
        'expiry_date', i.expiry_date,
        'alert_type',
          case
            when i.expiry_date is not null and i.expiry_date < current_date then 'expired'
            when i.quantity_on_hand <= 0 then 'critical'
            when i.quantity_on_hand <= i.min_stock_level then 'low'
            else 'ok'
          end
      )
      order by
        case
          when i.expiry_date is not null and i.expiry_date < current_date then 0
          when i.quantity_on_hand <= 0 then 1
          when i.quantity_on_hand <= i.min_stock_level then 2
          else 3
        end,
        i.name
    ),
    '[]'::jsonb
  )
  from public.inventory_items i
  where i.branch_id = p_branch_id
    and i.organization_id = public.current_user_org_id()
    and i.is_active = true
    and (
      i.quantity_on_hand <= i.min_stock_level
      or (i.expiry_date is not null and i.expiry_date < current_date)
    );
$$;

grant execute on function public.get_inventory_low_stock_alerts(uuid) to authenticated;


-- ===== 20260609730000_waitlist_slot_notify.sql =====

-- Module 14: Auto-notify waitlist when appointment slot opens

alter table public.waitlist_entries
  add column if not exists slot_alert_sent_at timestamptz;

create or replace function public.get_waitlist_notify_candidates(
  p_branch_id uuid,
  p_slot_at timestamptz,
  p_limit int default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slot_date date := (p_slot_at at time zone 'Asia/Manila')::date;
  v_slot_time time := (p_slot_at at time zone 'Asia/Manila')::time;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'entry_id', w.id,
        'patient_id', w.patient_id,
        'patient_name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
        'patient_phone', p.phone,
        'urgency', w.urgency,
        'status', w.status
      )
      order by
        case w.urgency when 'high' then 0 when 'urgent' then 1 else 2 end,
        w.created_at
    )
    from public.waitlist_entries w
    join public.patients p on p.id = w.patient_id
    where w.branch_id = p_branch_id
      and w.organization_id = public.current_user_org_id()
      and w.status = 'waiting'
      and (w.expires_at is null or w.expires_at > now())
      and (w.slot_alert_sent_at is null or w.slot_alert_sent_at < now() - interval '12 hours')
      and (w.preferred_date is null or w.preferred_date = v_slot_date)
      and (
        w.preferred_time_start is null
        or (
          v_slot_time >= w.preferred_time_start
          and (w.preferred_time_end is null or v_slot_time <= w.preferred_time_end)
        )
      )
    limit greatest(coalesce(p_limit, 3), 1)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.record_waitlist_slot_notify(
  p_entry_id uuid,
  p_slot_at timestamptz,
  p_notification_log_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_note text;
begin
  select * into v_entry
  from public.waitlist_entries
  where id = p_entry_id
    and organization_id = public.current_user_org_id()
  for update;

  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  v_note := 'Auto SMS: slot opened ' || to_char(p_slot_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI');

  insert into public.waitlist_contact_attempts (
    waitlist_entry_id, organization_id, branch_id, note, outcome, created_by
  ) values (
    p_entry_id, v_entry.organization_id, v_entry.branch_id,
    v_note || coalesce(' (log ' || p_notification_log_id::text || ')', ''),
    'reached', auth.uid()
  );

  update public.waitlist_entries
  set
    status = case when status = 'waiting' then 'contacted' else status end,
    slot_alert_sent_at = now(),
    updated_at = now()
  where id = p_entry_id;
end;
$$;

grant execute on function public.get_waitlist_notify_candidates(uuid, timestamptz, int) to authenticated;
grant execute on function public.record_waitlist_slot_notify(uuid, timestamptz, uuid) to authenticated;

update public.notification_templates
set body = 'Hi {{patient_name}}, a slot opened at {{clinic_name}} on {{slot_date}} at {{slot_time}}. Please call us to confirm your appointment.'
where template_key = 'waitlist_slot';


-- ===== 20260609740000_bulk_provider_availability.sql =====

-- Module 13: Bulk edit provider weekly availability

create or replace function public.bulk_upsert_provider_availability(
  p_branch_id uuid,
  p_provider_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row jsonb;
  v_count int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  if not public.has_permission('appointments.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.provider_availability (
      organization_id, branch_id, provider_id, day_of_week,
      start_time, end_time, slot_minutes, is_available
    ) values (
      v_org_id,
      p_branch_id,
      p_provider_id,
      (v_row->>'day_of_week')::smallint,
      coalesce((v_row->>'start_time')::time, '09:00'::time),
      coalesce((v_row->>'end_time')::time, '17:00'::time),
      coalesce((v_row->>'slot_minutes')::integer, 30),
      coalesce((v_row->>'is_available')::boolean, true)
    )
    on conflict (branch_id, provider_id, day_of_week) do update
    set
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      slot_minutes = excluded.slot_minutes,
      is_available = excluded.is_available;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('updated', v_count);
end;
$$;

grant execute on function public.bulk_upsert_provider_availability(uuid, uuid, jsonb) to authenticated;


-- ===== 20260609750000_philhealth_submit_polish.sql =====

-- Module 22: PhilHealth eClaims submit polish (provider ref, retry)

alter table public.philhealth_claims
  add column if not exists provider_ref text,
  add column if not exists submitted_at timestamptz;

alter table public.philhealth_sync_logs
  add column if not exists mode text check (mode is null or mode in ('dry_run', 'live'));

create or replace function public.reset_philhealth_claim_for_retry(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.philhealth_claims%rowtype;
begin
  select * into v from public.philhealth_claims where id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  if v.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('billing.write', v.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v.status <> 'sync_failed' then
    raise exception 'Only sync_failed claims can be reset for retry';
  end if;

  update public.philhealth_claims
  set status = 'ready', updated_at = now()
  where id = p_claim_id;
end;
$$;

grant execute on function public.reset_philhealth_claim_for_retry(uuid) to authenticated;


-- ===== 20260609760000_consent_template_admin.sql =====

-- Module 08: Org consent template admin (override globals)

create policy consent_templates_org_write on public.consent_templates
  for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid()
        and public.has_permission('settings.manage', sba.branch_id)
    )
  )
  with check (
    organization_id = public.current_user_org_id()
    and organization_id is not null
    and exists (
      select 1 from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid()
        and public.has_permission('settings.manage', sba.branch_id)
    )
  );

create or replace function public.upsert_org_consent_template(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_slug text := nullif(trim(p_payload->>'slug'), '');
  v_name text := nullif(trim(p_payload->>'name'), '');
  v_body text := nullif(trim(p_payload->>'body'), '');
  v_version text := coalesce(nullif(trim(p_payload->>'version'), ''), '1.0');
  v_is_active boolean := coalesce((p_payload->>'is_active')::boolean, true);
  v_id uuid;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if v_slug is null or v_name is null or v_body is null then
    raise exception 'slug, name, and body are required';
  end if;

  if not exists (
    select 1 from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid()
      and public.has_permission('settings.manage', sba.branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  insert into public.consent_templates (
    organization_id, slug, name, body, version, is_active
  ) values (
    v_org, v_slug, v_name, v_body, v_version, v_is_active
  )
  on conflict (organization_id, slug) do update
  set
    name = excluded.name,
    body = excluded.body,
    version = excluded.version,
    is_active = excluded.is_active;

  select id into v_id
  from public.consent_templates
  where organization_id = v_org and slug = v_slug;

  insert into public.organization_audit_logs (
    organization_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    auth.uid(),
    'consent_template.upserted',
    'consent_template',
    v_id::text,
    jsonb_build_object('slug', v_slug, 'version', v_version)
  );

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'version', v_version);
end;
$$;

grant execute on function public.upsert_org_consent_template(jsonb) to authenticated;

create or replace function public.get_org_consent_templates()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ct.id,
        'slug', ct.slug,
        'name', ct.name,
        'body', ct.body,
        'version', ct.version,
        'is_active', ct.is_active,
        'is_global', ct.organization_id is null,
        'organization_id', ct.organization_id
      )
      order by ct.slug, ct.organization_id nulls first
    ),
    '[]'::jsonb
  )
  from public.consent_templates ct
  where ct.organization_id is null
     or ct.organization_id = public.current_user_org_id();
$$;

grant execute on function public.get_org_consent_templates() to authenticated;


-- ===== 20260609770000_dashboard_low_stock_kpi.sql =====

-- Dashboard KPI: low-stock inventory count

create or replace function public.get_dashboard_stats(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_patients bigint;
  v_today_appts bigint;
  v_pending_consents bigint;
  v_queue_waiting bigint;
  v_open_invoices bigint;
  v_today_collected numeric;
  v_low_stock bigint;
begin
  select count(*) into v_patients
  from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts
  from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and a.scheduled_at::date = current_date
    and a.status in ('scheduled', 'confirmed');

  select count(*) into v_pending_consents
  from public.patient_consents pc
  where pc.organization_id = v_org
    and pc.status = 'pending'
    and (p_branch_id is null or pc.branch_id = p_branch_id);

  select count(*) into v_queue_waiting
  from public.queue_entries qe
  where qe.organization_id = v_org
    and (p_branch_id is null or qe.branch_id = p_branch_id)
    and qe.status in ('waiting', 'ready');

  select count(*) into v_open_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('draft', 'sent', 'partial');

  select coalesce(sum(ip.amount), 0) into v_today_collected
  from public.invoice_payments ip
  join public.invoices inv on inv.id = ip.invoice_id
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and ip.created_at::date = current_date;

  if p_branch_id is not null then
    select count(*) into v_low_stock
    from public.inventory_items i
    where i.branch_id = p_branch_id
      and i.organization_id = v_org
      and i.is_active = true
      and (
        i.quantity_on_hand <= i.min_stock_level
        or (i.expiry_date is not null and i.expiry_date < current_date)
      );
  else
    v_low_stock := 0;
  end if;

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents,
    'queue_waiting', v_queue_waiting,
    'open_invoices', v_open_invoices,
    'today_collected', v_today_collected,
    'low_stock_items', v_low_stock
  );
end;
$$;

-- Realtime refresh when inventory changes
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;
end;
$$;


-- ===== 20260609780000_appointment_no_show.sql =====

-- Module 13: Mark appointment no-show + day schedule summary

create or replace function public.mark_appointment_no_show(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  select a.*
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Only scheduled or confirmed appointments can be marked no-show';
  end if;

  update public.appointments
  set status = 'no_show',
      updated_at = now()
  where id = p_appointment_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id,
    v_appt.branch_id,
    auth.uid(),
    'appointment.no_show',
    'appointment',
    p_appointment_id,
    jsonb_build_object(
      'scheduled_at', v_appt.scheduled_at,
      'patient_id', v_appt.patient_id,
      'previous_status', v_appt.status
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'status', 'no_show',
    'scheduled_at', v_appt.scheduled_at,
    'branch_id', v_appt.branch_id
  );
end;
$$;

grant execute on function public.mark_appointment_no_show(uuid) to authenticated;

create or replace function public.get_day_schedule(p_branch_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_total int;
  v_scheduled int;
  v_completed int;
  v_cancelled int;
  v_no_show int;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'scheduled_at', a.scheduled_at,
      'purpose', a.purpose,
      'status', a.status,
      'patient_id', a.patient_id,
      'patient_name', trim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, '')),
      'provider_id', a.provider_id,
      'provider_name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
      'duration_minutes', a.duration_minutes
    ) order by a.scheduled_at
  ), '[]'::jsonb)
  into v_rows
  from public.appointments a
  join public.patients pt on pt.id = a.patient_id
  left join public.profiles pr on pr.id = a.provider_id
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  select
    count(*)::int,
    count(*) filter (where a.status in ('scheduled', 'confirmed'))::int,
    count(*) filter (where a.status = 'completed')::int,
    count(*) filter (where a.status = 'cancelled')::int,
    count(*) filter (where a.status = 'no_show')::int
  into v_total, v_scheduled, v_completed, v_cancelled, v_no_show
  from public.appointments a
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'date', p_date,
    'summary', jsonb_build_object(
      'total', v_total,
      'scheduled', v_scheduled,
      'completed', v_completed,
      'cancelled', v_cancelled,
      'no_show', v_no_show
    ),
    'appointments', v_rows
  );
end;
$$;


-- ===== 20260609790000_notification_template_branch_overrides.sql =====

-- Module 18: Branch-specific notification template overrides

create or replace function public.get_notification_template_for_branch(
  p_branch_id uuid,
  p_template_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_branch_tpl public.notification_templates%rowtype;
  v_org_tpl public.notification_templates%rowtype;
begin
  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id;

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  select * into v_branch_tpl
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id = p_branch_id
    and nt.template_key = p_template_key
    and nt.is_active = true
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_branch_tpl.id,
      'template_key', v_branch_tpl.template_key,
      'name', v_branch_tpl.name,
      'body', v_branch_tpl.body,
      'is_branch_override', true
    );
  end if;

  select * into v_org_tpl
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id is null
    and nt.template_key = p_template_key
    and nt.is_active = true
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_org_tpl.id,
    'template_key', v_org_tpl.template_key,
    'name', v_org_tpl.name,
    'body', v_org_tpl.body,
    'is_branch_override', false
  );
end;
$$;

create or replace function public.get_effective_notification_templates(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_rows jsonb;
begin
  if not public.has_permission('notifications.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id;

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'template_key', org_tpl.template_key,
      'name', org_tpl.name,
      'channel', org_tpl.channel,
      'org_template_id', org_tpl.id,
      'org_default_body', org_tpl.body,
      'branch_template_id', br_tpl.id,
      'effective_id', coalesce(br_tpl.id, org_tpl.id),
      'effective_body', coalesce(br_tpl.body, org_tpl.body),
      'is_branch_override', br_tpl.id is not null,
      'is_active', coalesce(br_tpl.is_active, org_tpl.is_active)
    )
    order by org_tpl.name
  ), '[]'::jsonb)
  into v_rows
  from public.notification_templates org_tpl
  left join public.notification_templates br_tpl
    on br_tpl.organization_id = org_tpl.organization_id
    and br_tpl.branch_id = p_branch_id
    and br_tpl.template_key = org_tpl.template_key
  where org_tpl.organization_id = v_org
    and org_tpl.branch_id is null;

  return v_rows;
end;
$$;

create or replace function public.upsert_branch_notification_template(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_template_key text := nullif(trim(p_payload->>'template_key'), '');
  v_body text := nullif(trim(p_payload->>'body'), '');
  v_org uuid;
  v_org_tpl public.notification_templates%rowtype;
  v_id uuid;
begin
  if v_branch_id is null or v_template_key is null or v_body is null then
    raise exception 'branch_id, template_key, and body are required';
  end if;

  if not public.has_permission('notifications.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = v_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  select * into v_org_tpl
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id is null
    and nt.template_key = v_template_key;

  if not found then
    raise exception 'Org template not found for key %', v_template_key;
  end if;

  select nt.id into v_id
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id = v_branch_id
    and nt.template_key = v_template_key;

  if found then
    update public.notification_templates
    set body = v_body,
        is_active = true,
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_id;
  else
    insert into public.notification_templates (
      organization_id, branch_id, template_key, name, channel, body, is_active, created_by, updated_by
    ) values (
      v_org, v_branch_id, v_template_key, v_org_tpl.name, v_org_tpl.channel, v_body, true, auth.uid(), auth.uid()
    )
    returning id into v_id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, v_branch_id, auth.uid(), 'notification_template.branch_override',
    'notification_template', v_id::text,
    jsonb_build_object('template_key', v_template_key)
  );

  return jsonb_build_object('id', v_id, 'template_key', v_template_key, 'is_branch_override', true);
end;
$$;

create or replace function public.delete_branch_notification_override(
  p_branch_id uuid,
  p_template_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if not public.has_permission('notifications.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  delete from public.notification_templates
  where organization_id = v_org
    and branch_id = p_branch_id
    and template_key = p_template_key;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, p_branch_id, auth.uid(), 'notification_template.branch_override_removed',
    'notification_template', p_template_key,
    jsonb_build_object('template_key', p_template_key)
  );
end;
$$;

grant execute on function public.get_notification_template_for_branch(uuid, text) to authenticated;
grant execute on function public.get_notification_template_for_branch(uuid, text) to service_role;
grant execute on function public.get_effective_notification_templates(uuid) to authenticated;
grant execute on function public.upsert_branch_notification_template(jsonb) to authenticated;
grant execute on function public.delete_branch_notification_override(uuid, text) to authenticated;


-- ===== 20260609800000_hmo_submit_polish.sql =====

-- Module 21: HMO claim submit polish (validation, provider ref, retry)

alter table public.hmo_claims
  add column if not exists provider_ref text;

create or replace function public.submit_hmo_claim(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.hmo_claims%rowtype;
  v_ref text;
begin
  select * into v from public.hmo_claims where id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  if not public.has_permission('hmo.write', v.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v.status <> 'draft' then
    raise exception 'Only draft claims can be submitted';
  end if;

  if nullif(trim(v.member_id), '') is null then
    raise exception 'Member ID is required before submit';
  end if;

  if v.claimed_amount is null or v.claimed_amount <= 0 then
    raise exception 'Claimed amount must be greater than zero';
  end if;

  v_ref := 'HMO-SUB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  update public.hmo_claims
  set status = 'submitted',
      submitted_at = now(),
      provider_ref = v_ref,
      updated_at = now()
  where id = p_claim_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v.organization_id, v.branch_id, auth.uid(), 'hmo_claim.submitted',
    'hmo_claim', p_claim_id::text,
    jsonb_build_object(
      'claim_number', v.claim_number,
      'provider_ref', v_ref,
      'claimed_amount', v.claimed_amount,
      'member_id', v.member_id
    )
  );

  return jsonb_build_object('id', p_claim_id, 'status', 'submitted', 'provider_ref', v_ref);
end;
$$;

create or replace function public.reset_hmo_claim_to_draft(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  if not public.has_permission('hmo.write', v.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v.status <> 'rejected' then
    raise exception 'Only rejected claims can be reset to draft';
  end if;

  update public.hmo_claims
  set status = 'draft',
      rejection_reason = null,
      provider_ref = null,
      submitted_at = null,
      updated_at = now()
  where id = p_claim_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v.organization_id, v.branch_id, auth.uid(), 'hmo_claim.reset_to_draft',
    'hmo_claim', p_claim_id::text,
    jsonb_build_object('claim_number', v.claim_number)
  );
end;
$$;

grant execute on function public.reset_hmo_claim_to_draft(uuid) to authenticated;

