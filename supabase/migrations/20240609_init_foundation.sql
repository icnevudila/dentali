-- 20240609_init_foundation.sql – create foundation tables

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
