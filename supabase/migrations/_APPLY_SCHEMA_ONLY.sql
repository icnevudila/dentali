-- AUTO-GENERATED SCHEMA BUNDLE: 62 migration dosyasi (RPC haric)
-- Functions-only sonrasi eksik tablo/kolon icin Supabase SQL Editor'da calistir.
-- Ornek fix: patient_intakes, waitlist_entries.slot_alert_sent_at
-- Sonra: scripts/check-missing-schema.sql ile dogrula
-- Kalici cozum: npx supabase login && npm run db:link && npm run db:push

SET client_min_messages TO WARNING;


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
-- RLS policies (basic skeleton, to be refined per table)

-- organizations: owners/admins can see their org
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select using (id = public.current_user_org_id());
drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations for insert with check (auth.role() = 'owner' or auth.role() = 'admin');
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update using (id = public.current_user_org_id()) with check (auth.role() = 'owner' or auth.role() = 'admin');

-- branches: only members of the org can read, branch managers can see assigned branches
drop policy if exists branch_select on public.branches;
create policy branch_select on public.branches for select using (
  organization_id = public.current_user_org_id()
  and (
    public.user_has_branch_access(id) or auth.role() = 'owner' or auth.role() = 'admin'
  )
);
drop policy if exists branch_insert on public.branches;
create policy branch_insert on public.branches for insert with check (
  organization_id = public.current_user_org_id() and (auth.role() = 'owner' or auth.role() = 'admin')
);
drop policy if exists branch_update on public.branches;
create policy branch_update on public.branches for update using (
  organization_id = public.current_user_org_id() and (auth.role() = 'owner' or auth.role() = 'admin')
) with check (true);

-- profiles: each user sees their own profile
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles for select using (id = auth.uid());
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles for insert with check (id = auth.uid());
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update using (id = auth.uid());

-- staff_branch_assignments: owners/admins see all, others see their own rows
drop policy if exists sba_select on public.staff_branch_assignments;
create policy sba_select on public.staff_branch_assignments for select using (
  auth.role() in ('owner','admin') or profile_id = auth.uid()
);
drop policy if exists sba_insert on public.staff_branch_assignments;
create policy sba_insert on public.staff_branch_assignments for insert with check (
  auth.role() in ('owner','admin')
);
drop policy if exists sba_update on public.staff_branch_assignments;
create policy sba_update on public.staff_branch_assignments for update using (
  auth.role() in ('owner','admin')
);

-- branch_settings: similar to branches
drop policy if exists bs_select on public.branch_settings;
create policy bs_select on public.branch_settings for select using (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner','admin')
);
drop policy if exists bs_insert on public.branch_settings;
create policy bs_insert on public.branch_settings for insert with check (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner','admin')
);
drop policy if exists bs_update on public.branch_settings;
create policy bs_update on public.branch_settings for update using (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner','admin')
);

-- audit_logs: owners/admins can read all logs for their org
drop policy if exists audit_select on public.audit_logs;
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
drop policy if exists sp_select on public.staff_profiles;
create policy sp_select on public.staff_profiles for select using (
  exists (select 1 from public.profiles p where p.id = staff_profiles.profile_id and p.organization_id = public.current_user_org_id())
);
drop policy if exists sp_insert on public.staff_profiles;
create policy sp_insert on public.staff_profiles for insert with check (auth.role() in ('owner', 'admin'));
drop policy if exists sp_update on public.staff_profiles;
create policy sp_update on public.staff_profiles for update using (auth.role() in ('owner', 'admin') or profile_id = auth.uid());

-- 4. organization_settings
create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  default_timezone text default 'Asia/Manila',
  currency_code text default 'PHP',
  updated_at timestamp with time zone default now()
);

alter table public.organization_settings enable row level security;
drop policy if exists os_select on public.organization_settings;
create policy os_select on public.organization_settings for select using (
  organization_id = public.current_user_org_id()
);
drop policy if exists os_update on public.organization_settings;
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
drop policy if exists ch_select on public.clinic_hours;
create policy ch_select on public.clinic_hours for select using (
  public.user_has_branch_access(branch_id) or auth.role() in ('owner', 'admin')
);
drop policy if exists ch_update on public.clinic_hours;
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
-- ---------------------------------------------------------------------------
-- has_permission â€” branch-scoped; owner/admin bypass
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- get_my_permissions(branch_id?) â€” returns permission keys for active branch
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- get_my_branch_ids â€” branch ids the user may access
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- get_my_branches â€” branch list with role for UI
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- get_branch_context â€” timezone / currency for active branch
-- ---------------------------------------------------------------------------
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

drop policy if exists session_audit_select on public.session_audit_logs;
create policy session_audit_select on public.session_audit_logs
  for select using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists session_audit_insert on public.session_audit_logs;
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
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated using (true);

drop policy if exists permissions_select on public.permissions;
drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated using (true);

drop policy if exists role_permissions_select on public.role_permissions;
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

drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('patients.read', (
    select pbl.branch_id from public.patient_branch_links pbl
    where pbl.patient_id = patients.id limit 1
  ))
);

drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients for insert with check (
  organization_id = public.current_user_org_id()
);

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients for update using (
  organization_id = public.current_user_org_id()
);

drop policy if exists patient_contacts_all on public.patient_contacts;
create policy patient_contacts_all on public.patient_contacts for all using (
  exists (
    select 1 from public.patients p
    where p.id = patient_contacts.patient_id
      and p.organization_id = public.current_user_org_id()
  )
);

drop policy if exists patient_branch_links_all on public.patient_branch_links;
create policy patient_branch_links_all on public.patient_branch_links for all using (
  exists (
    select 1 from public.patients p
    where p.id = patient_branch_links.patient_id
      and p.organization_id = public.current_user_org_id()
  )
);

-- Bootstrap: first authenticated user creates org + branch + owner assignment


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

drop policy if exists org_audit_select on public.organization_audit_logs;
create policy org_audit_select on public.organization_audit_logs for select using (
  organization_id = public.current_user_org_id() and public.user_is_org_admin()
);

drop policy if exists org_audit_insert on public.organization_audit_logs;
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

drop policy if exists medical_history_select on public.patient_medical_histories;
create policy medical_history_select on public.patient_medical_histories for select using (
  organization_id = public.current_user_org_id()
);

drop policy if exists medical_history_insert on public.patient_medical_histories;
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

drop policy if exists consent_templates_select on public.consent_templates;
create policy consent_templates_select on public.consent_templates for select using (
  organization_id is null or organization_id = public.current_user_org_id()
);

drop policy if exists patient_consents_all on public.patient_consents;
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

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select using (
  organization_id = public.current_user_org_id()
);

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert with check (
  organization_id = public.current_user_org_id()
);

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments for update using (
  organization_id = public.current_user_org_id()
);

-- Dashboard stats RPC
-- Staff list RPC
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

drop policy if exists procedures_org on public.procedures;
create policy procedures_org on public.procedures for all using (organization_id = public.current_user_org_id());
drop policy if exists treatment_plans_org on public.treatment_plans;
create policy treatment_plans_org on public.treatment_plans for all using (organization_id = public.current_user_org_id());
drop policy if exists treatment_plan_items_via_plan on public.treatment_plan_items;
create policy treatment_plan_items_via_plan on public.treatment_plan_items for all using (
  exists (select 1 from public.treatment_plans tp where tp.id = treatment_plan_items.plan_id and tp.organization_id = public.current_user_org_id())
);
drop policy if exists invoices_org on public.invoices;
create policy invoices_org on public.invoices for all using (organization_id = public.current_user_org_id());

-- Seed default procedures per org on bootstrap (called from app or trigger)
-- Update bootstrap to seed procedures


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

drop policy if exists invoice_payments_org on public.invoice_payments;
create policy invoice_payments_org on public.invoice_payments for all using (
  organization_id = public.current_user_org_id()
);



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

drop policy if exists clinical_notes_select on public.clinical_notes;
create policy clinical_notes_select on public.clinical_notes for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

drop policy if exists clinical_notes_insert on public.clinical_notes;
create policy clinical_notes_insert on public.clinical_notes for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists clinical_notes_update on public.clinical_notes;
create policy clinical_notes_update on public.clinical_notes for update using (
  organization_id = public.current_user_org_id()
  and status = 'draft'
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists note_versions_select on public.note_versions;
create policy note_versions_select on public.note_versions for select using (
  exists (
    select 1 from public.clinical_notes cn
    where cn.id = note_id
      and cn.organization_id = public.current_user_org_id()
      and public.has_permission('dental_chart.read', cn.branch_id)
  )
);

drop policy if exists note_versions_insert on public.note_versions;
create policy note_versions_insert on public.note_versions for insert with check (
  exists (
    select 1 from public.clinical_notes cn
    where cn.id = note_id
      and cn.organization_id = public.current_user_org_id()
      and public.has_permission('dental_chart.write', cn.branch_id)
  )
);

-- Sign note: snapshot version + lock
-- Patient timeline: notes + appointments


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

drop policy if exists branch_procedure_prices_org on public.branch_procedure_prices;
create policy branch_procedure_prices_org on public.branch_procedure_prices for all using (
  organization_id = public.current_user_org_id()
);

-- Effective price for a procedure at a branch (override or base)


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

drop policy if exists staff_invitations_select on public.staff_invitations;
create policy staff_invitations_select on public.staff_invitations for select using (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

drop policy if exists staff_invitations_insert on public.staff_invitations;
create policy staff_invitations_insert on public.staff_invitations for insert with check (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

drop policy if exists staff_invitations_update on public.staff_invitations;
create policy staff_invitations_update on public.staff_invitations for update using (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

-- Accept pending invite for the authenticated user (called after magic link / invite login)


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

drop policy if exists waitlist_entries_select on public.waitlist_entries;
create policy waitlist_entries_select on public.waitlist_entries
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists waitlist_entries_insert on public.waitlist_entries;
create policy waitlist_entries_insert on public.waitlist_entries
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

drop policy if exists waitlist_entries_update on public.waitlist_entries;
create policy waitlist_entries_update on public.waitlist_entries
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

drop policy if exists waitlist_contact_select on public.waitlist_contact_attempts;
create policy waitlist_contact_select on public.waitlist_contact_attempts
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists waitlist_contact_insert on public.waitlist_contact_attempts;
create policy waitlist_contact_insert on public.waitlist_contact_attempts
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

-- Mark patient as contacted + log attempt
-- Book appointment from waitlist entry
-- Expire stale entries (callable from cron or admin)


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

drop policy if exists queue_entries_select on public.queue_entries;
create policy queue_entries_select on public.queue_entries
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists queue_entries_insert on public.queue_entries;
create policy queue_entries_insert on public.queue_entries
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

drop policy if exists queue_entries_update on public.queue_entries;
create policy queue_entries_update on public.queue_entries
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );



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

drop policy if exists branch_public_tokens_staff on public.branch_public_tokens;
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
-- Anon: open kiosk session
-- Anon: patient self check-in via kiosk
-- Anon: TV queue display (codes only â€” no PHI)


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

drop policy if exists notification_templates_select on public.notification_templates;
create policy notification_templates_select on public.notification_templates
  for select to authenticated using (
    organization_id = public.current_user_org_id()
  );

drop policy if exists notification_templates_insert on public.notification_templates;
create policy notification_templates_insert on public.notification_templates
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
  );

drop policy if exists notification_templates_update on public.notification_templates;
create policy notification_templates_update on public.notification_templates
  for update to authenticated using (
    organization_id = public.current_user_org_id()
  );

drop policy if exists notification_logs_select on public.notification_logs;
create policy notification_logs_select on public.notification_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (branch_id is null or public.user_has_branch_access(branch_id))
  );

drop policy if exists notification_logs_insert on public.notification_logs;
create policy notification_logs_insert on public.notification_logs
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
  );

drop policy if exists notification_branch_settings_all on public.notification_branch_settings;
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
-- Render {{var}} placeholders
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

drop policy if exists ortho_cases_select on public.ortho_cases;
create policy ortho_cases_select on public.ortho_cases
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.read', branch_id)
  );

drop policy if exists ortho_cases_write on public.ortho_cases;
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

drop policy if exists ortho_adjustments_select on public.ortho_adjustments;
create policy ortho_adjustments_select on public.ortho_adjustments
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('dental_chart.read', branch_id)
  );

drop policy if exists ortho_adjustments_insert on public.ortho_adjustments;
create policy ortho_adjustments_insert on public.ortho_adjustments
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.write', branch_id)
  );



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

drop policy if exists hmo_providers_select on public.hmo_providers;
create policy hmo_providers_select on public.hmo_providers
  for select to authenticated using (organization_id = public.current_user_org_id());

drop policy if exists hmo_claims_select on public.hmo_claims;
create policy hmo_claims_select on public.hmo_claims
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('hmo.read', branch_id)
  );

drop policy if exists hmo_claims_write on public.hmo_claims;
create policy hmo_claims_write on public.hmo_claims
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('hmo.write', branch_id)
  )
  with check (organization_id = public.current_user_org_id() and public.has_permission('hmo.write', branch_id));

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

drop policy if exists philhealth_claims_all on public.philhealth_claims;
create policy philhealth_claims_all on public.philhealth_claims
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

drop policy if exists philhealth_sync_select on public.philhealth_sync_logs;
create policy philhealth_sync_select on public.philhealth_sync_logs
  for select to authenticated using (organization_id = public.current_user_org_id());

drop policy if exists philhealth_sync_insert on public.philhealth_sync_logs;
create policy philhealth_sync_insert on public.philhealth_sync_logs
  for insert to authenticated with check (organization_id = public.current_user_org_id());



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

drop policy if exists inventory_items_all on public.inventory_items;
create policy inventory_items_all on public.inventory_items
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

drop policy if exists inventory_movements_select on public.inventory_movements;
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists inventory_movements_insert on public.inventory_movements;
create policy inventory_movements_insert on public.inventory_movements
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('settings.manage', branch_id)
  );



-- ===== 20260609380000_unified_audit.sql =====

-- Module 24: Unified audit trail (organization + session)

-- Allow audit.read holders (not only org admins)
drop policy if exists org_audit_select on public.organization_audit_logs;
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

drop policy if exists payment_intents_select on public.payment_gateway_intents;
create policy payment_intents_select on public.payment_gateway_intents
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  );

drop policy if exists payment_intents_insert on public.payment_gateway_intents;
create policy payment_intents_insert on public.payment_gateway_intents
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.write', branch_id)
  );

drop policy if exists payment_intents_update on public.payment_gateway_intents;
create policy payment_intents_update on public.payment_gateway_intents
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.write', branch_id)
  );



-- ===== 20260609400000_dashboard_kpi_realtime.sql =====

-- Dashboard KPI extension + Realtime queue

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

drop policy if exists patient_documents_select on public.patient_documents;
create policy patient_documents_select on public.patient_documents
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

drop policy if exists patient_documents_insert on public.patient_documents;
create policy patient_documents_insert on public.patient_documents
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

drop policy if exists patient_documents_delete on public.patient_documents;
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

drop policy if exists patient_documents_storage_select on storage.objects;
create policy patient_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists patient_documents_storage_insert on storage.objects;
create policy patient_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists patient_documents_storage_delete on storage.objects;
create policy patient_documents_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );



-- ===== 20260609460000_merge_patients.sql =====

-- Module 05: Merge patients stub

alter table public.patients
  add column if not exists merged_into_patient_id uuid references public.patients(id) on delete set null;

create index if not exists idx_patients_merged_into
  on public.patients(merged_into_patient_id)
  where merged_into_patient_id is not null;



-- ===== 20260609480000_consent_signed_pdf.sql =====

-- Module 08: Signed consent PDF/HTML storage stub

alter table public.patient_consents
  add column if not exists signed_pdf_path text;

insert into storage.buckets (id, name, public)
values ('consent-documents', 'consent-documents', false)
on conflict (id) do nothing;

drop policy if exists consent_documents_storage_select on storage.objects;
create policy consent_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists consent_documents_storage_insert on storage.objects;
create policy consent_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists consent_documents_storage_update on storage.objects;
create policy consent_documents_storage_update on storage.objects
  for update to authenticated using (
    bucket_id = 'consent-documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );



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

drop policy if exists provider_availability_select on public.provider_availability;
create policy provider_availability_select on public.provider_availability
  for select to authenticated using (
    organization_id = public.current_user_org_id()
  );

drop policy if exists provider_availability_write on public.provider_availability;
create policy provider_availability_write on public.provider_availability
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.write', branch_id)
  ) with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.write', branch_id)
  );



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

drop policy if exists procedure_categories_org on public.procedure_categories;
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

drop policy if exists patient_intakes_org on public.patient_intakes;
create policy patient_intakes_org on public.patient_intakes for all using (
  organization_id = public.current_user_org_id()
);



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

drop policy if exists patient_insurance_org on public.patient_insurance_profiles;
create policy patient_insurance_org on public.patient_insurance_profiles for all using (
  organization_id = public.current_user_org_id()
);



-- ===== 20260609630000_patient_document_category.sql =====

-- Patient document category for registry uploads

alter table public.patient_documents
  add column if not exists category text not null default 'other'
    check (category in ('xray', 'id', 'referral', 'insurance', 'other'));



-- ===== 20260609640000_branch_settings_context.sql =====

-- Branch settings key-value + get_branch_context polish

alter table public.branch_settings drop constraint if exists branch_settings_pkey;
alter table public.branch_settings add constraint branch_settings_pkey primary key (branch_id, key);



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

drop policy if exists invoice_line_items_select on public.invoice_line_items;
create policy invoice_line_items_select on public.invoice_line_items
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.invoices inv
      where inv.id = invoice_line_items.invoice_id
        and public.has_permission('billing.read', inv.branch_id)
    )
  );

drop policy if exists invoice_line_items_insert on public.invoice_line_items;
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

drop trigger if exists trg_invoice_line_items_recalc on public.invoice_line_items;
create trigger trg_invoice_line_items_recalc
  after insert or update or delete on public.invoice_line_items
  for each row execute function public.recalc_invoice_total_from_lines();



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


-- ===== 20260609730000_waitlist_slot_notify.sql =====

-- Module 14: Auto-notify waitlist when appointment slot opens

alter table public.waitlist_entries
  add column if not exists slot_alert_sent_at timestamptz;

update public.notification_templates
set body = 'Hi {{patient_name}}, a slot opened at {{clinic_name}} on {{slot_date}} at {{slot_time}}. Please call us to confirm your appointment.'
where template_key = 'waitlist_slot';


-- ===== 20260609750000_philhealth_submit_polish.sql =====

-- Module 22: PhilHealth eClaims submit polish (provider ref, retry)

alter table public.philhealth_claims
  add column if not exists provider_ref text,
  add column if not exists submitted_at timestamptz;

alter table public.philhealth_sync_logs
  add column if not exists mode text check (mode is null or mode in ('dry_run', 'live'));



-- ===== 20260609760000_consent_template_admin.sql =====

-- Module 08: Org consent template admin (override globals)

drop policy if exists consent_templates_org_write on public.consent_templates;
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



-- ===== 20260609770000_dashboard_low_stock_kpi.sql =====

-- Dashboard KPI: low-stock inventory count

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


-- ===== 20260609800000_hmo_submit_polish.sql =====

-- Module 21: HMO claim submit polish (validation, provider ref, retry)

alter table public.hmo_claims
  add column if not exists provider_ref text;


