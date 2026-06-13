-- Staff phone for owner digest SMS + get_org_staff enrichment

-- ---------------------------------------------------------------------------
-- get_org_staff: include phone + owner/admin flag
-- ---------------------------------------------------------------------------
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
    coalesce(bool_or(r.name in ('owner', 'admin')), false)
  from public.profiles p
  left join public.staff_profiles sp on sp.profile_id = p.id
  left join public.staff_branch_assignments sba on sba.profile_id = p.id
  left join public.roles r on r.id = sba.role_id
  left join public.branches b on b.id = sba.branch_id
  where p.organization_id = public.current_user_org_id()
  group by p.id, p.full_name, p.email, sp.is_active, sp.phone_number
  order by p.full_name;
$$;

grant execute on function public.get_org_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Branch owner digest readiness (workflow / notifications UI)
-- ---------------------------------------------------------------------------
create or replace function public.get_owner_digest_readiness(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_workflow_on boolean;
  v_owners int := 0;
  v_with_phone int := 0;
begin
  if p_branch_id is null then
    return jsonb_build_object('ready', false, 'reason', 'no_branch');
  end if;

  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  v_workflow_on := public._workflow_enabled(p_branch_id, 'auto_owner_digest_sms');

  select
    count(distinct p.id),
    count(distinct p.id) filter (where coalesce(length(trim(sp.phone_number)), 0) > 0)
  into v_owners, v_with_phone
  from public.profiles p
  join public.staff_profiles sp on sp.profile_id = p.id
  join public.staff_branch_assignments sba on sba.profile_id = p.id
  join public.roles r on r.id = sba.role_id
  where p.organization_id = v_org
    and sba.branch_id = p_branch_id
    and r.name in ('owner', 'admin')
    and coalesce(sp.is_active, true);

  return jsonb_build_object(
    'workflow_enabled', v_workflow_on,
    'owner_admin_count', v_owners,
    'with_phone_count', v_with_phone,
    'missing_phone_count', greatest(v_owners - v_with_phone, 0),
    'ready', not v_workflow_on or (v_owners > 0 and v_with_phone > 0)
  );
end;
$$;

grant execute on function public.get_owner_digest_readiness(uuid) to authenticated;
