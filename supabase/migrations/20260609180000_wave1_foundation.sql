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
