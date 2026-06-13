-- Wave 1: Auth, Roles & Permissions — seed + RPC helpers

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
-- has_permission — branch-scoped; owner/admin bypass
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
-- get_my_permissions(branch_id?) — returns permission keys for active branch
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
-- get_my_branch_ids — branch ids the user may access
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
-- get_my_branches — branch list with role for UI
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
-- get_branch_context — timezone / currency for active branch
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
-- owner + admin → all permissions
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
