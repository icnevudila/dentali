-- Staff action hardening.
-- Moves high-risk staff writes behind permission-checked RPCs to avoid raw RLS failures.

alter table public.staff_profiles
  add column if not exists prc_license_number text,
  add column if not exists updated_at timestamptz default now();

create or replace function public.add_staff_member_directly(
  p_email text,
  p_full_name text,
  p_branch_id uuid,
  p_role_id uuid,
  p_phone_number text default null,
  p_specialization text default null,
  p_prc_license_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_profile_id uuid := gen_random_uuid();
  v_branch_org uuid;
  v_role_name text;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if v_clean_email = '' or trim(coalesce(p_full_name, '')) = '' then
    raise exception 'Email and full name are required';
  end if;

  select organization_id into v_branch_org
  from public.branches
  where id = p_branch_id;

  select name into v_role_name
  from public.roles
  where id = p_role_id;

  if v_branch_org is distinct from v_org or v_role_name is null then
    raise exception 'Invalid branch or role';
  end if;

  if not (public.user_is_org_admin() or public.has_permission('staff.manage', p_branch_id)) then
    raise exception 'Permission denied';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.organization_id = v_org
      and lower(coalesce(p.email, '')) = v_clean_email
  ) then
    raise exception 'A staff profile with this email already exists';
  end if;

  insert into public.profiles (id, organization_id, email, full_name)
  values (v_profile_id, v_org, v_clean_email, trim(p_full_name));

  insert into public.staff_profiles (
    profile_id,
    is_active,
    phone_number,
    specialization,
    prc_license_number,
    updated_at
  ) values (
    v_profile_id,
    true,
    nullif(trim(coalesce(p_phone_number, '')), ''),
    nullif(trim(coalesce(p_specialization, '')), ''),
    nullif(trim(coalesce(p_prc_license_number, '')), ''),
    now()
  );

  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
  values (v_profile_id, p_branch_id, p_role_id);

  perform public.ensure_provider_availability_defaults(p_branch_id, v_profile_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    p_branch_id,
    auth.uid(),
    'staff.direct_create',
    'staff',
    v_profile_id::text,
    jsonb_build_object('email', v_clean_email, 'role_id', p_role_id, 'role_name', v_role_name)
  );

  return jsonb_build_object(
    'profile_id', v_profile_id,
    'email', v_clean_email,
    'role_name', v_role_name
  );
end;
$$;

create or replace function public.update_staff_profile_contact(
  p_profile_id uuid,
  p_phone_number text default null,
  p_specialization text default null,
  p_prc_license_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_target_org uuid;
  v_manage_branch uuid;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into v_target_org
  from public.profiles
  where id = p_profile_id;

  if v_target_org is distinct from v_org then
    raise exception 'Staff not found';
  end if;

  select sba.branch_id into v_manage_branch
  from public.staff_branch_assignments sba
  join public.branches b on b.id = sba.branch_id
  where sba.profile_id = p_profile_id
    and b.organization_id = v_org
    and public.has_permission('staff.manage', sba.branch_id)
  limit 1;

  if not (p_profile_id = auth.uid() or public.user_is_org_admin() or v_manage_branch is not null) then
    raise exception 'Permission denied';
  end if;

  insert into public.staff_profiles (
    profile_id,
    is_active,
    phone_number,
    specialization,
    prc_license_number,
    updated_at
  ) values (
    p_profile_id,
    true,
    nullif(trim(coalesce(p_phone_number, '')), ''),
    nullif(trim(coalesce(p_specialization, '')), ''),
    nullif(trim(coalesce(p_prc_license_number, '')), ''),
    now()
  )
  on conflict (profile_id) do update set
    phone_number = excluded.phone_number,
    specialization = excluded.specialization,
    prc_license_number = excluded.prc_license_number,
    updated_at = excluded.updated_at;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    v_manage_branch,
    auth.uid(),
    'staff.profile.update',
    'staff',
    p_profile_id::text,
    jsonb_build_object('fields', jsonb_build_array('phone_number', 'specialization', 'prc_license_number'))
  );

  return jsonb_build_object('profile_id', p_profile_id);
end;
$$;

create or replace function public.remove_staff_branch_assignment(
  p_profile_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_target_org uuid;
  v_branch_org uuid;
  v_deleted_role uuid;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into v_target_org
  from public.profiles
  where id = p_profile_id;

  select organization_id into v_branch_org
  from public.branches
  where id = p_branch_id;

  if v_target_org is distinct from v_org or v_branch_org is distinct from v_org then
    raise exception 'Invalid staff or branch';
  end if;

  if not (public.user_is_org_admin() or public.has_permission('staff.manage', p_branch_id)) then
    raise exception 'Permission denied';
  end if;

  if p_profile_id = auth.uid()
    and (select count(*) from public.staff_branch_assignments where profile_id = p_profile_id) <= 1
  then
    raise exception 'You cannot remove your only branch assignment';
  end if;

  delete from public.staff_branch_assignments
  where profile_id = p_profile_id
    and branch_id = p_branch_id
  returning role_id into v_deleted_role;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    p_branch_id,
    auth.uid(),
    'staff.assignment.remove',
    'staff',
    p_profile_id::text,
    jsonb_build_object('role_id', v_deleted_role)
  );

  return jsonb_build_object('profile_id', p_profile_id, 'branch_id', p_branch_id);
end;
$$;

create or replace function public.set_staff_active_status(
  p_profile_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_target_org uuid;
  v_manage_branch uuid;
  v_remaining_admins integer;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into v_target_org
  from public.profiles
  where id = p_profile_id;

  if v_target_org is distinct from v_org then
    raise exception 'Staff not found';
  end if;

  select sba.branch_id into v_manage_branch
  from public.staff_branch_assignments sba
  join public.branches b on b.id = sba.branch_id
  where sba.profile_id = p_profile_id
    and b.organization_id = v_org
    and public.has_permission('staff.manage', sba.branch_id)
  limit 1;

  if not (public.user_is_org_admin() or v_manage_branch is not null) then
    raise exception 'Permission denied';
  end if;

  if p_profile_id = auth.uid() and p_is_active = false then
    raise exception 'You cannot deactivate your own staff profile';
  end if;

  if p_is_active = false and exists (
    select 1
    from public.staff_branch_assignments sba
    join public.roles r on r.id = sba.role_id
    where sba.profile_id = p_profile_id
      and r.name in ('owner', 'admin')
  ) then
    select count(distinct sba.profile_id) into v_remaining_admins
    from public.staff_branch_assignments sba
    join public.roles r on r.id = sba.role_id
    join public.profiles p on p.id = sba.profile_id
    left join public.staff_profiles sp on sp.profile_id = sba.profile_id
    where p.organization_id = v_org
      and r.name in ('owner', 'admin')
      and coalesce(sp.is_active, true) = true
      and sba.profile_id <> p_profile_id;

    if coalesce(v_remaining_admins, 0) = 0 then
      raise exception 'You cannot deactivate the last active owner/admin';
    end if;
  end if;

  insert into public.staff_profiles (profile_id, is_active, updated_at)
  values (p_profile_id, p_is_active, now())
  on conflict (profile_id) do update set
    is_active = excluded.is_active,
    updated_at = excluded.updated_at;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    v_manage_branch,
    auth.uid(),
    case when p_is_active then 'staff.reactivate' else 'staff.deactivate' end,
    'staff',
    p_profile_id::text,
    jsonb_build_object('is_active', p_is_active)
  );

  return jsonb_build_object('profile_id', p_profile_id, 'is_active', p_is_active);
end;
$$;

revoke all on function public.add_staff_member_directly(text, text, uuid, uuid, text, text, text) from public;
revoke all on function public.update_staff_profile_contact(uuid, text, text, text) from public;
revoke all on function public.remove_staff_branch_assignment(uuid, uuid) from public;
revoke all on function public.set_staff_active_status(uuid, boolean) from public;

grant execute on function public.add_staff_member_directly(text, text, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.update_staff_profile_contact(uuid, text, text, text) to authenticated;
grant execute on function public.remove_staff_branch_assignment(uuid, uuid) to authenticated;
grant execute on function public.set_staff_active_status(uuid, boolean) to authenticated;
