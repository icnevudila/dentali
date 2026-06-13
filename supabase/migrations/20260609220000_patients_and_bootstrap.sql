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
