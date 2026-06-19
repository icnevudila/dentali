-- Staff assignment writer RPC.
-- Avoids client-side RLS upsert failures while keeping branch/org checks in one place.

create or replace function public.upsert_staff_branch_assignment(
  p_profile_id uuid,
  p_branch_id uuid,
  p_role_id uuid
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
  v_role_name text;
  v_is_bootstrap_self boolean := false;
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

  select name into v_role_name
  from public.roles
  where id = p_role_id;

  if v_target_org is distinct from v_org or v_branch_org is distinct from v_org or v_role_name is null then
    raise exception 'Invalid staff, branch, or role';
  end if;

  v_is_bootstrap_self :=
    p_profile_id = auth.uid()
    and not exists (
      select 1
      from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid()
    );

  if not (
    public.user_is_org_admin()
    or public.has_permission('staff.manage', p_branch_id)
    or v_is_bootstrap_self
  ) then
    raise exception 'Permission denied';
  end if;

  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
  values (p_profile_id, p_branch_id, p_role_id)
  on conflict (profile_id, branch_id)
  do update set role_id = excluded.role_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    p_branch_id,
    auth.uid(),
    'staff.assignment.upsert',
    'staff',
    p_profile_id::text,
    jsonb_build_object('role_id', p_role_id, 'role_name', v_role_name)
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'branch_id', p_branch_id,
    'role_id', p_role_id,
    'role_name', v_role_name
  );
end;
$$;

grant execute on function public.upsert_staff_branch_assignment(uuid, uuid, uuid) to authenticated;
