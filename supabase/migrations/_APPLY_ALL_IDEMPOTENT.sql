-- AUTO-GENERATED IDEMPOTENT BUNDLE: 109 migration dosyasi
-- Supabase Dashboard > SQL Editor > Run (TEK SEFERDE â€” ayri repair script gerekmez)
-- Tekrar calistirmak guvenli: preflight drops + policy/index/column cakismalari onlenir.
-- Tercih: npm run db:push

SET client_min_messages TO WARNING;


-- ===== PREFLIGHT DROPS (bundle-preflight-drops.sql) =====

-- =============================================================================
-- PREFLIGHT DROPS â€” _APPLY_ALL_IDEMPOTENT.sql basinda otomatik eklenir
-- 42P13 (return type / default degisimi) ve 42710 (policy zaten var) onler
-- Ayri calistirmaya gerek yok; tek bundle yeterli.
-- =============================================================================

-- Staff (wave2 eski OUT kolonlari vs staff_phone_digest genisletilmis tablo)
drop function if exists public.get_org_staff();

-- Odontogram / periodontal (parametre default + imza degisiklikleri)
drop function if exists public.get_patient_odontogram(uuid, uuid);
drop function if exists public.upsert_tooth_finding(
  uuid, uuid, uuid, uuid, text, text, text, text[], text, text, text, uuid
);
drop function if exists public.get_patient_periodontal(uuid, uuid);
drop function if exists public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid);

-- Consent signing (2-param -> genisletilmis imzalar)
drop function if exists public.lock_signed_consent(uuid, text);
drop function if exists public.lock_signed_consent(uuid, text, jsonb, text);
drop function if exists public.create_consent_signing_token(uuid, text, int);
drop function if exists public.get_consent_by_signing_token(text);
drop function if exists public.lock_consent_via_signing_token(text, text, jsonb, text);
drop function if exists public.upsert_org_consent_template(jsonb);

-- Dental chart RLS (42710)
drop policy if exists dental_charts_select on public.dental_charts;
drop policy if exists dental_charts_insert on public.dental_charts;
drop policy if exists dental_charts_update on public.dental_charts;
drop policy if exists tooth_findings_select on public.tooth_findings;
drop policy if exists tooth_findings_insert on public.tooth_findings;
drop policy if exists tooth_findings_update on public.tooth_findings;
drop policy if exists dental_chart_audit_select on public.dental_chart_audit_events;

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

-- get_org_staff: 20260612230000_staff_phone_digest.sql (phone + is_owner_or_admin)

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

drop policy if exists invoice_payments_org on public.invoice_payments;
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

drop policy if exists branch_procedure_prices_org on public.branch_procedure_prices;
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

drop policy if exists patient_intakes_org on public.patient_intakes;
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

drop policy if exists patient_insurance_org on public.patient_insurance_profiles;
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


-- ===== 20260610000000_consent_fields_and_signing_tokens.sql =====

-- Consent fillable fields, patient responses, and public signing tokens

-- Eski imzalar (2 parametre) yeni overload ile cakismasin
drop function if exists public.lock_signed_consent(uuid, text);
drop function if exists public.create_consent_signing_token(uuid, text, int);
drop function if exists public.get_consent_by_signing_token(text);
drop function if exists public.lock_consent_via_signing_token(text, text, jsonb, text);
drop function if exists public.lock_signed_consent(uuid, text, jsonb, text);
drop function if exists public.upsert_org_consent_template(jsonb);

alter table public.consent_templates
  add column if not exists fields jsonb not null default '[]'::jsonb;

alter table public.patient_consents
  add column if not exists field_responses jsonb,
  add column if not exists body_snapshot text;

-- Default fillable fields on global general-treatment template
update public.consent_templates
set fields = '[
  {"id":"emergency_contact","type":"text","label":"Emergency contact name & number","required":true,"placeholder":"Name, phone"},
  {"id":"procedure_acknowledged","type":"yes_no","label":"I understand the proposed treatment and alternatives were explained","required":true},
  {"id":"questions_answered","type":"checkbox","label":"I had the opportunity to ask questions and they were answered","required":true},
  {"id":"patient_initials","type":"initials","label":"Patient initials","required":true,"placeholder":"e.g. MS"}
]'::jsonb
where slug = 'general-treatment'
  and organization_id is null
  and fields = '[]'::jsonb;

create table if not exists public.consent_signing_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_consent_id uuid not null references public.patient_consents(id) on delete cascade,
  token text not null unique,
  channel text not null default 'qr' check (channel in ('kiosk', 'sms', 'email', 'qr')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consent_signing_tokens_consent_idx
  on public.consent_signing_tokens (patient_consent_id);

alter table public.consent_signing_tokens enable row level security;

drop policy if exists consent_signing_tokens_staff on public.consent_signing_tokens;
drop policy if exists consent_signing_tokens_staff on public.consent_signing_tokens;
create policy consent_signing_tokens_staff on public.consent_signing_tokens
  for select to authenticated
  using (
    exists (
      select 1 from public.patient_consents pc
      where pc.id = patient_consent_id
        and pc.organization_id = public.current_user_org_id()
    )
  );

-- Staff: create signing link
create or replace function public.create_consent_signing_token(
  p_consent_id uuid,
  p_channel text default 'qr',
  p_ttl_hours int default 72
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_token text;
begin
  select * into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id();

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status <> 'pending' then
    raise exception 'Consent is not pending';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    p_consent_id,
    v_token,
    coalesce(nullif(trim(p_channel), ''), 'qr'),
    now() + make_interval(hours => greatest(p_ttl_hours, 1)),
    auth.uid()
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', (now() + make_interval(hours => greatest(p_ttl_hours, 1)))::text
  );
end;
$$;

grant execute on function public.create_consent_signing_token(uuid, text, int) to authenticated;

-- Public: load consent for signing (anon)
create or replace function public.get_consent_by_signing_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_template record;
  v_patient record;
  v_org record;
begin
  select t.*, pc.*
  into v_row
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
    and pc.status = 'pending';

  if v_row.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  select slug, name, body, version, fields
  into v_template
  from public.consent_templates
  where slug = v_row.template_slug
    and is_active = true
    and (organization_id = v_row.organization_id or organization_id is null)
  order by organization_id nulls last
  limit 1;

  select first_name, last_name, date_of_birth
  into v_patient
  from public.patients
  where id = v_row.patient_id;

  select name into v_org from public.organizations where id = v_row.organization_id;

  return jsonb_build_object(
    'consent_id', v_row.patient_consent_id,
    'template_slug', v_row.template_slug,
    'template_name', coalesce(v_template.name, v_row.template_name),
    'template_body', coalesce(v_template.body, ''),
    'template_version', coalesce(v_template.version, '1.0'),
    'fields', coalesce(v_template.fields, '[]'::jsonb),
    'patient_first_name', v_patient.first_name,
    'patient_last_name', v_patient.last_name,
    'patient_dob', v_patient.date_of_birth,
    'org_name', coalesce(v_org.name, 'Clinic')
  );
end;
$$;

grant execute on function public.get_consent_by_signing_token(text) to anon, authenticated;

-- Public: sign via token
create or replace function public.lock_consent_via_signing_token(
  p_token text,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
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

  select t.*, pc.id as cid, pc.status as cstatus, pc.organization_id, pc.branch_id, pc.template_slug
  into v_token
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
  for update of t, pc;

  if v_token.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  if v_token.cstatus <> 'pending' then
    raise exception 'Consent already signed or voided';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = null,
    signature_data = p_signature_data,
    field_responses = p_field_responses,
    body_snapshot = p_body_snapshot
  where id = v_token.patient_consent_id;

  update public.consent_signing_tokens
  set used_at = now()
  where id = v_token.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_token.organization_id,
    v_token.branch_id,
    null,
    'consent.signed_via_token',
    'patient_consent',
    v_token.patient_consent_id::text,
    jsonb_build_object(
      'template_slug', v_token.template_slug,
      'channel', v_token.channel,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient')
    )
  );
end;
$$;

grant execute on function public.lock_consent_via_signing_token(text, text, jsonb, text) to anon, authenticated;

-- Extend staff signing with field responses
create or replace function public.lock_signed_consent(
  p_consent_id uuid,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
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
    signature_data = p_signature_data,
    field_responses = coalesce(p_field_responses, field_responses),
    body_snapshot = coalesce(p_body_snapshot, body_snapshot)
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

grant execute on function public.lock_signed_consent(uuid, text, jsonb, text) to authenticated;

-- Org template admin: persist fields
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
  v_fields jsonb := coalesce(p_payload->'fields', '[]'::jsonb);
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
    organization_id, slug, name, body, version, is_active, fields
  ) values (
    v_org, v_slug, v_name, v_body, v_version, v_is_active, v_fields
  )
  on conflict (organization_id, slug) do update
  set
    name = excluded.name,
    body = excluded.body,
    version = excluded.version,
    is_active = excluded.is_active,
    fields = excluded.fields;

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
        'organization_id', ct.organization_id,
        'fields', coalesce(ct.fields, '[]'::jsonb)
      )
      order by ct.slug, ct.organization_id nulls first
    ),
    '[]'::jsonb
  )
  from public.consent_templates ct
  where ct.organization_id is null
     or ct.organization_id = public.current_user_org_id();
$$;


-- ===== 20260610100000_search_patients_filters.sql =====

-- Patient registry list: status, last-visit date, sort, intake score
create or replace function public.search_patients(
  p_query text,
  p_branch_id uuid default null,
  p_limit int default 20,
  p_offset int default 0,
  p_status text default 'active',
  p_last_visit_from timestamptz default null,
  p_last_visit_to timestamptz default null,
  p_never_visited boolean default false,
  p_sort text default 'name'
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
  intake_pct int,
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with base as (
    select
      p.id,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.phone,
      p.email,
      p.status,
      pbl.last_visit_at,
      least(100, (
        (case when coalesce(p.phone, '') <> '' then 25 else 0 end)
        + (case when p.date_of_birth is not null then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_medical_histories pmh
            where pmh.patient_id = p.id
            limit 1
          ) then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_consents pc
            where pc.patient_id = p.id and pc.status = 'signed'
            limit 1
          ) then 25 else 0 end)
      ))::int as intake_pct
    from public.patients p
    left join public.patient_branch_links pbl
      on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
    where p.organization_id = public.current_user_org_id()
      and (
        p_status is null
        or p_status = 'all'
        or p.status = p_status
      )
      and (
        p_query is null
        or p_query = ''
        or p.first_name ilike '%' || p_query || '%'
        or p.last_name ilike '%' || p_query || '%'
        or p.phone ilike '%' || p_query || '%'
      )
      and (
        (not p_never_visited)
        or pbl.last_visit_at is null
      )
      and (
        p_never_visited
        or (
          (p_last_visit_from is null or pbl.last_visit_at >= p_last_visit_from)
          and (p_last_visit_to is null or pbl.last_visit_at <= p_last_visit_to)
        )
      )
  )
  select
    b.id,
    b.first_name,
    b.last_name,
    b.date_of_birth,
    b.phone,
    b.email,
    b.status,
    b.last_visit_at,
    b.intake_pct,
    count(*) over() as total_count
  from base b
  order by
    case when coalesce(p_sort, 'name') = 'last_visit_desc' then b.last_visit_at end desc nulls last,
    case when p_sort = 'last_visit_asc' then b.last_visit_at end asc nulls last,
    b.last_name asc,
    b.first_name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;


-- ===== 20260610100001_fix_patients_rls_recursion.sql =====

-- Break infinite RLS recursion: patients_select â†’ patient_branch_links â†’ patients

create or replace function public.patient_org_id(p_patient_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id from public.patients where id = p_patient_id;
$$;

grant execute on function public.patient_org_id(uuid) to authenticated;

drop policy if exists patient_branch_links_all on public.patient_branch_links;

drop policy if exists patient_branch_links_all on public.patient_branch_links;
create policy patient_branch_links_all on public.patient_branch_links
  for all to authenticated
  using (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  );

drop policy if exists patient_contacts_all on public.patient_contacts;

drop policy if exists patient_contacts_all on public.patient_contacts;
create policy patient_contacts_all on public.patient_contacts
  for all to authenticated
  using (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  );


-- ===== 20260610120000_clinic_paper_consent_templates.sql =====

-- Clinic paper/PDF consent templates (DRG, PDA) â€” selectable on demand, not all auto-seeded

alter table public.consent_templates
  add column if not exists form_category text not null default 'consent',
  add column if not exists is_default boolean not null default false,
  add column if not exists source_asset text,
  add column if not exists description text;

delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

drop index if exists public.idx_consent_templates_global_slug;
create unique index if not exists idx_consent_templates_global_slug
  on public.consent_templates (slug)
  where organization_id is null;

-- Only core intake consents auto-created for new patients
update public.consent_templates
set is_default = true,
    form_category = 'consent',
    source_asset = 'PDA'
where organization_id is null
  and slug in ('dpa-consent', 'general-treatment');

update public.consent_templates
set form_category = 'consent',
    source_asset = 'DRG',
    description = 'Orthodontic treatment agreement and risks'
where organization_id is null
  and slug = 'ortho-agreement';

-- DRG CONFORME (from dental record paper)
insert into public.consent_templates (
  organization_id, slug, name, body, version, is_active,
  form_category, is_default, source_asset, description, fields
) values (
  null,
  'drg-conforme',
  'CONFORME â€” Informed Consent (DRG)',
  'CONFORME (Informed Consent)

I hereby authorize the dentist to perform upon me dental treatment deemed necessary or advisable, including the use of anesthesia.

I understand that dentistry is not an exact science and authorize my dentist to make whatever changes deemed necessary during treatment.

I agree to be responsible for all costs of dental treatment rendered on my behalf, including clinic fees and associated laboratory costs.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}
Clinic: {{clinic_name}}',
  '1.0',
  true,
  'consent',
  false,
  'DRG',
  'Standard informed consent block from DRG dental record',
  '[
    {"id":"anesthesia_ack","type":"yes_no","label":"I understand that anesthesia may be used as part of my treatment","required":true},
    {"id":"cost_ack","type":"yes_no","label":"I agree to be responsible for applicable treatment and laboratory fees","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]'::jsonb
) on conflict (slug) where (organization_id is null) do update set
  name = excluded.name,
  body = excluded.body,
  version = excluded.version,
  form_category = excluded.form_category,
  source_asset = excluded.source_asset,
  description = excluded.description,
  fields = excluded.fields;

-- Procedure-specific consents (docs/04 + clinic paper set)
insert into public.consent_templates (
  organization_id, slug, name, body, version, is_active,
  form_category, is_default, source_asset, description, fields
) values
(
  null, 'radiograph-consent', 'Radiograph / X-Ray Consent',
  'I consent to dental radiographs (X-rays) as recommended by my dentist for diagnosis and treatment planning.

I understand that radiographs involve low levels of radiation and that reasonable precautions will be taken.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Consent for diagnostic imaging',
  '[{"id":"pregnancy_status","type":"yes_no","label":"Are you pregnant or could you be pregnant?","required":true},{"id":"risks_explained","type":"yes_no","label":"Risks and purpose of X-rays were explained to me","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'extraction-consent', 'Extraction / Removal Consent',
  'I consent to the extraction (removal) of the tooth/teeth discussed with my dentist.

I understand risks may include pain, swelling, bleeding, infection, nerve injury, sinus involvement, and dry socket.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Tooth extraction consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth number / site","required":true,"placeholder":"e.g. #16"},{"id":"risks_ack","type":"yes_no","label":"Risks, benefits, and alternatives were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'crown-bridge-consent', 'Crown / Bridge Consent',
  'I consent to crown or bridge treatment as discussed with my dentist.

I understand risks may include sensitivity, need for root canal, fracture, or replacement over time.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Fixed prosthodontics consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth/teeth involved","required":true},{"id":"procedure_explained","type":"yes_no","label":"Procedure, risks, and alternatives were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'root-canal-consent', 'Endodontic / Root Canal Consent',
  'I consent to endodontic (root canal) treatment on the tooth discussed with my dentist.

I understand success is not guaranteed and retreatment, surgery, or extraction may be needed.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Root canal therapy consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth number","required":true},{"id":"risks_ack","type":"yes_no","label":"Risks and alternatives were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'periodontal-consent', 'Periodontal Treatment Consent',
  'I consent to periodontal (gum) treatment as recommended.

I understand that periodontal disease may progress without treatment and that maintenance visits are important.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Periodontal therapy consent',
  '[{"id":"treatment_desc","type":"text","label":"Treatment described","required":true,"placeholder":"e.g. scaling & root planing"},{"id":"risks_ack","type":"yes_no","label":"Risks and home care instructions were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'filling-consent', 'Filling / Restoration Consent',
  'I consent to restorative (filling) treatment on the tooth/teeth discussed.

I understand sensitivity or need for further treatment may occur.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Restorative treatment consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth number / surface","required":true},{"id":"material_ack","type":"yes_no","label":"Material options were discussed","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'denture-consent', 'Denture Consent',
  'I consent to removable denture treatment as discussed.

I understand adaptation time is required and adjustments may be needed.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Removable prosthodontics consent',
  '[{"id":"denture_type","type":"text","label":"Type (partial / complete)","required":true},{"id":"expectations_ack","type":"yes_no","label":"Expectations and care instructions were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'medication-risk-consent', 'Medication Risk Consent',
  'I understand the medications prescribed or administered for my dental treatment, including possible side effects and interactions.

I will inform the clinic of all medications and supplements I take.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'PDA', 'Medication risks acknowledgment',
  '[{"id":"med_list_reviewed","type":"yes_no","label":"My current medications were reviewed with the dentist","required":true},{"id":"allergy_disclosed","type":"yes_no","label":"I disclosed known drug allergies","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'treatment-plan-change-consent', 'Change in Treatment Plan Consent',
  'I consent to changes in my treatment plan as discussed during treatment.

I understand the reason for the change and any impact on fees or appointments.

Patient: {{patient_name}} Â· {{today_date}} Â· {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'When planned treatment changes mid-course',
  '[{"id":"change_summary","type":"text","label":"Summary of change","required":true},{"id":"fees_discussed","type":"yes_no","label":"Fee impact was discussed","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
)
on conflict (slug) where (organization_id is null) do update set
  name = excluded.name,
  body = excluded.body,
  version = excluded.version,
  form_category = excluded.form_category,
  source_asset = excluded.source_asset,
  description = excluded.description,
  fields = excluded.fields;

-- Enrich existing global templates
update public.consent_templates
set
  description = 'Republic Act No. 10173 â€” health data processing consent',
  source_asset = 'PDA',
  fields = '[
    {"id":"data_use_ack","type":"yes_no","label":"I consent to collection and use of my personal and health information per the Data Privacy Act","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]'::jsonb
where organization_id is null and slug = 'dpa-consent';

update public.consent_templates
set
  description = 'General dental examination and treatment consent',
  source_asset = 'DRG',
  body = 'I consent to dental examination, diagnosis, and treatment as recommended by my dental provider at {{clinic_name}}.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}',
  fields = '[
    {"id":"emergency_contact","type":"text","label":"Emergency contact name & number","required":true,"placeholder":"Name, phone"},
    {"id":"procedure_acknowledged","type":"yes_no","label":"I understand the proposed treatment and alternatives were explained","required":true},
    {"id":"questions_answered","type":"checkbox","label":"I had the opportunity to ask questions and they were answered","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]'::jsonb
where organization_id is null and slug = 'general-treatment';

update public.consent_templates
set fields = '[
  {"id":"ortho_duration_ack","type":"yes_no","label":"I understand treatment duration varies and cooperation is required","required":true},
  {"id":"hygiene_ack","type":"yes_no","label":"I understand good oral hygiene is essential during orthodontic treatment","required":true},
  {"id":"retainer_ack","type":"yes_no","label":"I understand retainers are required after active treatment to prevent relapse","required":true},
  {"id":"patient_initials","type":"initials","label":"Initials","required":true}
]'::jsonb
where organization_id is null and slug = 'ortho-agreement';

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
        'organization_id', ct.organization_id,
        'fields', coalesce(ct.fields, '[]'::jsonb),
        'form_category', coalesce(ct.form_category, 'consent'),
        'is_default', coalesce(ct.is_default, false),
        'source_asset', ct.source_asset,
        'description', ct.description
      )
      order by ct.name, ct.organization_id nulls first
    ),
    '[]'::jsonb
  )
  from public.consent_templates ct
  where ct.is_active = true
    and (ct.organization_id is null or ct.organization_id = public.current_user_org_id());
$$;


-- ===== 20260610140000_multi_branch_tenant.sql =====

-- Multi-branch tenant model: org isolation + secure branch creation

-- ========== ONKOSUL (tekrar calistirilabilir) ==========
create extension if not exists pgcrypto;

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

create table if not exists public.clinic_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean default false,
  unique(branch_id, day_of_week)
);

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

create or replace function public.ensure_branch_clinic_hours(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d integer;
begin
  for d in 0..6 loop
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values (
      p_branch_id,
      d,
      case when d in (0, 6) then null else '09:00'::time end,
      case when d in (0, 6) then null else '18:00'::time end,
      d in (0, 6)
    )
    on conflict (branch_id, day_of_week) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenant metadata (each rented clinic = one organization)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists slug text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'trial')),
  add column if not exists plan_tier text not null default 'standard'
    check (plan_tier in ('trial', 'standard', 'enterprise'));

create unique index if not exists idx_organizations_slug
  on public.organizations (lower(slug))
  where slug is not null;

-- ---------------------------------------------------------------------------
-- RLS: use user_is_org_admin() (auth.role() is always 'authenticated' in Supabase)
-- ---------------------------------------------------------------------------
drop policy if exists org_update on public.organizations;
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update using (
    id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (
    id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists branch_insert on public.branches;
drop policy if exists branch_insert on public.branches;
create policy branch_insert on public.branches
  for insert with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists branch_update on public.branches;
drop policy if exists branch_update on public.branches;
create policy branch_update on public.branches
  for update using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists branch_select on public.branches;
drop policy if exists branch_select on public.branches;
create policy branch_select on public.branches
  for select using (
    organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or public.user_has_branch_access(id)
    )
  );

-- ---------------------------------------------------------------------------
-- Slug helper
-- ---------------------------------------------------------------------------
create or replace function public.slugify_org_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

-- Backfill slug for existing organizations
update public.organizations o
set slug = coalesce(
  public.slugify_org_name(o.name),
  'clinic'
) || '-' || left(replace(o.id::text, '-', ''), 8)
where o.slug is null;

-- ---------------------------------------------------------------------------
-- Create branch (admin RPC): hours seed + optional staff assignment
-- ---------------------------------------------------------------------------
create or replace function public.create_org_branch(
  p_name text,
  p_address text default null,
  p_contact_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.current_user_org_id();
  v_branch_id uuid;
  v_role_id uuid;
begin
  if v_org_id is null then
    raise exception 'No organization context';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Branch name is required (min 2 characters)';
  end if;

  insert into public.branches (organization_id, name, address, contact_number, is_active)
  values (v_org_id, trim(p_name), nullif(trim(p_address), ''), nullif(trim(p_contact_number), ''), true)
  returning id into v_branch_id;

  perform public.ensure_branch_clinic_hours(v_branch_id);

  -- Assign creator to the new branch (same role they hold on another branch, else admin)
  select sba.role_id into v_role_id
  from public.staff_branch_assignments sba
  join public.roles r on r.id = sba.role_id
  where sba.profile_id = auth.uid()
  order by case r.name when 'owner' then 0 when 'admin' then 1 else 2 end
  limit 1;

  if v_role_id is null then
    select id into v_role_id from public.roles where name = 'admin' limit 1;
  end if;

  if v_role_id is not null then
    insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
    values (auth.uid(), v_branch_id, v_role_id)
    on conflict (profile_id, branch_id) do update set role_id = excluded.role_id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id,
    v_branch_id,
    auth.uid(),
    'branch.create',
    'branch',
    v_branch_id::text,
    jsonb_build_object('name', trim(p_name))
  );

  return jsonb_build_object(
    'status', 'created',
    'branch_id', v_branch_id,
    'organization_id', v_org_id
  );
end;
$$;

grant execute on function public.create_org_branch(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap: set org slug on first signup
-- ---------------------------------------------------------------------------
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
  v_slug text;
  v_slug_base text;
  v_suffix int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    return jsonb_build_object('status', 'already_bootstrapped');
  end if;

  select email into v_email from auth.users where id = v_user_id;

  v_slug_base := public.slugify_org_name(p_org_name);
  if v_slug_base is null then
    v_slug_base := 'clinic';
  end if;
  v_slug := v_slug_base;
  while exists (select 1 from public.organizations where lower(slug) = lower(v_slug)) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (name, slug, status, plan_tier)
  values (p_org_name, v_slug, 'trial', 'trial')
  returning id into v_org_id;

  insert into public.branches (organization_id, name) values (v_org_id, p_branch_name) returning id into v_branch_id;
  insert into public.organization_settings (organization_id) values (v_org_id);
  insert into public.profiles (id, organization_id, email, full_name)
    values (v_user_id, v_org_id, coalesce(v_email, ''), split_part(coalesce(v_email, 'Owner'), '@', 1));
  insert into public.staff_profiles (profile_id) values (v_user_id);

  select id into v_owner_role_id from public.roles where name = 'owner' limit 1;
  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
    values (v_user_id, v_branch_id, v_owner_role_id);

  perform public.ensure_branch_clinic_hours(v_branch_id);

  return jsonb_build_object(
    'status', 'created',
    'organization_id', v_org_id,
    'branch_id', v_branch_id,
    'slug', v_slug
  );
end;
$$;


-- ===== 20260611010000_audit_trail_filters.sql =====

-- Extend unified audit trail with optional date and text filters

create or replace function public.get_unified_audit_trail(
  p_branch_id uuid default null,
  p_source text default 'all',
  p_limit int default 100,
  p_offset int default 0,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_action_contains text default null,
  p_actor_contains text default null,
  p_entity_type text default null
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
  where (p_since is null or combined.created_at >= p_since)
    and (p_until is null or combined.created_at <= p_until)
    and (
      p_action_contains is null
      or btrim(p_action_contains) = ''
      or combined.action ilike '%' || btrim(p_action_contains) || '%'
    )
    and (
      p_actor_contains is null
      or btrim(p_actor_contains) = ''
      or combined.actor_name ilike '%' || btrim(p_actor_contains) || '%'
    )
    and (
      p_entity_type is null
      or btrim(p_entity_type) = ''
      or combined.entity_type ilike btrim(p_entity_type)
    )
  order by combined.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_unified_audit_trail(
  uuid, text, int, int, timestamptz, timestamptz, text, text, text
) to authenticated;


-- ===== 20260611020000_audit_entity_history.sql =====

-- Entity-scoped audit history for record detail panels

create or replace function public.get_unified_audit_trail(
  p_branch_id uuid default null,
  p_source text default 'all',
  p_limit int default 100,
  p_offset int default 0,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_action_contains text default null,
  p_actor_contains text default null,
  p_entity_type text default null,
  p_entity_id text default null
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
  where (p_since is null or combined.created_at >= p_since)
    and (p_until is null or combined.created_at <= p_until)
    and (
      p_action_contains is null
      or btrim(p_action_contains) = ''
      or combined.action ilike '%' || btrim(p_action_contains) || '%'
    )
    and (
      p_actor_contains is null
      or btrim(p_actor_contains) = ''
      or combined.actor_name ilike '%' || btrim(p_actor_contains) || '%'
    )
    and (
      p_entity_type is null
      or btrim(p_entity_type) = ''
      or combined.entity_type ilike btrim(p_entity_type)
    )
    and (
      p_entity_id is null
      or btrim(p_entity_id) = ''
      or combined.entity_id = btrim(p_entity_id)
    )
  order by combined.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_unified_audit_trail(
  uuid, text, int, int, timestamptz, timestamptz, text, text, text, text
) to authenticated;


-- ===== 20260611030000_workflow_automation_analytics.sql =====

-- Workflow engine, cross-module automation, owner analytics RPCs

-- ---------------------------------------------------------------------------
-- Appointment status: add checked_in
-- ---------------------------------------------------------------------------
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'));

-- ---------------------------------------------------------------------------
-- Workflow tables
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_events_unprocessed
  on public.workflow_events(organization_id, created_at desc)
  where processed_at is null;

alter table public.workflow_events enable row level security;

drop policy if exists workflow_events_select on public.workflow_events;
drop policy if exists workflow_events_select on public.workflow_events;
create policy workflow_events_select on public.workflow_events
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (public.user_is_org_admin() or public.has_permission('audit.read', branch_id))
  );

create table if not exists public.branch_workflow_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  settings jsonb not null default jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true
  ),
  updated_at timestamptz not null default now()
);

alter table public.branch_workflow_settings enable row level security;

drop policy if exists branch_workflow_settings_select on public.branch_workflow_settings;
drop policy if exists branch_workflow_settings_select on public.branch_workflow_settings;
create policy branch_workflow_settings_select on public.branch_workflow_settings
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists branch_workflow_settings_write on public.branch_workflow_settings;
drop policy if exists branch_workflow_settings_write on public.branch_workflow_settings;
create policy branch_workflow_settings_write on public.branch_workflow_settings
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('settings.manage', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

create table if not exists public.slot_notification_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  slot_at timestamptz not null,
  source_appointment_id uuid references public.appointments(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_slot_notification_pending
  on public.slot_notification_queue(branch_id, created_at)
  where processed_at is null;

alter table public.slot_notification_queue enable row level security;

drop policy if exists slot_notification_queue_select on public.slot_notification_queue;
drop policy if exists slot_notification_queue_select on public.slot_notification_queue;
create policy slot_notification_queue_select on public.slot_notification_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.read', branch_id)
  );

-- ---------------------------------------------------------------------------
-- Workflow helpers
-- ---------------------------------------------------------------------------
create or replace function public._default_workflow_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true
  );
$$;

create or replace function public._workflow_enabled(p_branch_id uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  if p_branch_id is null then
    return true;
  end if;

  select coalesce(bws.settings, public._default_workflow_settings())
  into v_settings
  from public.branch_workflow_settings bws
  where bws.branch_id = p_branch_id;

  if v_settings is null then
    v_settings := public._default_workflow_settings();
  end if;

  return coalesce((v_settings ->> p_key)::boolean, true);
end;
$$;

create or replace function public.emit_workflow_event(
  p_branch_id uuid,
  p_event_type text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_id uuid;
begin
  insert into public.workflow_events (
    organization_id, branch_id, event_type, entity_type, entity_id, payload
  ) values (
    v_org, p_branch_id, p_event_type, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_branch_workflow_settings(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(bws.settings, public._default_workflow_settings())
  into v_settings
  from public.branch_workflow_settings bws
  where bws.branch_id = p_branch_id;

  return coalesce(v_settings, public._default_workflow_settings());
end;
$$;

grant execute on function public.get_branch_workflow_settings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invoice draft from treatment plan (internal + automation)
-- ---------------------------------------------------------------------------
create or replace function public._create_invoice_draft_from_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_existing uuid;
  v_invoice_id uuid;
  v_item record;
  v_inv_num text;
begin
  select * into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id();

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  select id into v_existing
  from public.invoices
  where treatment_plan_id = p_plan_id
    and status <> 'void'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_inv_num := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.invoices (
    organization_id, branch_id, patient_id, treatment_plan_id,
    invoice_number, total_amount, paid_amount, status, created_by
  ) values (
    v_plan.organization_id, v_plan.branch_id, v_plan.patient_id, p_plan_id,
    v_inv_num, 0, 0, 'draft', auth.uid()
  )
  returning id into v_invoice_id;

  for v_item in
    select * from public.treatment_plan_items where plan_id = p_plan_id order by created_at
  loop
    perform public.add_invoice_line_item(
      v_invoice_id,
      coalesce(v_item.description, 'Treatment item'),
      coalesce(v_item.estimated_price, 0),
      1,
      v_item.tooth_number,
      v_item.procedure_id,
      v_item.id
    );
  end loop;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'invoice.auto_draft_from_plan',
    'invoice',
    v_invoice_id::text,
    jsonb_build_object('treatment_plan_id', p_plan_id)
  );

  return v_invoice_id;
end;
$$;

create or replace function public._auto_hmo_claim_for_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_ins record;
  v_provider_id uuid;
  v_claim_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null then return null; end if;

  select pip.* into v_ins
  from public.patient_insurance_profiles pip
  where pip.patient_id = v_inv.patient_id
    and pip.payer_type = 'hmo'
    and pip.is_primary = true
  limit 1;

  if v_ins.id is null then return null; end if;

  select hp.id into v_provider_id
  from public.hmo_providers hp
  where hp.organization_id = v_inv.organization_id
    and hp.is_active = true
    and lower(hp.name) = lower(coalesce(v_ins.payer_name, ''))
  limit 1;

  if exists (
    select 1 from public.hmo_claims hc
    where hc.invoice_id = p_invoice_id and hc.status <> 'rejected'
  ) then
    return null;
  end if;

  insert into public.hmo_claims (
    organization_id, branch_id, patient_id, invoice_id, provider_id,
    member_id, claimed_amount, status, created_by
  ) values (
    v_inv.organization_id, v_inv.branch_id, v_inv.patient_id, p_invoice_id, v_provider_id,
    v_ins.member_id, v_inv.total_amount, 'draft', auth.uid()
  )
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approve plan â†’ auto invoice (+ optional HMO)
-- ---------------------------------------------------------------------------
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
  v_invoice_id uuid := null;
  v_claim_id uuid := null;
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

  if public._workflow_enabled(v_plan.branch_id, 'auto_approve_creates_invoice') then
    v_invoice_id := public._create_invoice_draft_from_plan(p_plan_id);
    if public._workflow_enabled(v_plan.branch_id, 'auto_hmo_claim_on_invoice') and v_invoice_id is not null then
      v_claim_id := public._auto_hmo_claim_for_invoice(v_invoice_id);
    end if;
    perform public.emit_workflow_event(
      v_plan.branch_id,
      'treatment_plan.approved',
      'treatment_plan',
      p_plan_id::text,
      jsonb_build_object('invoice_id', v_invoice_id, 'hmo_claim_id', v_claim_id)
    );
  end if;

  return v_estimate || jsonb_build_object(
    'status', 'approved',
    'approved_at', now(),
    'invoice_id', v_invoice_id,
    'hmo_claim_id', v_claim_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in â†’ appointment checked_in + consent gate
-- ---------------------------------------------------------------------------
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
  v_force boolean := coalesce((p_payload->>'force_checkin')::boolean, false);
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
  v_pending_consents int;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if not public.has_permission('queue.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if public._workflow_enabled(v_branch_id, 'consent_gate_checkin') and not v_force then
    select count(*) into v_pending_consents
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_org
      and pc.status = 'pending';

    if v_pending_consents > 0 then
      raise exception 'Pending consents must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if v_force and public._workflow_enabled(v_branch_id, 'consent_gate_checkin') then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_patient_id::text,
      jsonb_build_object('pending_consents', v_pending_consents)
    );
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  if v_appointment_id is null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    select a.id into v_appointment_id
    from public.appointments a
    where a.branch_id = v_branch_id
      and a.patient_id = v_patient_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status in ('scheduled', 'confirmed')
    order by a.scheduled_at
    limit 1;
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

  if v_appointment_id is not null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_branch_id, 'patient.checked_in', 'queue_entry', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'appointment_id', v_appointment_id, 'display_code', v_code)
  );

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'status', 'waiting',
    'appointment_id', v_appointment_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue served â†’ appointment completed
-- ---------------------------------------------------------------------------
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

  if p_status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'completed', updated_at = now()
    where id = v_entry.appointment_id
      and status in ('checked_in', 'scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_entry.branch_id, 'queue.status_changed', 'queue_entry', p_entry_id::text,
    jsonb_build_object('status', p_status, 'appointment_id', v_entry.appointment_id)
  );

  return jsonb_build_object('id', p_entry_id, 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- No-show â†’ slot notification queue
-- ---------------------------------------------------------------------------
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

  select a.* into v_appt
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

  if v_appt.status not in ('scheduled', 'confirmed', 'checked_in') then
    raise exception 'Only active appointments can be marked no-show';
  end if;

  update public.appointments
  set status = 'no_show', updated_at = now()
  where id = p_appointment_id;

  if public._workflow_enabled(v_appt.branch_id, 'auto_waitlist_on_slot_open') then
    insert into public.slot_notification_queue (
      organization_id, branch_id, slot_at, source_appointment_id
    ) values (
      v_appt.organization_id, v_appt.branch_id, v_appt.scheduled_at, p_appointment_id
    );
    perform public.emit_workflow_event(
      v_appt.branch_id, 'slot.opened', 'appointment', p_appointment_id::text,
      jsonb_build_object('slot_at', v_appt.scheduled_at)
    );
  end if;

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
    'branch_id', v_appt.branch_id,
    'waitlist_queued', public._workflow_enabled(v_appt.branch_id, 'auto_waitlist_on_slot_open')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner analytics RPC
-- ---------------------------------------------------------------------------
create or replace function public.get_owner_analytics(
  p_branch_id uuid default null,
  p_period_days int default 7,
  p_locale text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_daily_appts jsonb := '[]'::jsonb;
  v_daily_coll jsonb := '[]'::jsonb;
  v_status jsonb := '[]'::jsonb;
  v_branch_compare jsonb;
  v_totals jsonb;
  d date;
  v_cnt int;
  v_amt numeric;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if p_branch_id is not null then
    if not (
      public.user_is_org_admin()
      or public.has_permission('appointments.read', p_branch_id)
    ) then
      raise exception 'Permission denied';
    end if;
  elsif not public.user_is_org_admin() then
    raise exception 'Organization-wide analytics requires admin access';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := v_end - (p_period_days - 1);

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.appointments a
    where a.organization_id = v_org
      and (p_branch_id is null or a.branch_id = p_branch_id)
      and (a.scheduled_at at time zone 'Asia/Manila')::date = d;

    v_daily_appts := v_daily_appts || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));

    select coalesce(sum(ip.amount), 0) into v_amt
    from public.invoice_payments ip
    join public.invoices inv on inv.id = ip.invoice_id
    where inv.organization_id = v_org
      and (p_branch_id is null or inv.branch_id = p_branch_id)
      and ip.created_at::date = d;

    v_daily_coll := v_daily_coll || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_amt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'count', s.cnt) order by s.cnt desc), '[]'::jsonb)
  into v_status
  from (
    select a.status, count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and (p_branch_id is null or a.branch_id = p_branch_id)
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
    group by a.status
  ) s;

  if p_branch_id is null then
    select coalesce(jsonb_agg(jsonb_build_object('label', b.name, 'value', bc.cnt) order by bc.cnt desc), '[]'::jsonb)
    into v_branch_compare
    from (
      select inv.branch_id, count(*)::int as cnt
      from public.invoices inv
      where inv.organization_id = v_org
        and inv.status in ('draft', 'sent', 'partial')
      group by inv.branch_id
    ) bc
    join public.branches b on b.id = bc.branch_id;
  end if;

  select jsonb_build_object(
    'appointments', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'completed', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and a.status = 'completed' and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'cancelled', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and a.status = 'cancelled' and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'no_show', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and a.status = 'no_show' and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'collected', (select coalesce(sum(ip.amount), 0) from public.invoice_payments ip join public.invoices inv on inv.id = ip.invoice_id where inv.organization_id = v_org and (p_branch_id is null or inv.branch_id = p_branch_id) and ip.created_at::date between v_start and v_end),
    'open_invoices', (select count(*) from public.invoices inv where inv.organization_id = v_org and (p_branch_id is null or inv.branch_id = p_branch_id) and inv.status in ('draft', 'sent', 'partial')),
    'pending_consents', (select count(*) from public.patient_consents pc where pc.organization_id = v_org and (p_branch_id is null or pc.branch_id = p_branch_id) and pc.status = 'pending'),
    'queue_waiting', (select count(*) from public.queue_entries qe where qe.organization_id = v_org and (p_branch_id is null or qe.branch_id = p_branch_id) and qe.status in ('waiting', 'ready')),
    'hmo_draft', (select count(*) from public.hmo_claims hc where hc.organization_id = v_org and (p_branch_id is null or hc.branch_id = p_branch_id) and hc.status = 'draft')
  ) into v_totals;

  return jsonb_build_object(
    'period_days', p_period_days,
    'daily_appointments', v_daily_appts,
    'daily_collections', v_daily_coll,
    'status_breakdown', v_status,
    'totals', v_totals,
    'branch_compare', v_branch_compare
  );
end;
$$;

grant execute on function public.get_owner_analytics(uuid, int, text) to authenticated;

-- Queue analytics
create or replace function public.get_queue_analytics(
  p_branch_id uuid,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_median numeric;
  v_peak jsonb;
  v_flow jsonb;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select percentile_cont(0.5) within group (order by extract(epoch from (coalesce(called_at, completed_at) - checked_in_at)) / 60.0)
  into v_median
  from public.queue_entries
  where branch_id = p_branch_id
    and status = 'served'
    and checked_in_at >= now() - (greatest(p_period_days, 1) || ' days')::interval;

  select coalesce(jsonb_agg(jsonb_build_object('label', h.hr, 'value', h.cnt) order by h.cnt desc), '[]'::jsonb)
  into v_peak
  from (
    select to_char(checked_in_at at time zone 'Asia/Manila', 'HH24') || ':00' as hr, count(*)::int as cnt
    from public.queue_entries
    where branch_id = p_branch_id
      and checked_in_at >= now() - (greatest(p_period_days, 1) || ' days')::interval
    group by 1
    order by cnt desc
    limit 8
  ) h;

  select coalesce(jsonb_agg(jsonb_build_object('label', s.status, 'value', s.cnt)), '[]'::jsonb)
  into v_flow
  from (
    select status, count(*)::int as cnt
    from public.queue_entries
    where branch_id = p_branch_id
      and checked_in_at::date = current_date
    group by status
  ) s;

  return jsonb_build_object(
    'median_wait_minutes', round(coalesce(v_median, 0)::numeric, 1),
    'peak_hours', v_peak,
    'today_flow', v_flow
  );
end;
$$;

grant execute on function public.get_queue_analytics(uuid, int) to authenticated;

-- Daily closeout
create or replace function public.get_daily_closeout(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'date', p_date,
    'collected', (
      select coalesce(sum(ip.amount), 0)
      from public.invoice_payments ip
      join public.invoices inv on inv.id = ip.invoice_id
      where inv.organization_id = v_org
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and ip.created_at::date = p_date
    ),
    'open_balance', (
      select coalesce(sum(inv.total_amount - inv.paid_amount), 0)
      from public.invoices inv
      where inv.organization_id = v_org
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'open_invoice_count', (
      select count(*)
      from public.invoices inv
      where inv.organization_id = v_org
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'appointments_completed', (
      select count(*)
      from public.appointments a
      where a.organization_id = v_org
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'completed'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'no_show', (
      select count(*)
      from public.appointments a
      where a.organization_id = v_org
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'no_show'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'pending_consents', (
      select count(*)
      from public.patient_consents pc
      where pc.organization_id = v_org
        and (p_branch_id is null or pc.branch_id = p_branch_id)
        and pc.status = 'pending'
    ),
    'hmo_pending', (
      select count(*)
      from public.hmo_claims hc
      where hc.organization_id = v_org
        and (p_branch_id is null or hc.branch_id = p_branch_id)
        and hc.status in ('draft', 'submitted', 'under_review')
    ),
    'low_stock', (
      select case when p_branch_id is null then 0 else (
        select count(*) from public.inventory_items i
        where i.branch_id = p_branch_id and i.is_active
          and (i.quantity_on_hand <= i.min_stock_level or (i.expiry_date is not null and i.expiry_date < current_date))
      ) end
    )
  );
end;
$$;

grant execute on function public.get_daily_closeout(uuid, date) to authenticated;

-- AR aging
create or replace function public.get_ar_aging(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('billing.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('label', bucket, 'value', amt) order by ord)
    from (
      select
        case
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 30 then '0â€“30 days'
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 60 then '31â€“60 days'
          else '60+ days'
        end as bucket,
        case
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 30 then 1
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 60 then 2
          else 3
        end as ord,
        sum(inv.total_amount - inv.paid_amount) as amt
      from public.invoices inv
      where inv.branch_id = p_branch_id
        and inv.status in ('draft', 'sent', 'partial')
      group by 1, 2
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_ar_aging(uuid) to authenticated;


-- ===== 20260611040000_module_analytics_workflow_write.sql =====

-- Module-specific analytics RPCs + workflow settings write

-- ---------------------------------------------------------------------------
-- Upsert branch workflow settings
-- ---------------------------------------------------------------------------
create or replace function public.upsert_branch_workflow_settings(
  p_branch_id uuid,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_merged jsonb;
  v_result jsonb;
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(bws.settings, public._default_workflow_settings()) || coalesce(p_settings, '{}'::jsonb)
  into v_merged
  from public.branches b
  left join public.branch_workflow_settings bws on bws.branch_id = b.id
  where b.id = p_branch_id
    and b.organization_id = v_org;

  if v_merged is null then
    raise exception 'Branch not found';
  end if;

  insert into public.branch_workflow_settings (branch_id, organization_id, settings, updated_at)
  values (p_branch_id, v_org, v_merged, now())
  on conflict (branch_id) do update
  set settings = excluded.settings,
      updated_at = now()
  returning settings into v_result;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, p_branch_id, auth.uid(),
    'workflow_settings.updated', 'branch', p_branch_id::text,
    jsonb_build_object('settings', v_result)
  );

  return v_result;
end;
$$;

grant execute on function public.upsert_branch_workflow_settings(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Appointments analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_appointments_analytics(
  p_branch_id uuid,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_hourly jsonb := '[]'::jsonb;
  v_no_show jsonb := '[]'::jsonb;
  v_providers jsonb;
  d date;
  v_cnt int;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := v_end - (p_period_days - 1);

  select coalesce(jsonb_agg(jsonb_build_object('label', h.hr, 'value', h.cnt) order by h.hr), '[]'::jsonb)
  into v_hourly
  from (
    select to_char(a.scheduled_at at time zone 'Asia/Manila', 'HH24') || ':00' as hr,
           count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
      and a.status not in ('cancelled')
    group by 1
  ) h;

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and a.status = 'no_show'
      and (a.scheduled_at at time zone 'Asia/Manila')::date = d;

    v_no_show := v_no_show || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('label', coalesce(p.full_name, 'Unassigned'), 'value', pv.cnt) order by pv.cnt desc), '[]'::jsonb)
  into v_providers
  from (
    select coalesce(a.provider_id::text, 'none') as pid, count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
      and a.status not in ('cancelled', 'no_show')
    group by 1
  ) pv
  left join public.profiles p on p.id::text = pv.pid and pv.pid <> 'none';

  return jsonb_build_object(
    'hourly_load', v_hourly,
    'no_show_trend', v_no_show,
    'provider_utilization', v_providers,
    'occupancy_pct', (
      select round(
        100.0 * count(*) filter (where a.status in ('scheduled', 'confirmed', 'checked_in', 'completed'))
        / nullif(count(*), 0),
        1
      )
      from public.appointments a
      where a.organization_id = v_org
        and a.branch_id = p_branch_id
        and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
    )
  );
end;
$$;

grant execute on function public.get_appointments_analytics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Waitlist analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_waitlist_analytics(
  p_branch_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_funnel jsonb;
  v_conversion numeric;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', s.status, 'value', s.cnt) order by
    case s.status
      when 'waiting' then 1
      when 'contacted' then 2
      when 'booked' then 3
      when 'cancelled' then 4
      when 'expired' then 5
      else 6
    end), '[]'::jsonb)
  into v_funnel
  from (
    select status, count(*)::int as cnt
    from public.waitlist_entries
    where organization_id = v_org
      and branch_id = p_branch_id
      and created_at >= now() - (greatest(coalesce(p_period_days, 30), 1) || ' days')::interval
    group by status
  ) s;

  select round(
    100.0 * count(*) filter (where status = 'booked')
    / nullif(count(*) filter (where status in ('waiting', 'contacted', 'booked')), 0),
    1
  )
  into v_conversion
  from public.waitlist_entries
  where organization_id = v_org
    and branch_id = p_branch_id
    and created_at >= now() - (greatest(coalesce(p_period_days, 30), 1) || ' days')::interval;

  return jsonb_build_object(
    'status_funnel', v_funnel,
    'conversion_pct', coalesce(v_conversion, 0),
    'active_waiting', (
      select count(*)::int from public.waitlist_entries
      where organization_id = v_org and branch_id = p_branch_id and status = 'waiting'
    )
  );
end;
$$;

grant execute on function public.get_waitlist_analytics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Patients analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_patients_analytics(
  p_branch_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_new_patients jsonb := '[]'::jsonb;
  v_consent_rate numeric;
  d date;
  v_cnt int;
begin
  if not public.has_permission('patients.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 30), 90), 1);
  v_start := v_end - (p_period_days - 1);

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.patients p
    inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
    where p.organization_id = v_org
      and p.created_at::date = d;

    v_new_patients := v_new_patients || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select round(
    100.0 * count(*) filter (where pc.status = 'signed')
    / nullif(count(*), 0),
    1
  )
  into v_consent_rate
  from public.patient_consents pc
  inner join public.patient_branch_links pbl on pbl.patient_id = pc.patient_id and pbl.branch_id = p_branch_id
  where pc.organization_id = v_org;

  return jsonb_build_object(
    'new_patients_trend', v_new_patients,
    'consent_completion_pct', coalesce(v_consent_rate, 0),
    'total_active', (
      select count(*)::int
      from public.patients p
      inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
      where p.organization_id = v_org and p.status = 'active'
    )
  );
end;
$$;

grant execute on function public.get_patients_analytics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Inventory analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_inventory_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_levels jsonb;
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', lvl.label, 'value', lvl.cnt)), '[]'::jsonb)
  into v_levels
  from (
    select
      case
        when i.expiry_date is not null and i.expiry_date < current_date then 'Expired'
        when i.quantity_on_hand <= 0 then 'Out of stock'
        when i.quantity_on_hand <= i.min_stock_level then 'Low'
        when i.expiry_date is not null and i.expiry_date <= current_date + 30 then 'Expiring soon'
        else 'OK'
      end as label,
      count(*)::int as cnt
    from public.inventory_items i
    where i.organization_id = v_org
      and i.branch_id = p_branch_id
      and i.is_active = true
    group by 1
  ) lvl;

  return jsonb_build_object(
    'stock_levels', v_levels,
    'low_stock_count', (
      select count(*)::int
      from public.inventory_items i
      where i.organization_id = v_org
        and i.branch_id = p_branch_id
        and i.is_active = true
        and i.quantity_on_hand <= i.min_stock_level
    ),
    'total_skus', (
      select count(*)::int
      from public.inventory_items i
      where i.organization_id = v_org and i.branch_id = p_branch_id and i.is_active = true
    )
  );
end;
$$;

grant execute on function public.get_inventory_analytics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_audit_analytics(
  p_branch_id uuid default null,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_daily jsonb := '[]'::jsonb;
  v_top_actions jsonb;
  d date;
  v_cnt int;
begin
  if not public.has_permission('audit.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := v_end - (p_period_days - 1);

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.organization_audit_logs oal
    where oal.organization_id = v_org
      and (p_branch_id is null or oal.branch_id = p_branch_id)
      and oal.created_at::date = d;

    v_daily := v_daily || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('label', a.action, 'value', a.cnt) order by a.cnt desc), '[]'::jsonb)
  into v_top_actions
  from (
    select action, count(*)::int as cnt
    from public.organization_audit_logs oal
    where oal.organization_id = v_org
      and (p_branch_id is null or oal.branch_id = p_branch_id)
      and oal.created_at::date between v_start and v_end
    group by action
    order by cnt desc
    limit 8
  ) a;

  return jsonb_build_object(
    'daily_events', v_daily,
    'top_actions', v_top_actions,
    'total_events', (
      select count(*)::int
      from public.organization_audit_logs oal
      where oal.organization_id = v_org
        and (p_branch_id is null or oal.branch_id = p_branch_id)
        and oal.created_at::date between v_start and v_end
    )
  );
end;
$$;

grant execute on function public.get_audit_analytics(uuid, int) to authenticated;


-- ===== 20260611050000_marathon_final.sql =====


-- ===== 20260611090000_dashboard_waitlist_kpi.sql =====

-- Dashboard KPI: active waitlist entries awaiting contact

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
  v_waitlist_waiting bigint;
  v_open_invoices bigint;
  v_overdue_invoices bigint;
  v_today_collected numeric;
  v_low_stock bigint;
  v_missing_notes bigint;
  v_hmo_draft bigint;
  v_philhealth_pending bigint;
begin
  select count(*) into v_patients
  from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts
  from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
    and a.status in ('scheduled', 'confirmed', 'checked_in');

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

  select count(*) into v_waitlist_waiting
  from public.waitlist_entries we
  where we.organization_id = v_org
    and (p_branch_id is null or we.branch_id = p_branch_id)
    and we.status in ('waiting', 'contacted');

  select count(*) into v_open_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('draft', 'sent', 'partial');

  select count(*) into v_overdue_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('sent', 'partial')
    and inv.due_date is not null
    and inv.due_date < current_date
    and (inv.total_amount - inv.paid_amount) > 0;

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

    select count(*) into v_missing_notes
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and a.status = 'completed'
      and (a.scheduled_at at time zone 'Asia/Manila')::date >= (now() at time zone 'Asia/Manila')::date - 7
      and not exists (
        select 1 from public.clinical_notes cn
        where cn.patient_id = a.patient_id
          and cn.branch_id = a.branch_id
          and cn.status = 'signed'
          and (cn.appointment_id = a.id or cn.signed_at::date = (a.scheduled_at at time zone 'Asia/Manila')::date)
      );
  else
    v_low_stock := 0;
    v_missing_notes := 0;
  end if;

  select count(*) into v_hmo_draft
  from public.hmo_claims hc
  where hc.organization_id = v_org
    and (p_branch_id is null or hc.branch_id = p_branch_id)
    and hc.status = 'draft';

  select count(*) into v_philhealth_pending
  from public.philhealth_claims pc
  where pc.organization_id = v_org
    and (p_branch_id is null or pc.branch_id = p_branch_id)
    and pc.status in ('draft', 'checklist_incomplete', 'ready', 'sync_failed');

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents,
    'queue_waiting', v_queue_waiting,
    'waitlist_waiting', v_waitlist_waiting,
    'open_invoices', v_open_invoices,
    'overdue_invoices', v_overdue_invoices,
    'today_collected', v_today_collected,
    'low_stock_items', v_low_stock,
    'missing_clinical_notes', v_missing_notes,
    'hmo_draft_claims', v_hmo_draft,
    'philhealth_pending', v_philhealth_pending
  );
end;
$$;


-- ===== 20260611100000_marathon_analytics_attention.sql =====

-- Marathon: BOM workflow toggle + TV display heartbeat (VA-F3-04, VA-F4-24)

-- ---------------------------------------------------------------------------
-- Workflow: auto BOM deduct toggle
-- ---------------------------------------------------------------------------
create or replace function public._default_workflow_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true,
    'auto_deduct_procedure_bom', true
  );
$$;

alter table public.branch_workflow_settings
  alter column settings set default public._default_workflow_settings();

create or replace function public._deduct_bom_on_queue_served(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_appt record;
  v_item record;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if v_entry.id is null then return; end if;

  if not public._workflow_enabled(v_entry.branch_id, 'auto_deduct_procedure_bom') then
    return;
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.patient_id = v_entry.patient_id
    and a.branch_id = v_entry.branch_id
    and a.status = 'completed'
    and (a.scheduled_at at time zone 'Asia/Manila')::date = current_date
  order by a.updated_at desc
  limit 1;

  if v_appt.id is null then return; end if;

  for v_item in
    select distinct tpi.procedure_id
    from public.treatment_plan_items tpi
    join public.treatment_plans tp on tp.id = tpi.plan_id
    where tp.patient_id = v_entry.patient_id
      and tp.branch_id = v_entry.branch_id
      and tp.status = 'approved'
      and tpi.procedure_id is not null
    limit 3
  loop
    perform public._deduct_procedure_bom_internal(v_item.procedure_id, v_entry.branch_id, 'Auto BOM on queue served');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- TV display heartbeat (PII-free last refresh for owners)
-- ---------------------------------------------------------------------------
create table if not exists public.display_heartbeats (
  token_id uuid primary key references public.branch_public_tokens(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  seen_count bigint not null default 1
);

create index if not exists idx_display_heartbeats_branch
  on public.display_heartbeats(branch_id, last_seen_at desc);

alter table public.display_heartbeats enable row level security;

drop policy if exists display_heartbeats_select on public.display_heartbeats;
drop policy if exists display_heartbeats_select on public.display_heartbeats;
create policy display_heartbeats_select on public.display_heartbeats
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('queue.manage', branch_id)
  );

create or replace function public.record_display_heartbeat(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'display'
    and is_active = true
  limit 1;

  if v_t.id is null then
    return;
  end if;

  insert into public.display_heartbeats (token_id, organization_id, branch_id, last_seen_at, seen_count)
  values (v_t.id, v_t.organization_id, v_t.branch_id, now(), 1)
  on conflict (token_id) do update set
    last_seen_at = now(),
    seen_count = public.display_heartbeats.seen_count + 1;
end;
$$;

grant execute on function public.record_display_heartbeat(text) to anon, authenticated;

create or replace function public.get_display_health_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_active_tokens int;
  v_last_heartbeat timestamptz;
  v_last_queue_activity timestamptz;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select count(*)::int
  into v_active_tokens
  from public.branch_public_tokens t
  where t.organization_id = v_org
    and t.branch_id = p_branch_id
    and t.token_type = 'display'
    and t.is_active = true
    and (t.expires_at is null or t.expires_at > now());

  select max(dh.last_seen_at)
  into v_last_heartbeat
  from public.display_heartbeats dh
  where dh.organization_id = v_org
    and dh.branch_id = p_branch_id;

  select max(greatest(q.checked_in_at, q.called_at, q.served_at))
  into v_last_queue_activity
  from public.queue_entries q
  where q.organization_id = v_org
    and q.branch_id = p_branch_id
    and q.checked_in_at >= (current_date - interval '7 days');

  return jsonb_build_object(
    'active_display_tokens', coalesce(v_active_tokens, 0),
    'has_active_link', coalesce(v_active_tokens, 0) > 0,
    'last_refresh_at', v_last_heartbeat,
    'minutes_since_refresh', case
      when v_last_heartbeat is null then null
      else round(extract(epoch from (now() - v_last_heartbeat)) / 60.0)::int
    end,
    'is_online', v_last_heartbeat is not null and v_last_heartbeat >= now() - interval '5 minutes',
    'last_queue_activity', v_last_queue_activity,
    'minutes_since_activity', case
      when v_last_queue_activity is null then null
      else round(extract(epoch from (now() - v_last_queue_activity)) / 60.0)::int
    end
  );
end;
$$;

grant execute on function public.get_display_health_analytics(uuid) to authenticated;


-- ===== 20260611100000_ortho_display_analytics_polish.sql =====

-- Ortho adjustment timeline + TV display token metrics (VA-F4-14, VA-F4-24)

create or replace function public.get_ortho_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'active_cases', (
      select count(*)::int from public.ortho_cases
      where organization_id = v_org and branch_id = p_branch_id and status = 'active'
    ),
    'balance_distribution', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.bucket, 'value', b.cnt)), '[]'::jsonb)
      from (
        select
          case
            when (public.calculate_ortho_balance(oc.id)->>'balance_due')::numeric <= 0 then 'Paid up'
            when (public.calculate_ortho_balance(oc.id)->>'balance_due')::numeric <= 5000 then 'Under â‚±5k'
            else 'Over â‚±5k'
          end as bucket,
          count(*)::int as cnt
        from public.ortho_cases oc
        where oc.organization_id = v_org and oc.branch_id = p_branch_id and oc.status = 'active'
        group by 1
      ) b
    ),
    'adjustment_timeline', (
      select coalesce(jsonb_agg(jsonb_build_object('label', d.label, 'value', d.cnt) order by d.sort_key), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('week', oa.adjustment_date), 'Mon DD') as label,
          date_trunc('week', oa.adjustment_date) as sort_key,
          count(*)::int as cnt
        from public.ortho_adjustments oa
        join public.ortho_cases oc on oc.id = oa.case_id
        where oc.organization_id = v_org
          and oc.branch_id = p_branch_id
          and oa.adjustment_date >= (current_date - interval '84 days')
        group by 1, 2
        order by 2
      ) d
    )
  );
end;
$$;

grant execute on function public.get_ortho_analytics(uuid) to authenticated;

create or replace function public.get_display_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('queue.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'active_display_tokens', (
      select count(*)::int
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = 'display'
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
    ),
    'active_kiosk_tokens', (
      select count(*)::int
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = 'kiosk'
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
    ),
    'last_kiosk_session_at', (
      select max(ks.created_at)
      from public.kiosk_sessions ks
      where ks.organization_id = v_org and ks.branch_id = p_branch_id
    ),
    'display_tokens_created_7d', (
      select count(*)::int
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = 'display'
        and t.created_at >= now() - interval '7 days'
    )
  );
end;
$$;

grant execute on function public.get_display_analytics(uuid) to authenticated;


-- ===== 20260611120000_appointments_cancel_trend.sql =====

-- Demo showcase seed â€” idempotent RPC for landing page live previews
-- Run via SQL Editor: select public.seed_demo_showcase_data(null);

create or replace function public.seed_demo_showcase_data(p_branch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := p_branch_id;
  v_org_id uuid;
  v_manila_today date := (now() at time zone 'Asia/Manila')::date;
  v_hmo_provider uuid;
  v_proc_fill uuid;
  v_proc_exam uuid;
  v_proc_proph uuid;
  v_chart_id uuid := 'de0000b1-0000-4000-8000-000000000001'::uuid;
  v_patient1 uuid := 'de000001-0000-4000-8000-000000000001'::uuid;
begin
  if v_branch_id is null then
    select b.id, b.organization_id
    into v_branch_id, v_org_id
    from public.branches b
    order by b.created_at nulls last, b.id
    limit 1;
  else
    select b.organization_id into v_org_id
    from public.branches b
    where b.id = v_branch_id;
  end if;

  if v_branch_id is null or v_org_id is null then
    raise exception 'No branch found â€” bootstrap a clinic first';
  end if;

  perform public.seed_default_procedures(v_org_id);
  perform public.seed_hmo_providers(v_org_id);

  select id into v_hmo_provider
  from public.hmo_providers
  where organization_id = v_org_id
  order by name
  limit 1;

  select id into v_proc_exam
  from public.procedures
  where organization_id = v_org_id and code = 'EXAM'
  limit 1;

  select id into v_proc_proph
  from public.procedures
  where organization_id = v_org_id and code = 'PROPH'
  limit 1;

  select id into v_proc_fill
  from public.procedures
  where organization_id = v_org_id and code = 'FILL'
  limit 1;

  -- Patients (Filipino demo names)
  insert into public.patients (id, organization_id, first_name, last_name, date_of_birth, gender, phone, email, address, status)
  values
    (v_patient1, v_org_id, 'Maria', 'Santos', '1988-03-14', 'female', '+639171234001', 'maria.santos@example.ph', 'Quezon City, Metro Manila', 'active'),
    ('de000002-0000-4000-8000-000000000002'::uuid, v_org_id, 'Juan', 'Reyes', '1992-07-22', 'male', '+639171234002', 'juan.reyes@example.ph', 'Makati City, Metro Manila', 'active'),
    ('de000003-0000-4000-8000-000000000003'::uuid, v_org_id, 'Ana', 'Cruz', '1995-11-05', 'female', '+639171234003', 'ana.cruz@example.ph', 'Pasig City, Metro Manila', 'active'),
    ('de000004-0000-4000-8000-000000000004'::uuid, v_org_id, 'Jose', 'Garcia', '1980-01-18', 'male', '+639171234004', 'jose.garcia@example.ph', 'Taguig City, Metro Manila', 'active'),
    ('de000005-0000-4000-8000-000000000005'::uuid, v_org_id, 'Liza', 'Mendoza', '1998-09-30', 'female', '+639171234005', 'liza.mendoza@example.ph', 'Manila City', 'active'),
    ('de000006-0000-4000-8000-000000000006'::uuid, v_org_id, 'Carlo', 'Ramos', '1986-06-12', 'male', '+639171234006', 'carlo.ramos@example.ph', 'Mandaluyong City', 'active'),
    ('de000007-0000-4000-8000-000000000007'::uuid, v_org_id, 'Patricia', 'Villanueva', '1990-04-08', 'female', '+639171234007', 'patricia.v@example.ph', 'Paranaque City', 'active'),
    ('de000008-0000-4000-8000-000000000008'::uuid, v_org_id, 'Miguel', 'Torres', '1975-12-21', 'male', '+639171234008', 'miguel.torres@example.ph', 'Las Pinas City', 'active'),
    ('de000009-0000-4000-8000-000000000009'::uuid, v_org_id, 'Rosa', 'Aquino', '1993-02-27', 'female', '+639171234009', 'rosa.aquino@example.ph', 'Caloocan City', 'active'),
    ('de00000a-0000-4000-8000-00000000000a'::uuid, v_org_id, 'Diego', 'Fernandez', '1984-08-16', 'male', '+639171234010', 'diego.f@example.ph', 'San Juan City', 'active'),
    ('de00000b-0000-4000-8000-00000000000b'::uuid, v_org_id, 'Elena', 'Bautista', '1999-05-03', 'female', '+639171234011', 'elena.b@example.ph', 'Marikina City', 'active'),
    ('de00000c-0000-4000-8000-00000000000c'::uuid, v_org_id, 'Mark', 'Dela Cruz', '1991-10-11', 'male', '+639171234012', 'mark.delacruz@example.ph', 'Valenzuela City', 'active')
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    email = excluded.email,
    status = excluded.status,
    updated_at = now();

  insert into public.patient_branch_links (patient_id, branch_id, first_visit_at, last_visit_at)
  select p.id, v_branch_id, now() - interval '30 days', now() - interval '2 days'
  from public.patients p
  where p.id in (
    v_patient1,
    'de000002-0000-4000-8000-000000000002'::uuid,
    'de000003-0000-4000-8000-000000000003'::uuid,
    'de000004-0000-4000-8000-000000000004'::uuid,
    'de000005-0000-4000-8000-000000000005'::uuid,
    'de000006-0000-4000-8000-000000000006'::uuid,
    'de000007-0000-4000-8000-000000000007'::uuid,
    'de000008-0000-4000-8000-000000000008'::uuid,
    'de000009-0000-4000-8000-000000000009'::uuid,
    'de00000a-0000-4000-8000-00000000000a'::uuid,
    'de00000b-0000-4000-8000-00000000000b'::uuid,
    'de00000c-0000-4000-8000-00000000000c'::uuid
  )
  on conflict (patient_id, branch_id) do update set
    last_visit_at = excluded.last_visit_at;

  -- Today's appointments (Asia/Manila)
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de000101-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1,
      (v_manila_today + time '09:00') at time zone 'Asia/Manila', 30, 'Check-up & cleaning', 'confirmed'),
    ('de000102-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid,
      (v_manila_today + time '09:30') at time zone 'Asia/Manila', 45, 'Composite filling #36', 'scheduled'),
    ('de000103-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid,
      (v_manila_today + time '10:00') at time zone 'Asia/Manila', 30, 'Follow-up', 'checked_in'),
    ('de000104-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid,
      (v_manila_today + time '08:00') at time zone 'Asia/Manila', 30, 'Oral exam', 'completed'),
    ('de000105-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid,
      (v_manila_today + time '08:30') at time zone 'Asia/Manila', 45, 'Root canal consult', 'completed'),
    ('de000106-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid,
      (v_manila_today + time '11:00') at time zone 'Asia/Manila', 30, 'Prophylaxis', 'scheduled'),
    ('de000107-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid,
      (v_manila_today + time '14:00') at time zone 'Asia/Manila', 30, 'Crown prep', 'confirmed')
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    purpose = excluded.purpose,
    updated_at = now();

  -- Queue (8 active)
  insert into public.queue_entries (
    id, organization_id, branch_id, patient_id, appointment_id, display_code, status, chair_label, checked_in_at, called_at
  )
  values
    ('de000201-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000101-0000-4000-8000-000000000001'::uuid, 'Q001', 'in_chair', 'Chair 2', now() - interval '45 minutes', now() - interval '40 minutes'),
    ('de000201-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'de000102-0000-4000-8000-000000000002'::uuid, 'Q002', 'now_serving', null, now() - interval '35 minutes', now() - interval '5 minutes'),
    ('de000201-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, 'de000103-0000-4000-8000-000000000003'::uuid, 'Q003', 'ready', null, now() - interval '25 minutes', null),
    ('de000201-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid, null, 'Q004', 'waiting', null, now() - interval '20 minutes', null),
    ('de000201-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid, null, 'Q005', 'waiting', null, now() - interval '18 minutes', null),
    ('de000201-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid, null, 'Q006', 'waiting', null, now() - interval '15 minutes', null),
    ('de000201-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, null, 'Q007', 'ready', null, now() - interval '12 minutes', null),
    ('de000201-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, null, 'Q008', 'waiting', null, now() - interval '8 minutes', null)
  on conflict (id) do update set
    status = excluded.status,
    display_code = excluded.display_code,
    chair_label = excluded.chair_label,
    checked_in_at = excluded.checked_in_at,
    called_at = excluded.called_at,
    updated_at = now();

  -- Pending consents
  insert into public.patient_consents (id, patient_id, organization_id, branch_id, template_slug, template_name, status)
  values
    ('de000401-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'pending'),
    ('de000401-0000-4000-8000-000000000002'::uuid, 'de000002-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'general-treatment', 'General Treatment Consent', 'pending'),
    ('de000401-0000-4000-8000-000000000003'::uuid, 'de000003-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'ortho-agreement', 'Orthodontic Agreement', 'pending')
  on conflict (patient_id, template_slug) do update set
    status = excluded.status,
    branch_id = excluded.branch_id;

  -- Waitlist (if table exists)
  if to_regclass('public.waitlist_entries') is not null then
    insert into public.waitlist_entries (id, organization_id, branch_id, patient_id, status, urgency, preferred_date, notes)
    values
      ('de000501-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, 'waiting', 'urgent', v_manila_today + 1, 'Pain â€” wants earliest slot'),
      ('de000501-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de00000a-0000-4000-8000-00000000000a'::uuid, 'contacted', 'normal', v_manila_today + 3, 'Callback for cleaning'),
      ('de000501-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid, 'waiting', 'normal', v_manila_today + 5, 'Ortho consult â€” flexible schedule')
    on conflict (id) do update set
      status = excluded.status,
      preferred_date = excluded.preferred_date,
      updated_at = now();
  end if;

  -- Treatment plan
  insert into public.treatment_plans (id, organization_id, branch_id, patient_id, title, status, total_estimated, notes)
  values (
    'de000a01-0000-4000-8000-000000000001'::uuid,
    v_org_id,
    v_branch_id,
    v_patient1,
    'Restorative plan â€” Maria Santos',
    'proposed',
    18500,
    'Demo treatment plan for showcase'
  )
  on conflict (id) do update set
    title = excluded.title,
    status = excluded.status,
    total_estimated = excluded.total_estimated,
    updated_at = now();

  insert into public.treatment_plan_items (id, plan_id, procedure_id, tooth_number, description, estimated_price, priority, status)
  values
    ('de000a02-0000-4000-8000-000000000001'::uuid, 'de000a01-0000-4000-8000-000000000001'::uuid, v_proc_fill, '36', 'Composite filling #36', 3500, 'restorative', 'planned'),
    ('de000a02-0000-4000-8000-000000000002'::uuid, 'de000a01-0000-4000-8000-000000000001'::uuid, v_proc_proph, null, 'Prophylaxis / Cleaning', 2500, 'restorative', 'planned')
  on conflict (id) do update set
    description = excluded.description,
    estimated_price = excluded.estimated_price;

  -- Invoices (mix open / partial / paid + overdue)
  insert into public.invoices (id, organization_id, branch_id, patient_id, treatment_plan_id, invoice_number, total_amount, paid_amount, status, due_date)
  values
    ('de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000a01-0000-4000-8000-000000000001'::uuid, 'DEMO-INV-001', 8500, 0, 'sent', v_manila_today + 14),
    ('de000301-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, null, 'DEMO-INV-002', 12000, 5000, 'partial', v_manila_today - 3),
    ('de000301-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, null, 'DEMO-INV-003', 3500, 3500, 'paid', v_manila_today),
    ('de000301-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid, null, 'DEMO-INV-004', 5000, 0, 'draft', v_manila_today + 7),
    ('de000301-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid, null, 'DEMO-INV-005', 15000, 8000, 'partial', v_manila_today - 7),
    ('de000301-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid, null, 'DEMO-INV-006', 2500, 2500, 'paid', v_manila_today)
  on conflict (id) do update set
    total_amount = excluded.total_amount,
    paid_amount = excluded.paid_amount,
    status = excluded.status,
    due_date = excluded.due_date,
    updated_at = now();

  if to_regclass('public.invoice_line_items') is not null then
    insert into public.invoice_line_items (id, invoice_id, organization_id, procedure_id, description, tooth_number, quantity, unit_price, line_total, sort_order)
    values
      ('de000311-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_exam, 'Oral Examination', null, 1, 500, 500, 0),
      ('de000311-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_proph, 'Prophylaxis / Cleaning', null, 1, 2500, 2500, 1),
      ('de000311-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_fill, 'Composite Filling', '36', 1, 5500, 5500, 2)
    on conflict (id) do update set
      line_total = excluded.line_total,
      unit_price = excluded.unit_price;
  end if;

  -- Payments today (today_collected KPI)
  insert into public.invoice_payments (id, invoice_id, organization_id, amount, payment_method, notes, created_at)
  values
    ('de000321-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000003'::uuid, v_org_id, 3500, 'gcash', 'Demo payment â€” full', now() - interval '2 hours'),
    ('de000321-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000006'::uuid, v_org_id, 2500, 'cash', 'Demo payment â€” cleaning', now() - interval '1 hour'),
    ('de000321-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 5000, 'card', 'Demo partial payment', now() - interval '30 minutes')
  on conflict (id) do update set
    amount = excluded.amount,
    created_at = excluded.created_at;

  -- Clinical notes: signed for Maria; completed appts without signed notes for KPI
  insert into public.clinical_notes (
    id, patient_id, organization_id, branch_id, appointment_id, title, subjective, objective, assessment, plan, status, signed_at
  )
  values
    ('de000601-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'de000101-0000-4000-8000-000000000001'::uuid,
      'Routine check-up', 'No complaints', 'Mild plaque #36', 'Gingivitis', 'Prophylaxis + filling', 'signed', now() - interval '1 hour'),
    ('de000601-0000-4000-8000-000000000002'::uuid, 'de000006-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, null,
      'Draft note', 'Sensitivity cold', 'Pending exam', null, null, 'draft', null)
  on conflict (id) do update set
    status = excluded.status,
    signed_at = excluded.signed_at,
    updated_at = now();

  -- Low stock inventory
  insert into public.inventory_items (id, organization_id, branch_id, name, sku, category, unit, quantity_on_hand, min_stock_level, is_active)
  values
    ('de000701-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'Composite resin A2', 'COMP-A2', 'restorative', 'syringe', 2, 5, true),
    ('de000701-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'Nitrile gloves (M)', 'GLV-M', 'consumable', 'box', 1, 10, true),
    ('de000701-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'Prophy paste', 'PROPHY-01', 'preventive', 'jar', 3, 5, true)
  on conflict (id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    min_stock_level = excluded.min_stock_level,
    updated_at = now();

  -- HMO draft claims
  insert into public.hmo_claims (id, organization_id, branch_id, patient_id, invoice_id, provider_id, claim_number, member_id, claimed_amount, status)
  values
    ('de000801-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000301-0000-4000-8000-000000000001'::uuid, v_hmo_provider, 'DEMO-HMO-001', 'MAX-123456', 8500, 'draft'),
    ('de000801-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_hmo_provider, 'DEMO-HMO-002', 'MAX-789012', 12000, 'draft')
  on conflict (id) do update set
    status = excluded.status,
    claimed_amount = excluded.claimed_amount,
    updated_at = now();

  -- PhilHealth pending claims
  insert into public.philhealth_claims (id, organization_id, branch_id, patient_id, philhealth_id, case_rate_code, status, checklist, notes)
  values
    ('de000901-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, '12-345678901-2', 'PROPH', 'checklist_incomplete', '{"member_id": true, "diagnosis": false}'::jsonb, 'Demo PhilHealth claim'),
    ('de000901-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, '12-987654321-0', 'FILL', 'ready', '{"member_id": true, "diagnosis": true}'::jsonb, 'Ready for sync stub')
  on conflict (id) do update set
    status = excluded.status,
    checklist = excluded.checklist,
    updated_at = now();

  -- Odontogram (when dental_charts + tooth_findings exist)
  if to_regclass('public.dental_charts') is not null and to_regclass('public.tooth_findings') is not null then
    insert into public.dental_charts (id, organization_id, branch_id, patient_id, status)
    values (v_chart_id, v_org_id, v_branch_id, v_patient1, 'active')
    on conflict (id) do update set status = excluded.status, updated_at = now();

    insert into public.tooth_findings (id, chart_id, patient_id, organization_id, branch_id, tooth_number, dentition_type, condition, surfaces, restoration_type, status)
    values
      ('de000c01-0000-4000-8000-000000000001'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '36', 'permanent', 'decayed', array['center','top']::text[], null, 'active'),
      ('de000c01-0000-4000-8000-000000000002'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '26', 'permanent', 'present', array[]::text[], 'composite', 'active'),
      ('de000c01-0000-4000-8000-000000000003'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '46', 'permanent', 'decayed', array['center']::text[], null, 'active'),
      ('de000c01-0000-4000-8000-000000000004'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '11', 'permanent', 'present', array[]::text[], 'jacket_crown', 'active'),
      ('de000c01-0000-4000-8000-000000000005'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '38', 'permanent', 'indicated_extraction', array[]::text[], null, 'active')
    on conflict (id) do update set
      condition = excluded.condition,
      surfaces = excluded.surfaces,
      restoration_type = excluded.restoration_type,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'branch_id', v_branch_id,
    'organization_id', v_org_id,
    'manila_date', v_manila_today,
    'demo_patient_ids', jsonb_build_array(
      v_patient1::text,
      'de000002-0000-4000-8000-000000000002',
      'de000003-0000-4000-8000-000000000003'
    ),
    'hint', 'Set LANDING_SHOWCASE_BRANCH_ID=' || v_branch_id::text || ' in .env.local for public landing previews'
  );
end;
$$;

grant execute on function public.seed_demo_showcase_data(uuid) to authenticated;
grant execute on function public.seed_demo_showcase_data(uuid) to service_role;


-- ===== 20260611210000_seed_demo_showcase_full.sql =====

-- Full demo showcase seed
-- Source: scripts/seed-demo-showcase.sql

create or replace function public.seed_demo_showcase_data(p_branch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := p_branch_id;
  v_org_id uuid;
  v_manila_today date := (now() at time zone 'Asia/Manila')::date;
  v_hmo_provider uuid;
  v_proc_fill uuid;
  v_proc_exam uuid;
  v_proc_proph uuid;
  v_chart_id uuid := 'de0000b1-0000-4000-8000-000000000001'::uuid;
  v_patient1 uuid := 'de000001-0000-4000-8000-000000000001'::uuid;
  v_branch2_id uuid := 'de0000d1-0000-4000-8000-000000000002'::uuid;
  v_branch3_id uuid := 'de0000d1-0000-4000-8000-000000000003'::uuid;
  v_ortho_case1 uuid := 'de000d01-0000-4000-8000-000000000001'::uuid;
  v_ortho_case2 uuid := 'de000d01-0000-4000-8000-000000000002'::uuid;
  v_provider_id uuid;
  v_role_dentist uuid;
  v_role_receptionist uuid;
  v_sig_stub text := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
begin
  if v_branch_id is null then
    select b.id, b.organization_id
    into v_branch_id, v_org_id
    from public.branches b
    order by b.created_at nulls last, b.id
    limit 1;
  else
    select b.organization_id into v_org_id
    from public.branches b
    where b.id = v_branch_id;
  end if;

  if v_branch_id is null or v_org_id is null then
    raise exception 'No branch found Ã¢â‚¬â€ bootstrap a clinic first';
  end if;

  perform public.seed_default_procedures(v_org_id);
  perform public.seed_hmo_providers(v_org_id);

  if to_regprocedure('public.seed_notification_templates(uuid)') is not null then
    perform public.seed_notification_templates(v_org_id);
  end if;

  select r.id into v_role_dentist
  from public.roles r
  where r.name = 'dentist'
  limit 1;

  select r.id into v_role_receptionist
  from public.roles r
  where r.name = 'receptionist'
  limit 1;

  select p.id into v_provider_id
  from public.profiles p
  join public.staff_branch_assignments sba on sba.profile_id = p.id and sba.branch_id = v_branch_id
  join public.roles r on r.id = sba.role_id
  where p.organization_id = v_org_id and r.name in ('dentist', 'owner', 'admin')
  order by case r.name when 'dentist' then 0 when 'owner' then 1 else 2 end
  limit 1;

  if v_provider_id is null then
    select p.id into v_provider_id
    from public.profiles p
    where p.organization_id = v_org_id
    order by p.created_at nulls last
    limit 1;
  end if;

  select id into v_hmo_provider
  from public.hmo_providers
  where organization_id = v_org_id
  order by name
  limit 1;

  select id into v_proc_exam
  from public.procedures
  where organization_id = v_org_id and code = 'EXAM'
  limit 1;

  select id into v_proc_proph
  from public.procedures
  where organization_id = v_org_id and code = 'PROPH'
  limit 1;

  select id into v_proc_fill
  from public.procedures
  where organization_id = v_org_id and code = 'FILL'
  limit 1;

  -- Patients (Filipino demo names)
  insert into public.patients (id, organization_id, first_name, last_name, date_of_birth, gender, phone, email, address, status)
  values
    (v_patient1, v_org_id, 'Maria', 'Santos', '1988-03-14', 'female', '+639171234001', 'maria.santos@example.ph', 'Quezon City, Metro Manila', 'active'),
    ('de000002-0000-4000-8000-000000000002'::uuid, v_org_id, 'Juan', 'Reyes', '1992-07-22', 'male', '+639171234002', 'juan.reyes@example.ph', 'Makati City, Metro Manila', 'active'),
    ('de000003-0000-4000-8000-000000000003'::uuid, v_org_id, 'Ana', 'Cruz', '1995-11-05', 'female', '+639171234003', 'ana.cruz@example.ph', 'Pasig City, Metro Manila', 'active'),
    ('de000004-0000-4000-8000-000000000004'::uuid, v_org_id, 'Jose', 'Garcia', '1980-01-18', 'male', '+639171234004', 'jose.garcia@example.ph', 'Taguig City, Metro Manila', 'active'),
    ('de000005-0000-4000-8000-000000000005'::uuid, v_org_id, 'Liza', 'Mendoza', '1998-09-30', 'female', '+639171234005', 'liza.mendoza@example.ph', 'Manila City', 'active'),
    ('de000006-0000-4000-8000-000000000006'::uuid, v_org_id, 'Carlo', 'Ramos', '1986-06-12', 'male', '+639171234006', 'carlo.ramos@example.ph', 'Mandaluyong City', 'active'),
    ('de000007-0000-4000-8000-000000000007'::uuid, v_org_id, 'Patricia', 'Villanueva', '1990-04-08', 'female', '+639171234007', 'patricia.v@example.ph', 'Paranaque City', 'active'),
    ('de000008-0000-4000-8000-000000000008'::uuid, v_org_id, 'Miguel', 'Torres', '1975-12-21', 'male', '+639171234008', 'miguel.torres@example.ph', 'Las Pinas City', 'active'),
    ('de000009-0000-4000-8000-000000000009'::uuid, v_org_id, 'Rosa', 'Aquino', '1993-02-27', 'female', '+639171234009', 'rosa.aquino@example.ph', 'Caloocan City', 'active'),
    ('de00000a-0000-4000-8000-00000000000a'::uuid, v_org_id, 'Diego', 'Fernandez', '1984-08-16', 'male', '+639171234010', 'diego.f@example.ph', 'San Juan City', 'active'),
    ('de00000b-0000-4000-8000-00000000000b'::uuid, v_org_id, 'Elena', 'Bautista', '1999-05-03', 'female', '+639171234011', 'elena.b@example.ph', 'Marikina City', 'active'),
    ('de00000c-0000-4000-8000-00000000000c'::uuid, v_org_id, 'Mark', 'Dela Cruz', '1991-10-11', 'male', '+639171234012', 'mark.delacruz@example.ph', 'Valenzuela City', 'active')
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    email = excluded.email,
    status = excluded.status,
    updated_at = now();

  insert into public.patient_branch_links (patient_id, branch_id, first_visit_at, last_visit_at)
  select p.id, v_branch_id, now() - interval '30 days', now() - interval '2 days'
  from public.patients p
  where p.id in (
    v_patient1,
    'de000002-0000-4000-8000-000000000002'::uuid,
    'de000003-0000-4000-8000-000000000003'::uuid,
    'de000004-0000-4000-8000-000000000004'::uuid,
    'de000005-0000-4000-8000-000000000005'::uuid,
    'de000006-0000-4000-8000-000000000006'::uuid,
    'de000007-0000-4000-8000-000000000007'::uuid,
    'de000008-0000-4000-8000-000000000008'::uuid,
    'de000009-0000-4000-8000-000000000009'::uuid,
    'de00000a-0000-4000-8000-00000000000a'::uuid,
    'de00000b-0000-4000-8000-00000000000b'::uuid,
    'de00000c-0000-4000-8000-00000000000c'::uuid
  )
  on conflict (patient_id, branch_id) do update set
    last_visit_at = excluded.last_visit_at;

  -- Today's appointments (Asia/Manila)
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de000101-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1,
      (v_manila_today + time '09:00') at time zone 'Asia/Manila', 30, 'Check-up & cleaning', 'confirmed'),
    ('de000102-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid,
      (v_manila_today + time '09:30') at time zone 'Asia/Manila', 45, 'Composite filling #36', 'scheduled'),
    ('de000103-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid,
      (v_manila_today + time '10:00') at time zone 'Asia/Manila', 30, 'Follow-up', 'checked_in'),
    ('de000104-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid,
      (v_manila_today + time '08:00') at time zone 'Asia/Manila', 30, 'Oral exam', 'completed'),
    ('de000105-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid,
      (v_manila_today + time '08:30') at time zone 'Asia/Manila', 45, 'Root canal consult', 'completed'),
    ('de000106-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid,
      (v_manila_today + time '11:00') at time zone 'Asia/Manila', 30, 'Prophylaxis', 'scheduled'),
    ('de000107-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid,
      (v_manila_today + time '14:00') at time zone 'Asia/Manila', 30, 'Crown prep', 'confirmed')
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    purpose = excluded.purpose,
    updated_at = now();

  -- Week calendar spread (past + future days for appointments page & analytics)
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de000108-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid,
      ((v_manila_today - 1) + time '10:00') at time zone 'Asia/Manila', 30, 'Follow-up cleaning', 'completed'),
    ('de000108-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de00000a-0000-4000-8000-00000000000a'::uuid,
      ((v_manila_today - 2) + time '11:30') at time zone 'Asia/Manila', 45, 'Extraction consult', 'cancelled'),
    ('de000108-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid,
      ((v_manila_today - 4) + time '09:00') at time zone 'Asia/Manila', 30, 'Ortho adjustment', 'no_show'),
    ('de000108-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de00000c-0000-4000-8000-00000000000c'::uuid,
      ((v_manila_today - 3) + time '15:00') at time zone 'Asia/Manila', 30, 'Oral exam', 'completed'),
    ('de000108-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_patient1,
      ((v_manila_today + 1) + time '09:30') at time zone 'Asia/Manila', 30, 'Post-op check', 'scheduled'),
    ('de000108-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid,
      ((v_manila_today + 1) + time '14:00') at time zone 'Asia/Manila', 45, 'Filling #46', 'confirmed'),
    ('de000108-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid,
      ((v_manila_today + 2) + time '10:30') at time zone 'Asia/Manila', 30, 'Prophylaxis', 'scheduled'),
    ('de000108-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid,
      ((v_manila_today + 3) + time '11:00') at time zone 'Asia/Manila', 60, 'Root canal', 'confirmed'),
    ('de000108-0000-4000-8000-000000000009'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid,
      ((v_manila_today + 4) + time '08:30') at time zone 'Asia/Manila', 30, 'Whitening consult', 'scheduled'),
    ('de000108-0000-4000-8000-00000000000a'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid,
      ((v_manila_today - 5) + time '13:00') at time zone 'Asia/Manila', 30, 'Crown delivery', 'completed'),
    ('de000108-0000-4000-8000-00000000000b'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid,
      ((v_manila_today - 6) + time '16:00') at time zone 'Asia/Manila', 30, 'Denture adjustment', 'completed'),
    ('de000108-0000-4000-8000-00000000000c'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid,
      ((v_manila_today + 5) + time '09:00') at time zone 'Asia/Manila', 30, 'Recall exam', 'scheduled')
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    purpose = excluded.purpose,
    updated_at = now();

  -- Queue (8 active)
  insert into public.queue_entries (
    id, organization_id, branch_id, patient_id, appointment_id, display_code, status, chair_label, checked_in_at, called_at
  )
  values
    ('de000201-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000101-0000-4000-8000-000000000001'::uuid, 'Q001', 'in_chair', 'Chair 2', now() - interval '45 minutes', now() - interval '40 minutes'),
    ('de000201-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'de000102-0000-4000-8000-000000000002'::uuid, 'Q002', 'now_serving', null, now() - interval '35 minutes', now() - interval '5 minutes'),
    ('de000201-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, 'de000103-0000-4000-8000-000000000003'::uuid, 'Q003', 'ready', null, now() - interval '25 minutes', null),
    ('de000201-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid, null, 'Q004', 'waiting', null, now() - interval '20 minutes', null),
    ('de000201-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid, null, 'Q005', 'waiting', null, now() - interval '18 minutes', null),
    ('de000201-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid, null, 'Q006', 'waiting', null, now() - interval '15 minutes', null),
    ('de000201-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, null, 'Q007', 'ready', null, now() - interval '12 minutes', null),
    ('de000201-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, null, 'Q008', 'waiting', null, now() - interval '8 minutes', null)
  on conflict (id) do update set
    status = excluded.status,
    display_code = excluded.display_code,
    chair_label = excluded.chair_label,
    checked_in_at = excluded.checked_in_at,
    called_at = excluded.called_at,
    updated_at = now();

  -- Consents: pending + signed mix
  insert into public.patient_consents (
    id, patient_id, organization_id, branch_id, template_slug, template_name, status,
    signed_at, signature_data, field_responses, body_snapshot
  )
  values
    ('de000401-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'pending', null, null, null, null),
    ('de000401-0000-4000-8000-000000000002'::uuid, 'de000002-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'general-treatment', 'General Treatment Consent', 'signed',
      now() - interval '3 days', v_sig_stub,
      '{"emergency_contact": "Juan Reyes / +639171234002", "procedure_acknowledged": true, "questions_answered": true, "patient_initials": "JR"}'::jsonb,
      'General Treatment Consent â€” signed for showcase demo.'),
    ('de000401-0000-4000-8000-000000000003'::uuid, 'de000003-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'ortho-agreement', 'Orthodontic Agreement', 'pending', null, null, null, null),
    ('de000401-0000-4000-8000-000000000004'::uuid, 'de000004-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'signed',
      now() - interval '14 days', v_sig_stub, '{}'::jsonb, 'DPA Consent â€” signed for showcase demo.'),
    ('de000401-0000-4000-8000-000000000005'::uuid, 'de000005-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'general-treatment', 'General Treatment Consent', 'signed',
      now() - interval '7 days', v_sig_stub,
      '{"emergency_contact": "Liza Mendoza / +639171234005", "procedure_acknowledged": true}'::jsonb,
      'General Treatment Consent â€” signed for showcase demo.'),
    ('de000401-0000-4000-8000-000000000006'::uuid, 'de000006-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'pending', null, null, null, null)
  on conflict (patient_id, template_slug) do update set
    status = excluded.status,
    branch_id = excluded.branch_id,
    signed_at = excluded.signed_at,
    signature_data = excluded.signature_data,
    field_responses = excluded.field_responses,
    body_snapshot = excluded.body_snapshot;

  -- Waitlist (if table exists)
  if to_regclass('public.waitlist_entries') is not null then
    insert into public.waitlist_entries (id, organization_id, branch_id, patient_id, status, urgency, preferred_date, notes)
    values
      ('de000501-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, 'waiting', 'urgent', v_manila_today + 1, 'Pain Ã¢â‚¬â€ wants earliest slot'),
      ('de000501-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de00000a-0000-4000-8000-00000000000a'::uuid, 'contacted', 'normal', v_manila_today + 3, 'Callback for cleaning'),
      ('de000501-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid, 'waiting', 'normal', v_manila_today + 5, 'Ortho consult Ã¢â‚¬â€ flexible schedule')
    on conflict (id) do update set
      status = excluded.status,
      preferred_date = excluded.preferred_date,
      updated_at = now();
  end if;

  -- Treatment plan
  insert into public.treatment_plans (id, organization_id, branch_id, patient_id, title, status, total_estimated, notes)
  values (
    'de000a01-0000-4000-8000-000000000001'::uuid,
    v_org_id,
    v_branch_id,
    v_patient1,
    'Restorative plan Ã¢â‚¬â€ Maria Santos',
    'proposed',
    18500,
    'Demo treatment plan for showcase'
  )
  on conflict (id) do update set
    title = excluded.title,
    status = excluded.status,
    total_estimated = excluded.total_estimated,
    updated_at = now();

  insert into public.treatment_plan_items (id, plan_id, procedure_id, tooth_number, description, estimated_price, priority, status)
  values
    ('de000a02-0000-4000-8000-000000000001'::uuid, 'de000a01-0000-4000-8000-000000000001'::uuid, v_proc_fill, '36', 'Composite filling #36', 3500, 'restorative', 'planned'),
    ('de000a02-0000-4000-8000-000000000002'::uuid, 'de000a01-0000-4000-8000-000000000001'::uuid, v_proc_proph, null, 'Prophylaxis / Cleaning', 2500, 'restorative', 'planned')
  on conflict (id) do update set
    description = excluded.description,
    estimated_price = excluded.estimated_price;

  -- Invoices (mix open / partial / paid + overdue)
  insert into public.invoices (id, organization_id, branch_id, patient_id, treatment_plan_id, invoice_number, total_amount, paid_amount, status, due_date)
  values
    ('de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000a01-0000-4000-8000-000000000001'::uuid, 'DEMO-INV-001', 8500, 0, 'sent', v_manila_today + 14),
    ('de000301-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, null, 'DEMO-INV-002', 12000, 5000, 'partial', v_manila_today - 3),
    ('de000301-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, null, 'DEMO-INV-003', 3500, 3500, 'paid', v_manila_today),
    ('de000301-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid, null, 'DEMO-INV-004', 5000, 0, 'draft', v_manila_today + 7),
    ('de000301-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid, null, 'DEMO-INV-005', 15000, 8000, 'partial', v_manila_today - 7),
    ('de000301-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid, null, 'DEMO-INV-006', 2500, 2500, 'paid', v_manila_today)
  on conflict (id) do update set
    total_amount = excluded.total_amount,
    paid_amount = excluded.paid_amount,
    status = excluded.status,
    due_date = excluded.due_date,
    updated_at = now();

  if to_regclass('public.invoice_line_items') is not null then
    insert into public.invoice_line_items (id, invoice_id, organization_id, procedure_id, description, tooth_number, quantity, unit_price, line_total, sort_order)
    values
      ('de000311-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_exam, 'Oral Examination', null, 1, 500, 500, 0),
      ('de000311-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_proph, 'Prophylaxis / Cleaning', null, 1, 2500, 2500, 1),
      ('de000311-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_fill, 'Composite Filling', '36', 1, 5500, 5500, 2)
    on conflict (id) do update set
      line_total = excluded.line_total,
      unit_price = excluded.unit_price;
  end if;

  -- Payments today (today_collected KPI)
  insert into public.invoice_payments (id, invoice_id, organization_id, amount, payment_method, notes, created_at)
  values
    ('de000321-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000003'::uuid, v_org_id, 3500, 'gcash', 'Demo payment Ã¢â‚¬â€ full', now() - interval '2 hours'),
    ('de000321-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000006'::uuid, v_org_id, 2500, 'cash', 'Demo payment Ã¢â‚¬â€ cleaning', now() - interval '1 hour'),
    ('de000321-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 5000, 'card', 'Demo partial payment', now() - interval '30 minutes'),
    ('de000322-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000005'::uuid, v_org_id, 3000, 'gcash', 'Demo payment â€” day -1', (v_manila_today - 1) + time '17:00'),
    ('de000322-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 2000, 'cash', 'Demo payment â€” day -2', (v_manila_today - 2) + time '16:30'),
    ('de000322-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, 1500, 'card', 'Demo payment â€” day -3', (v_manila_today - 3) + time '15:00'),
    ('de000322-0000-4000-8000-000000000004'::uuid, 'de000301-0000-4000-8000-000000000006'::uuid, v_org_id, 2500, 'gcash', 'Demo payment â€” day -4', (v_manila_today - 4) + time '12:00'),
    ('de000322-0000-4000-8000-000000000005'::uuid, 'de000301-0000-4000-8000-000000000003'::uuid, v_org_id, 1000, 'cash', 'Demo payment â€” day -5', (v_manila_today - 5) + time '11:00'),
    ('de000322-0000-4000-8000-000000000006'::uuid, 'de000301-0000-4000-8000-000000000005'::uuid, v_org_id, 4000, 'card', 'Demo payment â€” day -6', (v_manila_today - 6) + time '14:00'),
    ('de000322-0000-4000-8000-000000000007'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 2500, 'gcash', 'Demo payment â€” day -7', (v_manila_today - 7) + time '10:30')
  on conflict (id) do update set
    amount = excluded.amount,
    created_at = excluded.created_at;

  -- Clinical notes: signed for Maria; completed appts without signed notes for KPI
  insert into public.clinical_notes (
    id, patient_id, organization_id, branch_id, appointment_id, title, subjective, objective, assessment, plan, status, signed_at
  )
  values
    ('de000601-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'de000101-0000-4000-8000-000000000001'::uuid,
      'Routine check-up', 'No complaints', 'Mild plaque #36', 'Gingivitis', 'Prophylaxis + filling', 'signed', now() - interval '1 hour'),
    ('de000601-0000-4000-8000-000000000002'::uuid, 'de000006-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, null,
      'Draft note', 'Sensitivity cold', 'Pending exam', null, null, 'draft', null)
  on conflict (id) do update set
    status = excluded.status,
    signed_at = excluded.signed_at,
    updated_at = now();

  -- Low stock inventory
  insert into public.inventory_items (id, organization_id, branch_id, name, sku, category, unit, quantity_on_hand, min_stock_level, is_active)
  values
    ('de000701-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'Composite resin A2', 'COMP-A2', 'restorative', 'syringe', 2, 5, true),
    ('de000701-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'Nitrile gloves (M)', 'GLV-M', 'consumable', 'box', 1, 10, true),
    ('de000701-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'Prophy paste', 'PROPHY-01', 'preventive', 'jar', 3, 5, true)
  on conflict (id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    min_stock_level = excluded.min_stock_level,
    updated_at = now();

  -- HMO draft claims
  insert into public.hmo_claims (id, organization_id, branch_id, patient_id, invoice_id, provider_id, claim_number, member_id, claimed_amount, status)
  values
    ('de000801-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000301-0000-4000-8000-000000000001'::uuid, v_hmo_provider, 'DEMO-HMO-001', 'MAX-123456', 8500, 'draft'),
    ('de000801-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_hmo_provider, 'DEMO-HMO-002', 'MAX-789012', 12000, 'draft')
  on conflict (id) do update set
    status = excluded.status,
    claimed_amount = excluded.claimed_amount,
    updated_at = now();

  -- PhilHealth pending claims
  insert into public.philhealth_claims (id, organization_id, branch_id, patient_id, philhealth_id, case_rate_code, status, checklist, notes)
  values
    ('de000901-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, '12-345678901-2', 'PROPH', 'checklist_incomplete', '{"member_id": true, "diagnosis": false}'::jsonb, 'Demo PhilHealth claim'),
    ('de000901-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, '12-987654321-0', 'FILL', 'ready', '{"member_id": true, "diagnosis": true}'::jsonb, 'Ready for sync stub')
  on conflict (id) do update set
    status = excluded.status,
    checklist = excluded.checklist,
    updated_at = now();

  -- Medical histories (versioned + risk flags)
  if to_regclass('public.patient_medical_histories') is not null then
    insert into public.patient_medical_histories (id, patient_id, organization_id, version, allergies, medications, conditions, notes, created_by)
    values
      ('de000e01-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, 1,
        '["Penicillin"]'::jsonb, '["Metformin 500mg"]'::jsonb, '["Type 2 Diabetes"]'::jsonb, 'Initial intake', v_provider_id),
      ('de000e01-0000-4000-8000-000000000002'::uuid, v_patient1, v_org_id, 2,
        '["Penicillin", "Latex"]'::jsonb, '["Metformin 500mg", "Losartan 50mg"]'::jsonb, '["Type 2 Diabetes", "Hypertension"]'::jsonb, 'Updated at recall', v_provider_id),
      ('de000e01-0000-4000-8000-000000000003'::uuid, 'de000002-0000-4000-8000-000000000002'::uuid, v_org_id, 1,
        '[]'::jsonb, '["Amlodipine 5mg"]'::jsonb, '["Hypertension"]'::jsonb, null, v_provider_id),
      ('de000e01-0000-4000-8000-000000000004'::uuid, 'de000008-0000-4000-8000-000000000008'::uuid, v_org_id, 1,
        '["Aspirin"]'::jsonb, '[]'::jsonb, '["Asthma"]'::jsonb, 'PhilHealth member', v_provider_id),
      ('de000e01-0000-4000-8000-000000000005'::uuid, 'de00000b-0000-4000-8000-00000000000b'::uuid, v_org_id, 1,
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'No significant history', v_provider_id)
    on conflict (id) do update set
      allergies = excluded.allergies,
      medications = excluded.medications,
      conditions = excluded.conditions,
      notes = excluded.notes;
  end if;

  -- Insurance profiles
  if to_regclass('public.patient_insurance_profiles') is not null then
    insert into public.patient_insurance_profiles (id, organization_id, patient_id, payer_type, payer_name, member_id, plan_name, is_primary, notes)
    values
      ('de001001-0000-4000-8000-000000000001'::uuid, v_org_id, v_patient1, 'hmo', 'Maxicare', 'MAX-123456', 'Executive Plan', true, 'Primary HMO'),
      ('de001001-0000-4000-8000-000000000002'::uuid, v_org_id, 'de000008-0000-4000-8000-000000000008'::uuid, 'philhealth', 'PhilHealth', '12-345678901-2', 'Member', true, 'PhilHealth PROPH case rate'),
      ('de001001-0000-4000-8000-000000000003'::uuid, v_org_id, 'de000004-0000-4000-8000-000000000004'::uuid, 'private', 'Self-pay', null, null, true, 'Cash / card'),
      ('de001001-0000-4000-8000-000000000004'::uuid, v_org_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'hmo', 'Intellicare', 'INT-445566', 'Corporate', true, 'Employer HMO')
    on conflict (patient_id, payer_type) do update set
      payer_name = excluded.payer_name,
      member_id = excluded.member_id,
      plan_name = excluded.plan_name,
      notes = excluded.notes,
      updated_at = now();
  end if;

  -- Patient documents (metadata â€” preview needs storage upload separately)
  if to_regclass('public.patient_documents') is not null then
    insert into public.patient_documents (id, organization_id, branch_id, patient_id, file_name, file_type, file_size, storage_path, category, notes, uploaded_by)
    values
      ('de000f01-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'panoramic-xray-2026.jpg', 'image/jpeg', 245000,
        v_org_id::text || '/' || v_patient1::text || '/panoramic-xray-2026.jpg', 'xray', 'Initial panoramic', v_provider_id),
      ('de000f01-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_patient1, 'valid-id.jpg', 'image/jpeg', 120000,
        v_org_id::text || '/' || v_patient1::text || '/valid-id.jpg', 'id', 'Government ID on file', v_provider_id),
      ('de000f01-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'periapical-36.png', 'image/png', 89000,
        v_org_id::text || '/de000002-0000-4000-8000-000000000002/periapical-36.png', 'xray', 'Tooth #36 PA', v_provider_id),
      ('de000f01-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, 'hmo-letter.pdf', 'application/pdf', 56000,
        v_org_id::text || '/de000008-0000-4000-8000-000000000008/hmo-letter.pdf', 'insurance', 'LOA from HMO', v_provider_id),
      ('de000f01-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, 'referral-endo.pdf', 'application/pdf', 42000,
        v_org_id::text || '/de000007-0000-4000-8000-000000000007/referral-endo.pdf', 'referral', 'Endo referral', v_provider_id)
    on conflict (id) do update set
      file_name = excluded.file_name,
      category = excluded.category,
      notes = excluded.notes;
  end if;

  -- Ortho cases + adjustment timeline
  if to_regclass('public.ortho_cases') is not null then
    insert into public.ortho_cases (id, organization_id, branch_id, patient_id, status, appliance_type, start_date, contract_amount, notes, created_by)
    values
      (v_ortho_case1, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid, 'active', 'Metal braces', v_manila_today - 180, 85000, '18-month contract â€” showcase', v_provider_id),
      (v_ortho_case2, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, 'active', 'Clear aligners', v_manila_today - 90, 120000, 'Invisalign-style plan', v_provider_id)
    on conflict (id) do update set
      status = excluded.status,
      contract_amount = excluded.contract_amount,
      notes = excluded.notes,
      updated_at = now();

    insert into public.ortho_adjustments (id, organization_id, branch_id, case_id, adjustment_date, procedure, next_procedure, next_visit_date, payment_amount, notes, created_by)
    values
      ('de000d02-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_ortho_case1, v_manila_today - 60, 'Wire change U/L', 'Elastic training', v_manila_today - 30, 3500, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_ortho_case1, v_manila_today - 30, 'Elastic training', 'Wire change', v_manila_today, 3500, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_ortho_case1, v_manila_today - 7, 'Monthly adjustment', 'Wire change', v_manila_today + 21, 3500, 'Good cooperation', v_provider_id),
      ('de000d02-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_ortho_case2, v_manila_today - 45, 'Aligner set #3', 'Aligner set #4', v_manila_today - 15, 8000, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_ortho_case2, v_manila_today - 15, 'Aligner set #4', 'Aligner set #5', v_manila_today + 15, 8000, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_ortho_case2, v_manila_today - 1, 'IPR #12-22', 'Aligner set #5', v_manila_today + 14, 0, 'Minor IPR', v_provider_id)
    on conflict (id) do update set
      procedure = excluded.procedure,
      payment_amount = excluded.payment_amount,
      adjustment_date = excluded.adjustment_date;
  end if;

  -- Kiosk intake drafts (patients page panel)
  if to_regclass('public.patient_intakes') is not null then
    insert into public.patient_intakes (id, organization_id, branch_id, patient_id, status, payload, created_at)
    values
      ('de001301-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Sofia", "last_name": "Navarro", "phone": "+639178880001", "email": "sofia.n@example.ph", "date_of_birth": "1997-04-12", "medical_alerts": "Latex allergy"}'::jsonb,
        now() - interval '2 hours'),
      ('de001301-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Rafael", "last_name": "Lim", "phone": "+639178880002", "gender": "male", "address": "BGC, Taguig"}'::jsonb,
        now() - interval '45 minutes'),
      ('de001301-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Grace", "last_name": "Tan", "phone": "+639178880003", "purpose": "Walk-in toothache"}'::jsonb,
        now() - interval '20 minutes'),
      ('de001301-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Kevin", "last_name": "Ong", "phone": "+639178880004", "referral": "Ortho consult"}'::jsonb,
        now() - interval '10 minutes')
    on conflict (id) do update set
      payload = excluded.payload,
      status = excluded.status;
  end if;

  -- Audit trail (settings/audit + analytics)
  if to_regclass('public.organization_audit_logs') is not null then
    insert into public.organization_audit_logs (id, organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata, created_at)
    values
      ('de001101-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_provider_id, 'patient.create', 'patient', v_patient1::text, '{"source": "demo_seed"}'::jsonb, now() - interval '6 days'),
      ('de001101-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_provider_id, 'appointment.check_in', 'appointment', 'de000103-0000-4000-8000-000000000003', '{}'::jsonb, now() - interval '25 minutes'),
      ('de001101-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_provider_id, 'invoice.payment', 'invoice', 'de000301-0000-4000-8000-000000000003', '{"amount": 3500, "method": "gcash"}'::jsonb, now() - interval '2 hours'),
      ('de001101-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_provider_id, 'consent.signed', 'patient_consent', 'de000401-0000-4000-8000-000000000002', '{"template": "general-treatment"}'::jsonb, now() - interval '3 days'),
      ('de001101-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_provider_id, 'inventory.adjust', 'inventory_item', 'de000701-0000-4000-8000-000000000001', '{"delta": -1}'::jsonb, now() - interval '1 day'),
      ('de001101-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_provider_id, 'treatment_plan.create', 'treatment_plan', 'de000a01-0000-4000-8000-000000000001', '{}'::jsonb, now() - interval '5 days'),
      ('de001101-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, v_provider_id, 'hmo_claim.draft', 'hmo_claim', 'de000801-0000-4000-8000-000000000001', '{}'::jsonb, now() - interval '4 days'),
      ('de001101-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, v_provider_id, 'queue.check_in', 'queue_entry', 'de000201-0000-4000-8000-000000000004', '{}'::jsonb, now() - interval '20 minutes'),
      ('de001101-0000-4000-8000-000000000009'::uuid, v_org_id, v_branch_id, v_provider_id, 'patient.update', 'patient', 'de000003-0000-4000-8000-000000000003'::text, '{"field": "phone"}'::jsonb, now() - interval '2 days'),
      ('de001101-0000-4000-8000-00000000000a'::uuid, v_org_id, v_branch_id, v_provider_id, 'clinical_note.sign', 'clinical_note', 'de000601-0000-4000-8000-000000000001', '{}'::jsonb, now() - interval '1 hour')
    on conflict (id) do update set
      action = excluded.action,
      metadata = excluded.metadata,
      created_at = excluded.created_at;
  end if;

  if to_regclass('public.session_audit_logs') is not null and v_provider_id is not null then
    insert into public.session_audit_logs (id, profile_id, organization_id, event_type, ip_address, created_at)
    values
      ('de001102-0000-4000-8000-000000000001'::uuid, v_provider_id, v_org_id, 'login', '203.177.0.1', now() - interval '8 hours'),
      ('de001102-0000-4000-8000-000000000002'::uuid, v_provider_id, v_org_id, 'logout', '203.177.0.1', now() - interval '7 hours'),
      ('de001102-0000-4000-8000-000000000003'::uuid, v_provider_id, v_org_id, 'login', '203.177.0.1', now() - interval '30 minutes')
    on conflict (id) do update set
      event_type = excluded.event_type,
      created_at = excluded.created_at;
  end if;

  -- Notification logs (settings/notifications)
  if to_regclass('public.notification_logs') is not null then
    insert into public.notification_logs (id, organization_id, branch_id, patient_id, template_key, recipient_phone, body_preview, status, created_at)
    values
      ('de001201-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'appointment_reminder_24h', '+639171234001', 'Reminder: appt tomorrow 9:00 AM at Dentali.', 'delivered', now() - interval '1 day'),
      ('de001201-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'appointment_reminder_2h', '+639171234002', 'Your appointment is in 2 hours.', 'sent', now() - interval '3 hours'),
      ('de001201-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, 'payment_receipt', '+639171234003', 'Payment received: PHP 3,500. Thank you!', 'delivered', now() - interval '2 hours'),
      ('de001201-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, 'waitlist_slot', '+639171234009', 'A slot opened Thu 2pm â€” reply YES to book.', 'failed', now() - interval '5 hours'),
      ('de001201-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, 'appointment_reminder_24h', '+639171234007', 'Reminder: crown prep tomorrow.', 'dry_run', now() - interval '12 hours'),
      ('de001201-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_patient1, 'consent_signing_link', '+639171234001', 'Sign your consent: https://dentali.ph/sign/demo', 'sent', now() - interval '6 hours')
    on conflict (id) do update set
      status = excluded.status,
      body_preview = excluded.body_preview,
      created_at = excluded.created_at;
  end if;

  -- Staff invitations (settings/staff pending section)
  if to_regclass('public.staff_invitations') is not null and v_role_dentist is not null then
    insert into public.staff_invitations (id, organization_id, branch_id, role_id, email, full_name, status, invited_by)
    values
      ('de001401-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_role_dentist, 'dr.santos.demo@example.ph', 'Dr. Paolo Santos', 'pending', v_provider_id),
      ('de001401-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, coalesce(v_role_receptionist, v_role_dentist), 'reception.demo@example.ph', 'Aira Mendoza', 'pending', v_provider_id)
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      status = excluded.status;
  end if;

  -- Extra branches + clinic hours (multi-branch settings & benchmark)
  insert into public.branches (id, organization_id, name, address, contact_number, is_active)
  values
    (v_branch2_id, v_org_id, 'Dentali Makati Branch', 'Ayala Ave, Makati City, Metro Manila', '+63288123456', true),
    (v_branch3_id, v_org_id, 'Dentali QC Branch', 'Timog Ave, Quezon City, Metro Manila', '+63289876543', true)
  on conflict (id) do update set
    name = excluded.name,
    address = excluded.address,
    contact_number = excluded.contact_number,
    is_active = excluded.is_active,
    updated_at = now();

  if to_regprocedure('public.ensure_branch_clinic_hours(uuid)') is not null then
    perform public.ensure_branch_clinic_hours(v_branch_id);
    perform public.ensure_branch_clinic_hours(v_branch2_id);
    perform public.ensure_branch_clinic_hours(v_branch3_id);
  end if;

  if to_regclass('public.clinic_hours') is not null then
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values
      (v_branch_id, 6, '09:00'::time, '13:00'::time, false)
    on conflict (branch_id, day_of_week) do update set
      open_time = excluded.open_time,
      close_time = excluded.close_time,
      is_closed = excluded.is_closed;
  end if;

  -- Branch 2 sample appointments for benchmark
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de001601-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch2_id, 'de000009-0000-4000-8000-000000000009'::uuid,
      (v_manila_today + time '10:00') at time zone 'Asia/Manila', 30, 'Makati â€” cleaning', 'scheduled'),
    ('de001601-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch2_id, 'de00000a-0000-4000-8000-00000000000a'::uuid,
      (v_manila_today + time '11:00') at time zone 'Asia/Manila', 45, 'Makati â€” extraction', 'confirmed'),
    ('de001601-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch3_id, 'de00000c-0000-4000-8000-00000000000c'::uuid,
      (v_manila_today + time '14:30') at time zone 'Asia/Manila', 30, 'QC â€” check-up', 'scheduled')
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    status = excluded.status;

  -- Provider availability grid (appointments page)
  if to_regclass('public.provider_availability') is not null and v_provider_id is not null then
    insert into public.provider_availability (id, organization_id, branch_id, provider_id, day_of_week, start_time, end_time, slot_minutes, is_available)
    values
      ('de001701-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_provider_id, 1, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_provider_id, 2, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_provider_id, 3, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_provider_id, 4, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_provider_id, 5, '09:00', '17:00', 30, true),
      ('de001701-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_provider_id, 6, '09:00', '13:00', 30, true),
      ('de001701-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, v_provider_id, 0, '09:00', '12:00', 30, false)
    on conflict (branch_id, provider_id, day_of_week) do update set
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_available = excluded.is_available;
  end if;

  -- Closeout history (reports/closeout)
  if to_regclass('public.closeout_snapshots') is not null then
    insert into public.closeout_snapshots (id, organization_id, branch_id, snapshot_date, payload, created_by, created_at)
    values
      ('de001501-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_manila_today - 1,
        jsonb_build_object('appointments_completed', 8, 'collected', 18500, 'open_invoices', 4), v_provider_id, (v_manila_today - 1) + time '18:30'),
      ('de001501-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_manila_today - 2,
        jsonb_build_object('appointments_completed', 6, 'collected', 12200, 'open_invoices', 5), v_provider_id, (v_manila_today - 2) + time '18:15'),
      ('de001501-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_manila_today - 3,
        jsonb_build_object('appointments_completed', 9, 'collected', 21000, 'open_invoices', 3), v_provider_id, (v_manila_today - 3) + time '18:45'),
      ('de001501-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_manila_today - 4,
        jsonb_build_object('appointments_completed', 5, 'collected', 9800, 'open_invoices', 6), v_provider_id, (v_manila_today - 4) + time '18:00'),
      ('de001501-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_manila_today - 5,
        jsonb_build_object('appointments_completed', 7, 'collected', 15600, 'open_invoices', 4), v_provider_id, (v_manila_today - 5) + time '18:20')
    on conflict (id) do update set
      payload = excluded.payload,
      snapshot_date = excluded.snapshot_date;
  end if;

  -- Well-stocked inventory alongside low-stock items
  insert into public.inventory_items (id, organization_id, branch_id, name, sku, category, unit, quantity_on_hand, min_stock_level, is_active)
  values
    ('de000702-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'Dental mirrors', 'MIR-01', 'instrument', 'pc', 24, 10, true),
    ('de000702-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'Anesthetic cartridges', 'ANES-2', 'anesthetic', 'box', 18, 8, true),
    ('de000702-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'Face masks', 'MASK-3', 'consumable', 'box', 15, 5, true)
  on conflict (id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    updated_at = now();

  -- Odontogram (when dental_charts + tooth_findings exist)
  if to_regclass('public.dental_charts') is not null and to_regclass('public.tooth_findings') is not null then
    insert into public.dental_charts (id, organization_id, branch_id, patient_id, status)
    values (v_chart_id, v_org_id, v_branch_id, v_patient1, 'active')
    on conflict (id) do update set status = excluded.status, updated_at = now();

    insert into public.tooth_findings (id, chart_id, patient_id, organization_id, branch_id, tooth_number, dentition_type, condition, surfaces, restoration_type, status)
    values
      ('de000c01-0000-4000-8000-000000000001'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '36', 'permanent', 'decayed', array['center','top']::text[], null, 'active'),
      ('de000c01-0000-4000-8000-000000000002'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '26', 'permanent', 'present', array[]::text[], 'composite', 'active'),
      ('de000c01-0000-4000-8000-000000000003'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '46', 'permanent', 'decayed', array['center']::text[], null, 'active'),
      ('de000c01-0000-4000-8000-000000000004'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '11', 'permanent', 'present', array[]::text[], 'jacket_crown', 'active'),
      ('de000c01-0000-4000-8000-000000000005'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '38', 'permanent', 'indicated_extraction', array[]::text[], null, 'active')
    on conflict (id) do update set
      condition = excluded.condition,
      surfaces = excluded.surfaces,
      restoration_type = excluded.restoration_type,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'branch_id', v_branch_id,
    'organization_id', v_org_id,
    'manila_date', v_manila_today,
    'demo_patient_ids', jsonb_build_array(
      v_patient1::text,
      'de000002-0000-4000-8000-000000000002',
      'de000003-0000-4000-8000-000000000003',
      'de00000b-0000-4000-8000-00000000000b',
      'de000007-0000-4000-8000-000000000007'
    ),
    'demo_branch_ids', jsonb_build_array(v_branch_id::text, v_branch2_id::text, v_branch3_id::text),
    'modules_seeded', jsonb_build_array(
      'patients', 'appointments', 'queue', 'waitlist', 'consents', 'treatment_plans',
      'invoices', 'payments', 'clinical_notes', 'inventory', 'hmo', 'philhealth',
      'odontogram', 'medical_history', 'insurance', 'documents', 'ortho', 'intakes',
      'audit', 'notifications', 'staff_invitations', 'branches', 'provider_availability', 'closeout'
    ),
    'hint', 'Set LANDING_SHOWCASE_BRANCH_ID=' || v_branch_id::text || ' in .env.local for public landing previews'
  );
end;
$$;

grant execute on function public.seed_demo_showcase_data(uuid) to authenticated;
grant execute on function public.seed_demo_showcase_data(uuid) to service_role;


-- ===== 20260612160000_dental_chart_odontogram.sql =====

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
drop policy if exists dental_charts_select on public.dental_charts;
create policy dental_charts_select on public.dental_charts for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

drop policy if exists dental_charts_insert on public.dental_charts;
drop policy if exists dental_charts_insert on public.dental_charts;
create policy dental_charts_insert on public.dental_charts for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists dental_charts_update on public.dental_charts;
drop policy if exists dental_charts_update on public.dental_charts;
create policy dental_charts_update on public.dental_charts for update using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists tooth_findings_select on public.tooth_findings;
drop policy if exists tooth_findings_select on public.tooth_findings;
create policy tooth_findings_select on public.tooth_findings for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

drop policy if exists tooth_findings_insert on public.tooth_findings;
drop policy if exists tooth_findings_insert on public.tooth_findings;
create policy tooth_findings_insert on public.tooth_findings for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists tooth_findings_update on public.tooth_findings;
drop policy if exists tooth_findings_update on public.tooth_findings;
create policy tooth_findings_update on public.tooth_findings for update using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

drop policy if exists dental_chart_audit_select on public.dental_chart_audit_events;
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


-- ===== 20260612200000_display_masked_names.sql =====

-- TV display: heavily masked patient names (no full PHI on public token)

create or replace function public._mask_patient_display_name(p_first text, p_last text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(trim(p_first), '') = '' and coalesce(trim(p_last), '') = '' then null
    when coalesce(trim(p_last), '') = '' then upper(left(trim(p_first), 1)) || '***'
    when coalesce(trim(p_first), '') = '' then upper(left(trim(p_last), 1)) || '***'
    else upper(left(trim(p_first), 1)) || '*** ' || upper(left(trim(p_last), 1)) || '***'
  end;
$$;

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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name)
      )
      order by qe.called_at nulls last
    ),
    '[]'::jsonb
  )
  into v_now_serving
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id and qe.status = 'now_serving';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name)
      )
      order by qe.checked_in_at
    ),
    '[]'::jsonb
  )
  into v_waiting
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id and qe.status in ('waiting', 'ready');

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;


-- ===== 20260612210000_periodontal_chart.sql =====

-- Periodontal pocket chart JSON on dental_charts + RPC sync

alter table public.dental_charts
  add column if not exists periodontal_data jsonb not null default '{}'::jsonb;

comment on column public.dental_charts.periodontal_data is
  '6-site pocket depths per tooth (FDI keys). See app periodontal-types.';

-- ---------------------------------------------------------------------------
-- get_patient_periodontal
-- ---------------------------------------------------------------------------
drop function if exists public.get_patient_periodontal(uuid, uuid);

create or replace function public.get_patient_periodontal(p_patient_id uuid, p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_chart record;
begin
  if p_branch_id is not null and not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select id, patient_id, branch_id, periodontal_data
  into v_chart
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

  return jsonb_build_object(
    'chart_id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'data', coalesce(v_chart.periodontal_data, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.get_patient_periodontal(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_patient_periodontal
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid);

create or replace function public.upsert_patient_periodontal(
  p_patient_id uuid,
  p_branch_id uuid,
  p_organization_id uuid,
  p_data jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chart_id uuid;
  v_chart record;
begin
  if not public.has_permission('dental_chart.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  select id into v_chart_id
  from public.dental_charts
  where patient_id = p_patient_id
    and branch_id = p_branch_id
    and organization_id = p_organization_id
    and status = 'active'
  order by updated_at desc
  limit 1;

  if v_chart_id is null then
    insert into public.dental_charts (
      organization_id, branch_id, patient_id, periodontal_data, created_by, updated_by
    ) values (
      p_organization_id, p_branch_id, p_patient_id, coalesce(p_data, '{}'::jsonb),
      p_actor_user_id, p_actor_user_id
    )
    returning id into v_chart_id;
  else
    update public.dental_charts
    set
      periodontal_data = coalesce(p_data, '{}'::jsonb),
      updated_by = p_actor_user_id,
      updated_at = now()
    where id = v_chart_id;
  end if;

  select id, patient_id, branch_id, periodontal_data
  into v_chart
  from public.dental_charts
  where id = v_chart_id;

  return jsonb_build_object(
    'chart_id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'data', coalesce(v_chart.periodontal_data, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid) to authenticated;


-- ===== 20260612220000_recall_owner_automation.sql =====

-- P3 automation: hygiene recall SMS + owner daily digest SMS
-- Depends on: workflow settings, notification_templates, patient_branch_links

-- ---------------------------------------------------------------------------
-- Workflow defaults (new keys)
-- ---------------------------------------------------------------------------
create or replace function public._default_workflow_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true,
    'auto_hygiene_recall', true,
    'auto_owner_digest_sms', false
  );
$$;

-- ---------------------------------------------------------------------------
-- Internal closeout payload (service role / cron safe â€” no auth.uid() org)
-- ---------------------------------------------------------------------------
create or replace function public._build_daily_closeout_payload(
  p_org_id uuid,
  p_branch_id uuid default null,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_org_id is null then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'date', p_date,
    'collected', (
      select coalesce(sum(ip.amount), 0)
      from public.invoice_payments ip
      join public.invoices inv on inv.id = ip.invoice_id
      where inv.organization_id = p_org_id
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and ip.created_at::date = p_date
    ),
    'open_balance', (
      select coalesce(sum(inv.total_amount - inv.paid_amount), 0)
      from public.invoices inv
      where inv.organization_id = p_org_id
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'open_invoice_count', (
      select count(*)
      from public.invoices inv
      where inv.organization_id = p_org_id
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'appointments_completed', (
      select count(*)
      from public.appointments a
      where a.organization_id = p_org_id
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'completed'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'no_show', (
      select count(*)
      from public.appointments a
      where a.organization_id = p_org_id
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'no_show'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'pending_consents', (
      select count(*)
      from public.patient_consents pc
      where pc.organization_id = p_org_id
        and (p_branch_id is null or pc.branch_id = p_branch_id)
        and pc.status = 'pending'
    ),
    'hmo_pending', (
      select count(*)
      from public.hmo_claims hc
      where hc.organization_id = p_org_id
        and (p_branch_id is null or hc.branch_id = p_branch_id)
        and hc.status in ('draft', 'submitted', 'under_review')
    ),
    'low_stock', (
      select case when p_branch_id is null then 0 else (
        select count(*) from public.inventory_items i
        where i.branch_id = p_branch_id and i.is_active
          and (i.quantity_on_hand <= i.min_stock_level
            or (i.expiry_date is not null and i.expiry_date < current_date))
      ) end
    )
  );
end;
$$;

grant execute on function public._build_daily_closeout_payload(uuid, uuid, date) to service_role;

-- Authenticated wrapper keeps existing permission model
create or replace function public.get_daily_closeout(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  return public._build_daily_closeout_payload(v_org, p_branch_id, p_date);
end;
$$;

grant execute on function public.get_daily_closeout(uuid, date) to authenticated;

-- Fix closeout email enqueue to use internal builder
create or replace function public.enqueue_closeout_email_digest(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_admin record;
  v_payload jsonb;
  v_count int := 0;
begin
  for v_org in
    select distinct o.id as organization_id
    from public.organizations o
  loop
    for v_admin in
      select distinct p.email
      from public.profiles p
      join public.staff_branch_assignments sba on sba.profile_id = p.id
      join public.roles r on r.id = sba.role_id
      where p.organization_id = v_org.organization_id
        and r.name in ('owner', 'admin')
        and p.email is not null
        and length(trim(p.email)) > 0
    loop
      v_payload := public._build_daily_closeout_payload(v_org.organization_id, null, p_date);

      if not exists (
        select 1 from public.closeout_email_queue
        where organization_id = v_org.organization_id
          and recipient_email = v_admin.email
          and snapshot_date = p_date
          and status in ('pending', 'sent', 'dry_run')
      ) then
        insert into public.closeout_email_queue (
          organization_id, branch_id, recipient_email, snapshot_date, payload
        ) values (
          v_org.organization_id, null, v_admin.email, p_date, v_payload
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hygiene recall queue
-- ---------------------------------------------------------------------------
create table if not exists public.patient_recall_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  last_visit_date date not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_recall_queue_pending
  on public.patient_recall_queue(branch_id, created_at)
  where processed_at is null;

alter table public.patient_recall_queue enable row level security;

drop policy if exists patient_recall_queue_select on public.patient_recall_queue;
drop policy if exists patient_recall_queue_select on public.patient_recall_queue;
create policy patient_recall_queue_select on public.patient_recall_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', branch_id)
  );

drop policy if exists patient_recall_queue_service on public.patient_recall_queue;
drop policy if exists patient_recall_queue_service on public.patient_recall_queue;
create policy patient_recall_queue_service on public.patient_recall_queue
  for all to service_role using (true) with check (true);

create table if not exists public.patient_recall_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  last_visit_date date not null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_patient_recall_dispatches_recent
  on public.patient_recall_dispatches(patient_id, branch_id, sent_at desc);

alter table public.patient_recall_dispatches enable row level security;

drop policy if exists patient_recall_dispatches_select on public.patient_recall_dispatches;
drop policy if exists patient_recall_dispatches_select on public.patient_recall_dispatches;
create policy patient_recall_dispatches_select on public.patient_recall_dispatches
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', branch_id)
  );

drop policy if exists patient_recall_dispatches_service on public.patient_recall_dispatches;
drop policy if exists patient_recall_dispatches_service on public.patient_recall_dispatches;
create policy patient_recall_dispatches_service on public.patient_recall_dispatches
  for all to service_role using (true) with check (true);

create or replace function public.enqueue_hygiene_recalls(
  p_branch_id uuid,
  p_months int default 6
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row record;
  v_cutoff date := (current_date - make_interval(months => greatest(p_months, 1)));
  v_window_start date := v_cutoff - 7;
begin
  if not public._workflow_enabled(p_branch_id, 'auto_hygiene_recall') then
    return 0;
  end if;

  for v_row in
    select
      b.organization_id,
      pbl.branch_id,
      pbl.patient_id,
      pbl.last_visit_at::date as last_visit_date
    from public.patient_branch_links pbl
    join public.patients p on p.id = pbl.patient_id
    join public.branches b on b.id = pbl.branch_id
    where pbl.branch_id = p_branch_id
      and b.is_active
      and p.status = 'active'
      and pbl.last_visit_at is not null
      and pbl.last_visit_at::date >= v_window_start
      and pbl.last_visit_at::date <= v_cutoff
      and coalesce(length(trim(p.phone)), 0) > 0
      and not exists (
        select 1 from public.appointments a
        where a.patient_id = pbl.patient_id
          and a.branch_id = p_branch_id
          and a.status in ('scheduled', 'confirmed', 'checked_in')
          and a.scheduled_at >= now()
      )
      and not exists (
        select 1 from public.patient_recall_dispatches d
        where d.patient_id = pbl.patient_id
          and d.branch_id = p_branch_id
          and d.sent_at > now() - interval '150 days'
      )
      and not exists (
        select 1 from public.patient_recall_queue q
        where q.patient_id = pbl.patient_id
          and q.branch_id = p_branch_id
          and q.processed_at is null
      )
  loop
    insert into public.patient_recall_queue (
      organization_id, branch_id, patient_id, last_visit_date
    ) values (
      v_row.organization_id, v_row.branch_id, v_row.patient_id, v_row.last_visit_date
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.enqueue_hygiene_recalls(uuid, int) to service_role;

create or replace function public.claim_hygiene_recall_batch(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'branch_id', q.branch_id,
      'organization_id', q.organization_id,
      'patient_id', q.patient_id,
      'last_visit_date', q.last_visit_date
    ))
    from (
      select * from public.patient_recall_queue
      where processed_at is null
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_hygiene_recall_batch(int) to service_role;

create or replace function public.mark_hygiene_recall_processed(
  p_id uuid,
  p_dispatched boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.patient_recall_queue%rowtype;
begin
  select * into v_row
  from public.patient_recall_queue
  where id = p_id and processed_at is null
  for update;

  if not found then
    return;
  end if;

  update public.patient_recall_queue
  set processed_at = now()
  where id = p_id;

  if p_dispatched then
    insert into public.patient_recall_dispatches (
      organization_id, branch_id, patient_id, last_visit_date
    ) values (
      v_row.organization_id, v_row.branch_id, v_row.patient_id, v_row.last_visit_date
    );
  end if;
end;
$$;

grant execute on function public.mark_hygiene_recall_processed(uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Owner digest SMS queue
-- ---------------------------------------------------------------------------
create table if not exists public.owner_digest_sms_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  recipient_phone text not null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  snapshot_date date not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'dry_run', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_owner_digest_sms_pending
  on public.owner_digest_sms_queue(branch_id, snapshot_date)
  where status = 'pending';

alter table public.owner_digest_sms_queue enable row level security;

drop policy if exists owner_digest_sms_queue_admin on public.owner_digest_sms_queue;
drop policy if exists owner_digest_sms_queue_admin on public.owner_digest_sms_queue;
create policy owner_digest_sms_queue_admin on public.owner_digest_sms_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists owner_digest_sms_queue_service on public.owner_digest_sms_queue;
drop policy if exists owner_digest_sms_queue_service on public.owner_digest_sms_queue;
create policy owner_digest_sms_queue_service on public.owner_digest_sms_queue
  for all to service_role using (true) with check (true);

create or replace function public.enqueue_owner_digest_sms(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch record;
  v_owner record;
  v_payload jsonb;
  v_count int := 0;
begin
  for v_branch in
    select b.id as branch_id, b.organization_id
    from public.branches b
    where b.is_active
      and public._workflow_enabled(b.id, 'auto_owner_digest_sms')
  loop
    v_payload := public._build_daily_closeout_payload(v_branch.organization_id, v_branch.branch_id, p_date);

    for v_owner in
      select distinct p.id as profile_id, sp.phone_number
      from public.profiles p
      join public.staff_profiles sp on sp.profile_id = p.id
      join public.staff_branch_assignments sba on sba.profile_id = p.id
      join public.roles r on r.id = sba.role_id
      where p.organization_id = v_branch.organization_id
        and sba.branch_id = v_branch.branch_id
        and r.name in ('owner', 'admin')
        and coalesce(sp.is_active, true)
        and sp.phone_number is not null
        and length(trim(sp.phone_number)) > 0
    loop
      if not exists (
        select 1 from public.owner_digest_sms_queue q
        where q.branch_id = v_branch.branch_id
          and q.recipient_phone = trim(v_owner.phone_number)
          and q.snapshot_date = p_date
          and q.status in ('pending', 'sent', 'dry_run')
      ) then
        insert into public.owner_digest_sms_queue (
          organization_id,
          branch_id,
          recipient_phone,
          recipient_profile_id,
          snapshot_date,
          payload
        ) values (
          v_branch.organization_id,
          v_branch.branch_id,
          trim(v_owner.phone_number),
          v_owner.profile_id,
          p_date,
          v_payload
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.enqueue_owner_digest_sms(date) to service_role;

create or replace function public.claim_owner_digest_sms_batch(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'organization_id', q.organization_id,
      'branch_id', q.branch_id,
      'recipient_phone', q.recipient_phone,
      'snapshot_date', q.snapshot_date,
      'payload', q.payload
    ))
    from (
      select * from public.owner_digest_sms_queue
      where status = 'pending'
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_owner_digest_sms_batch(int) to service_role;

create or replace function public.mark_owner_digest_sms_sent(
  p_id uuid,
  p_status text default 'sent',
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.owner_digest_sms_queue
  set status = coalesce(p_status, 'sent'),
      error_message = p_error,
      sent_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.mark_owner_digest_sms_sent(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Notification templates (new orgs + backfill existing orgs)
-- ---------------------------------------------------------------------------
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
     '{{clinic_name}}: Queue number {{queue_code}} â€” please proceed to the front desk.'),
    (p_org_id, 'hygiene_recall',
     'Hygiene recall (6 months)',
     'Hi {{patient_name}}, it has been 6 months since your visit at {{clinic_name}}. Book your check-up: {{booking_link}}'),
    (p_org_id, 'owner_daily_digest',
     'Owner daily digest SMS',
     '{{clinic_name}} {{date}}: Collected {{collected}}, open {{open_balance}}, done {{appointments_completed}}, no-shows {{no_show}}.');
end;
$$;

insert into public.notification_templates (organization_id, template_key, name, body)
select
  o.id,
  v.template_key,
  v.name,
  v.body
from public.organizations o
cross join (
  values
    (
      'hygiene_recall',
      'Hygiene recall (6 months)',
      'Hi {{patient_name}}, it has been 6 months since your visit at {{clinic_name}}. Book your check-up: {{booking_link}}'
    ),
    (
      'owner_daily_digest',
      'Owner daily digest SMS',
      '{{clinic_name}} {{date}}: Collected {{collected}}, open {{open_balance}}, done {{appointments_completed}}, no-shows {{no_show}}.'
    )
) as v(template_key, name, body)
where not exists (
  select 1 from public.notification_templates nt
  where nt.organization_id = o.id and nt.template_key = v.template_key
);


-- ===== 20260612230000_staff_phone_digest.sql =====


-- ===== 20260612240000_marketing_leads.sql =====

-- Public marketing lead capture (quote / contact forms on landing pages)

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null default 'quote' check (lead_type in ('quote', 'contact')),
  full_name text not null,
  email text not null,
  phone text,
  clinic_name text,
  branch_count integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_leads_created_at_idx on public.marketing_leads (created_at desc);
create index if not exists marketing_leads_email_idx on public.marketing_leads (email);

alter table public.marketing_leads enable row level security;

drop policy if exists marketing_leads_service_read on public.marketing_leads;
create policy marketing_leads_service_read on public.marketing_leads
  for select
  to service_role
  using (true);

create or replace function public.submit_marketing_lead(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_email text;
begin
  v_name := nullif(trim(p_payload->>'full_name'), '');
  v_email := nullif(lower(trim(p_payload->>'email')), '');

  if v_name is null then
    raise exception 'full_name is required';
  end if;
  if v_email is null then
    raise exception 'email is required';
  end if;

  insert into public.marketing_leads (
    lead_type,
    full_name,
    email,
    phone,
    clinic_name,
    branch_count,
    message,
    metadata
  )
  values (
    coalesce(nullif(trim(p_payload->>'lead_type'), ''), 'quote'),
    v_name,
    v_email,
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'clinic_name'), ''),
    nullif(trim(p_payload->>'branch_count'), '')::integer,
    nullif(trim(p_payload->>'message'), ''),
    coalesce(p_payload->'metadata', '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_marketing_lead(jsonb) from public;
grant execute on function public.submit_marketing_lead(jsonb) to anon, authenticated, service_role;


-- ===== 20260612250000_sterilization_compliance.sql =====

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
drop policy if exists compliance_cycles_select on public.compliance_cycles;
create policy compliance_cycles_select on public.compliance_cycles
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('compliance.read', branch_id)
  );

drop policy if exists compliance_cycles_insert on public.compliance_cycles;
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


-- ===== 20260613180000_merge_dpa_general_consent.sql =====

-- Disable the separate dpa-consent template
update public.consent_templates
set is_active = false, is_default = false
where organization_id is null and slug = 'dpa-consent';

-- Merge DPA into general-treatment template
update public.consent_templates
set
  name = 'Data Privacy & General Treatment Consent',
  description = 'Combined consent for data processing (DPA) and general dental treatment',
  source_asset = 'PDA',
  body = 'DATA PRIVACY CONSENT (Republic Act No. 10173):
I consent to the collection, use, and processing of my personal and health information in accordance with the Data Privacy Act of 2012.

GENERAL TREATMENT CONSENT:
I consent to dental examination, diagnosis, and treatment as recommended by my dental provider at {{clinic_name}}.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}',
  fields = '[
    {"id":"data_use_ack","type":"yes_no","label":"I consent to collection and use of my personal and health information per the Data Privacy Act","required":true},
    {"id":"procedure_acknowledged","type":"yes_no","label":"I understand the proposed treatment and alternatives were explained","required":true},
    {"id":"questions_answered","type":"checkbox","label":"I had the opportunity to ask questions and they were answered","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]'::jsonb
where organization_id is null and slug = 'general-treatment';

-- ===== 20260613190000_fix_inventory_rls.sql =====

-- Drop the old overly restrictive policy
drop policy if exists inventory_items_all on public.inventory_items;

-- Allow all authenticated users with branch access to view inventory items
drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

-- Only allow users with settings.manage permission to insert/update/delete inventory items
drop policy if exists inventory_items_insert on public.inventory_items;
create policy inventory_items_insert on public.inventory_items
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );

drop policy if exists inventory_items_update on public.inventory_items;
create policy inventory_items_update on public.inventory_items
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  ) with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );

drop policy if exists inventory_items_delete on public.inventory_items;
create policy inventory_items_delete on public.inventory_items
  for delete to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );

-- ===== 20260613200000_add_invoice_series.sql =====

-- Add series column to invoices table
alter table public.invoices
  add column if not exists series text not null default 'INV';


-- ===== 20260613210000_fix_procedure_catalog_stable.sql =====

-- Redefine get_procedure_catalog as volatile (removing stable classification) so it can safely execute INSERT
create or replace function public.get_procedure_catalog(p_branch_id uuid)
returns jsonb
language plpgsql
volatile
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

-- ===== 20260613220000_fix_staff_creation_rls.sql =====

-- Migration: Fix RLS Policies for Direct Staff/Provider Creation
-- Target: Resolve RLS inserts violations on public.profiles, public.staff_profiles, and public.staff_branch_assignments

-- ---------------------------------------------------------------------------
-- 1. Redefine public.profiles policies
-- ---------------------------------------------------------------------------
drop policy if exists profile_insert on public.profiles;
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles
  for insert with check (
    id = auth.uid()
    or (
      organization_id = public.current_user_org_id()
      and public.user_is_org_admin()
    )
  );

drop policy if exists profile_update on public.profiles;
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles
  for update using (
    id = auth.uid()
    or (
      organization_id = public.current_user_org_id()
      and public.user_is_org_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Redefine public.staff_profiles policies
-- ---------------------------------------------------------------------------
drop policy if exists sp_insert on public.staff_profiles;
drop policy if exists sp_insert on public.staff_profiles;
create policy sp_insert on public.staff_profiles
  for insert with check (
    public.user_is_org_admin()
  );

drop policy if exists sp_update on public.staff_profiles;
drop policy if exists sp_update on public.staff_profiles;
create policy sp_update on public.staff_profiles
  for update using (
    profile_id = auth.uid()
    or public.user_is_org_admin()
  );

-- ---------------------------------------------------------------------------
-- 3. Redefine public.staff_branch_assignments policies
-- ---------------------------------------------------------------------------
drop policy if exists sba_insert on public.staff_branch_assignments;
drop policy if exists sba_insert on public.staff_branch_assignments;
create policy sba_insert on public.staff_branch_assignments
  for insert with check (
    public.user_is_org_admin()
  );

drop policy if exists sba_update on public.staff_branch_assignments;
drop policy if exists sba_update on public.staff_branch_assignments;
create policy sba_update on public.staff_branch_assignments
  for update using (
    profile_id = auth.uid()
    or public.user_is_org_admin()
  );


-- ===== 20260613230000_fix_appointment_slots.sql =====

-- Migration: Fix Appointment Slots â€” Remove current_user_org_id() dependency
-- Root cause: security definer functions call current_user_org_id() which relies
-- on profiles RLS, causing circular dependency and returning NULL for some users.
-- Fix: Resolve org_id directly from branches table (no RLS needed in security definer).

-- ---------------------------------------------------------------------------
-- 1. ensure_provider_availability_defaults: bypass current_user_org_id()
-- ---------------------------------------------------------------------------
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
  -- Resolve org_id directly from branches (no RLS in security definer)
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id;

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  -- Ensure clinic hours exist for this branch
  perform public.ensure_branch_clinic_hours(p_branch_id);

  -- Copy clinic hours into provider_availability for each day
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

-- ---------------------------------------------------------------------------
-- 2. get_available_appointment_slots: bypass current_user_org_id()
-- ---------------------------------------------------------------------------
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
  v_org_id uuid;
  v_dow smallint;
  v_avail record;
  v_slots jsonb := '[]'::jsonb;
  v_cursor time;
  v_end time;
  v_slot interval;
  v_ts timestamptz;
  v_taken boolean;
begin
  -- Resolve org from branches directly
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id;

  if v_org_id is null then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  -- Auto-provision defaults for this provider if not yet created
  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  -- PostgreSQL dow: 0=Sunday, 1=Monday ... 6=Saturday (matches clinic_hours)
  v_dow := extract(dow from p_date)::smallint;

  select pa.start_time, pa.end_time, pa.slot_minutes, pa.is_available
  into v_avail
  from public.provider_availability pa
  where pa.branch_id = p_branch_id
    and pa.provider_id = p_provider_id
    and pa.day_of_week = v_dow
    and pa.organization_id = v_org_id;

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

-- ---------------------------------------------------------------------------
-- 3. get_branch_provider_availability: bypass current_user_org_id()
-- ---------------------------------------------------------------------------
create or replace function public.get_branch_provider_availability(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_result jsonb;
begin
  -- Resolve org from branches directly
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id;

  if v_org_id is null then
    return jsonb_build_object('branch_id', p_branch_id, 'rows', '[]'::jsonb);
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
    and pa.organization_id = v_org_id;

  return jsonb_build_object('branch_id', p_branch_id, 'rows', v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. ensure_branch_clinic_hours: also remove org check
-- ---------------------------------------------------------------------------
create or replace function public.ensure_branch_clinic_hours(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d integer;
begin
  for d in 0..6 loop
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values (
      p_branch_id,
      d,
      case when d in (0, 6) then null else '09:00'::time end,
      case when d in (0, 6) then null else '18:00'::time end,
      d in (0, 6)
    )
    on conflict (branch_id, day_of_week) do nothing;
  end loop;
end;
$$;

-- Grant execute
grant execute on function public.ensure_provider_availability_defaults(uuid, uuid) to authenticated;
grant execute on function public.get_branch_provider_availability(uuid) to authenticated;
grant execute on function public.get_available_appointment_slots(uuid, uuid, date) to authenticated;
grant execute on function public.ensure_branch_clinic_hours(uuid) to authenticated;


-- ===== 20260613240000_inventory_automations.sql =====

-- Inventory enhancements
ALTER TABLE inventory_items 
add column if not existsIF NOT EXISTS supplier text,
add column if not existsIF NOT EXISTS brand text,
add column if not existsIF NOT EXISTS unit_cost numeric DEFAULT 0;

-- Lab Cases Module
CREATE TABLE IF NOT EXISTS lab_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  provider_id uuid,
  lab_name text NOT NULL,
  case_type text NOT NULL,
  sent_date date NOT NULL,
  expected_date date,
  received_date date,
  status text NOT NULL DEFAULT 'pending',
  cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Odontogram to Inventory Mapping
CREATE TABLE IF NOT EXISTS procedure_inventory_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  procedure_code text NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity_required numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Doctor Commissions
ALTER TABLE staff_profiles
add column if not existsIF NOT EXISTS commission_rate numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS provider_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL,
  calculated_at timestamptz DEFAULT now()
);


-- ===== 20260613250000_chair_time_tracking.sql =====

-- Add in_chair_at to queue_entries
alter table public.queue_entries add column if not exists in_chair_at timestamptz;

-- Update the update_queue_status function to set in_chair_at
create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_app_id uuid;
  v_branch_id uuid;
  v_patient_id uuid;
  v_old_status text;
  v_in_chair_at timestamptz;
  v_completed_at timestamptz;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    return jsonb_build_object('error', 'Entry not found');
  end if;

  v_app_id := v_entry.appointment_id;
  v_branch_id := v_entry.branch_id;
  v_patient_id := v_entry.patient_id;
  v_old_status := v_entry.status;
  
  -- Keep existing timestamps unless we are transitioning into the state
  v_in_chair_at := v_entry.in_chair_at;
  v_completed_at := v_entry.completed_at;

  if p_status = 'in_chair' and v_old_status != 'in_chair' then
    v_in_chair_at := now();
  end if;

  if p_status = 'served' and v_old_status != 'served' then
    v_completed_at := now();
  end if;

  update public.queue_entries
  set 
    status = p_status,
    chair_label = coalesce(p_chair_label, chair_label),
    called_at = case when p_status = 'now_serving' then now() else called_at end,
    in_chair_at = v_in_chair_at,
    completed_at = v_completed_at,
    updated_at = now()
  where id = p_entry_id;

  -- 1) Auto-Complete Appointment
  if p_status = 'served' and v_app_id is not null then
    -- Check workflow settings
    declare
      v_auto_served boolean;
    begin
      select (settings->>'auto_served_completes_appointment')::boolean into v_auto_served
      from public.workflow_settings
      where branch_id = v_branch_id;

      if coalesce(v_auto_served, true) then
        update public.appointments
        set status = 'completed', updated_at = now()
        where id = v_app_id;
      end if;
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('success', true);
end;
$$;


-- ===== 20260613260000_fix_kiosk_phone_match.sql =====

-- Fix Kiosk checkin phone match for Philippine phone prefixes (09 vs 639)
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

  -- Extract only digits, and take the last 10 digits
  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
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


-- ===== 20260613270000_fix_random_bytes_and_encoding.sql =====

-- Fix missing pgcrypto gen_random_bytes by switching to native gen_random_uuid()
-- Fix corrupted ANSI characters in consent templates

-- 1. Fix default tokens for branch_public_tokens
alter table public.branch_public_tokens 
  alter column token set default replace(gen_random_uuid()::text, '-', '');

-- 2. Fix default tokens for consent_signing_tokens
alter table public.consent_signing_tokens 
  alter column token set default replace(gen_random_uuid()::text, '-', '');

-- 3. Fix generate_consent_signing_token RPC
create or replace function public.generate_consent_signing_token(
  p_consent_id uuid,
  p_channel text default 'link'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent public.patient_consents%rowtype;
  v_token text;
begin
  select * into v_consent from public.patient_consents where id = p_consent_id;
  if not found then
    raise exception 'Consent not found';
  end if;

  if v_consent.status = 'signed' then
    raise exception 'Consent is already signed';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    p_consent_id,
    v_token,
    p_channel,
    now() + interval '7 days',
    public.current_user_id()
  );

  return v_token;
end;
$$;

-- 4. Fix generate_branch_public_token RPC
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

  -- Expire existing tokens for this type/branch
  update public.branch_public_tokens
  set is_active = false
  where branch_id = p_branch_id
    and token_type = p_token_type
    and is_active = true;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.branch_public_tokens (
    organization_id, branch_id, token, token_type, label, expires_at, created_by
  ) values (
    v_org, p_branch_id, v_token, p_token_type, p_label, now() + interval '24 hours', public.current_user_id()
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'token_type', p_token_type);
end;
$$;

-- 5. Fix Character Encoding (ANSI Ã¢â‚¬â€œ to standard UTF-8 hyphen -)
update public.consent_templates
set 
  name = replace(name, 'Ã¢â‚¬â€œ', '-'),
  body = replace(body, 'Ã¢â‚¬â€œ', '-');

-- 6. Fix create_consent_signing_token RPC
create or replace function public.create_consent_signing_token(
  p_consent_id uuid,
  p_channel text default 'qr',
  p_ttl_hours int default 72
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_token text;
begin
  select * into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id();

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status <> 'pending' then
    raise exception 'Consent is not pending';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    p_consent_id,
    v_token,
    coalesce(nullif(trim(p_channel), ''), 'qr'),
    now() + make_interval(hours => greatest(p_ttl_hours, 1)),
    auth.uid()
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', (now() + make_interval(hours => greatest(p_ttl_hours, 1)))::text
  );
end;
$$;


-- ===== 20260613270000_kiosk_enhancements.sql =====

-- Add mood to queue_entries
alter table public.queue_entries add column if not exists patient_mood text;

-- RPC to update mood
create or replace function public.update_queue_entry_mood(
  p_entry_id uuid,
  p_mood text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queue_entries
  set patient_mood = p_mood
  where id = p_entry_id;
end;
$$;

-- RPC to get live queue stats for kiosk
create or replace function public.get_kiosk_queue_stats(
  p_branch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serving jsonb;
  v_wait_count int;
begin
  -- get array of display codes currently serving (status IN ('now_serving', 'in_chair'))
  select coalesce(jsonb_agg(display_code order by created_at asc), '[]'::jsonb)
  into v_serving
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('now_serving', 'in_chair')
    and cast(created_at at time zone 'Asia/Manila' as date) = cast(now() at time zone 'Asia/Manila' as date);

  -- get count of waiting patients
  select count(*)
  into v_wait_count
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('waiting', 'ready')
    and cast(created_at at time zone 'Asia/Manila' as date) = cast(now() at time zone 'Asia/Manila' as date);

  return jsonb_build_object(
    'serving', coalesce(v_serving, '[]'::jsonb),
    'waitCount', coalesce(v_wait_count, 0)
  );
end;
$$;


-- ===== 20260613280000_strict_kiosk_block.sql =====

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
  v_active_count int;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  -- Extract only digits, and take the last 10 digits
  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please check with the front desk.';
  end if;

  -- STRICT BLOCK: Check if patient is already in queue today
  select count(*) into v_active_count
  from public.queue_entries
  where branch_id = v_session.branch_id
    and patient_id = v_patient_id
    and status in ('waiting', 'ready', 'now_serving', 'in_chair')
    and cast(created_at at time zone 'Asia/Manila' as date) = cast(now() at time zone 'Asia/Manila' as date);

  if v_active_count > 0 then
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


-- ===== 20260613290000_portal_features.sql =====

-- 1. Drop existing constraint on branch_public_tokens and recreate with 'portal'
alter table public.branch_public_tokens drop constraint if exists branch_public_tokens_token_type_check;
alter table public.branch_public_tokens add constraint branch_public_tokens_token_type_check check (token_type in ('kiosk', 'display', 'portal'));

-- 2. Update generate_branch_public_token to accept 'portal'
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
  if p_token_type not in ('kiosk', 'display', 'portal') then
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

-- 3. Update create_kiosk_session to allow 'portal' tokens
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
    and token_type in ('kiosk', 'portal')
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid or expired link';
  end if;

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  insert into public.kiosk_sessions (organization_id, branch_id, token_id, expires_at)
  values (v_t.organization_id, v_t.branch_id, v_t.id, now() + interval '24 hours')
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'expires_at', (now() + interval '24 hours'),
    'token_type', v_t.token_type
  );
end;
$$;

-- 4. Create submit_portal_appointment for existing patients
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  -- Combine date and time into timestamp (assumes Asia/Manila, can be adjusted)
  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  -- Create appointment
  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, p_provider_id, v_scheduled_at, 30, 'Portal Booking', 'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;

-- Grant permissions
grant execute on function public.submit_portal_appointment(uuid, text, text, uuid, date, time) to anon, authenticated;


-- ===== 20260613300000_verify_portal_patient.sql =====

-- Verify existing patient before portal booking flow continues
create or replace function public.verify_portal_patient(
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
  v_phone_norm text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Online booking is only for registered patients. Please visit the clinic to register first.';
  end if;

  return jsonb_build_object('patient_id', v_patient_id);
end;
$$;

grant execute on function public.verify_portal_patient(uuid, text, text) to anon, authenticated;

-- Keep booking RPC message aligned with early verification
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Online booking is only for registered patients. Please visit the clinic to register first.';
  end if;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, p_provider_id, v_scheduled_at, 30, 'Portal Booking', 'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;


-- ===== 20260614080000_fix_portal_verify_org_wide.sql =====

-- Fix verify_portal_patient and submit_portal_appointment to check organization-wide instead of strict branch link constraint.
-- If the matching patient is found in the organization but not linked to the branch, automatically create the link.

create or replace function public.verify_portal_patient(
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
  v_phone_norm text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  -- Find patient within the organization (instead of strictly requiring branch link first)
  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Online booking is only for registered patients. Please visit the clinic to register first.';
  end if;

  -- Automatically link to the branch if they exist in the org but aren't linked yet
  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  return jsonb_build_object('patient_id', v_patient_id);
end;
$$;

create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  -- Ensure they are linked to this branch
  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, p_provider_id, v_scheduled_at, 30, 'Portal Booking', 'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;


-- ===== 20260614090000_financial_closeout_lock.sql =====

-- Migration: Lock invoices and payments on closed days (closeout locked)
-- Enforces strict accounting controls to prevent employees/users from modifying financial records after daily closeout.

create or replace function public.check_closeout_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_branch_id uuid;
  v_org_id uuid;
begin
  if TG_OP = 'DELETE' then
    if TG_TABLE_NAME = 'invoices' then
      v_date := old.created_at::date;
      v_branch_id := old.branch_id;
      v_org_id := old.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := old.created_at::date;
      v_org_id := old.organization_id;
      select branch_id into v_branch_id from public.invoices where id = old.invoice_id;
    end if;
  else
    if TG_TABLE_NAME = 'invoices' then
      v_date := new.created_at::date;
      v_branch_id := new.branch_id;
      v_org_id := new.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := new.created_at::date;
      v_org_id := new.organization_id;
      select branch_id into v_branch_id from public.invoices where id = new.invoice_id;
    end if;
  end if;

  if exists (
    select 1 from public.closeout_snapshots
    where organization_id = v_org_id
      and (branch_id is null or branch_id = v_branch_id)
      and snapshot_date = v_date
  ) then
    raise exception 'This calendar day has been closed out. Financial records for closed days cannot be modified or deleted.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Drop triggers if they exist to avoid duplicate issues on re-run
drop trigger if exists trg_invoices_closeout_lock on public.invoices;
drop trigger if exists trg_invoice_payments_closeout_lock on public.invoice_payments;

-- Attach triggers
create trigger trg_invoices_closeout_lock
  before update or delete on public.invoices
  for each row execute function public.check_closeout_lock();

create trigger trg_invoice_payments_closeout_lock
  before update or delete on public.invoice_payments
  for each row execute function public.check_closeout_lock();


-- ===== 20260614100000_portal_kiosk_source_notes.sql =====

-- Migration: Dynamically detect intake registration source and refine portal booking purpose
-- Enables bilingual clarity by using standard terminology for check-ins, bookings, and intakes.

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
  v_token_type text;
  v_source text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  if nullif(trim(p_payload->>'first_name'), '') is null
    or nullif(trim(p_payload->>'last_name'), '') is null then
    raise exception 'first_name and last_name are required';
  end if;

  -- Detect source based on token type
  select token_type into v_token_type 
  from public.branch_public_tokens 
  where id = v_session.token_id;

  if v_token_type = 'portal' then
    v_source := 'portal';
  else
    v_source := 'kiosk';
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'source', v_source,
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


-- Refine submit_portal_appointment purpose for dual-language clarity
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  -- Ensure they are linked to this branch
  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, 
    v_session.branch_id, 
    v_patient_id, 
    p_provider_id, 
    v_scheduled_at, 
    30, 
    'Portal Booking / Online Randevu', 
    'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;


-- ===== 20260614110000_portal_booking_purpose.sql =====

-- Drop old signature of submit_portal_appointment
drop function if exists public.submit_portal_appointment(uuid, text, text, uuid, date, time);

-- Create new signature with p_purpose parameter
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time,
  p_purpose text default 'Portal Booking / Online Randevu'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  -- Ensure they are linked to this branch
  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, 
    v_session.branch_id, 
    v_patient_id, 
    p_provider_id, 
    v_scheduled_at, 
    30, 
    coalesce(p_purpose, 'Portal Booking / Online Randevu'), 
    'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;

grant execute on function public.submit_portal_appointment(uuid, text, text, uuid, date, time, text) to anon, authenticated, service_role;


-- ===== 20260614120000_queue_priority_call_next.sql =====

-- Drop and recreate call_next_patient to prioritize scheduled appointments over walk-ins/others
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
  order by 
    case when appointment_id is not null then 0 else 1 end asc,
    checked_in_at asc
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

grant execute on function public.call_next_patient(uuid) to authenticated;

