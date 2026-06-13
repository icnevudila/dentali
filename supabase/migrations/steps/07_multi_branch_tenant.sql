-- ADIM 7: Multi-branch tenant (her kiralanan klinik = ayri organization)
-- Multi-branch tenant model: org isolation + secure branch creation
-- (Adim 1 / wave1 atlandiysa asagidaki ONKOSUL blogu eksik RPC/tablolari ekler)

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
create policy branch_insert on public.branches
  for insert with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

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

-- ---------------------------------------------------------------------------
-- Create branch (admin RPC): hours seed + staff assignment
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
