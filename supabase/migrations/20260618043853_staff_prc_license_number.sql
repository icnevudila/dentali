alter table public.staff_profiles
  add column if not exists prc_license_number text;

comment on column public.staff_profiles.prc_license_number is
  'Professional Regulation Commission license number for dentists; used on prescriptions and clinical certificates.';

drop function if exists public.get_org_staff();

create or replace function public.get_org_staff()
returns table (
  profile_id uuid,
  full_name text,
  email text,
  is_active boolean,
  role_name text,
  branch_names text[],
  phone_number text,
  prc_license_number text,
  is_owner_or_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.email,
    coalesce(sp.is_active, true),
    coalesce(max(r.name), 'staff'),
    array_agg(distinct b.name order by b.name) filter (where b.name is not null),
    nullif(trim(sp.phone_number), ''),
    nullif(trim(sp.prc_license_number), ''),
    coalesce(bool_or(r.name in ('owner', 'admin')), false)
  from public.profiles p
  left join public.staff_profiles sp on sp.profile_id = p.id
  left join public.staff_branch_assignments sba on sba.profile_id = p.id
  left join public.roles r on r.id = sba.role_id
  left join public.branches b on b.id = sba.branch_id
  where p.organization_id = public.current_user_org_id()
  group by p.id, p.full_name, p.email, sp.is_active, sp.phone_number, sp.prc_license_number
  order by p.full_name;
$$;

grant execute on function public.get_org_staff() to authenticated;
