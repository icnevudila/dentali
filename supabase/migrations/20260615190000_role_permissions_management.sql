-- Org admins can customize role ↔ permission mappings (except owner role).

create or replace function public.user_is_org_owner()
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
      and r.name = 'owner'
  );
$$;

create or replace function public.update_role_permissions(
  p_role_id uuid,
  p_permission_names text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.roles%rowtype;
  v_perm_id uuid;
  v_name text;
  v_added int := 0;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  select * into v_role from public.roles where id = p_role_id;
  if not found then
    raise exception 'Role not found';
  end if;

  if v_role.name = 'owner' then
    raise exception 'Owner role permissions cannot be changed';
  end if;

  if v_role.name = 'admin' and not public.user_is_org_owner() then
    raise exception 'Only the clinic owner can change administrator permissions';
  end if;

  if p_permission_names is null then
    p_permission_names := array[]::text[];
  end if;

  foreach v_name in array p_permission_names loop
    if not exists (select 1 from public.permissions p where p.name = v_name) then
      raise exception 'Unknown permission: %', v_name;
    end if;
  end loop;

  delete from public.role_permissions where role_id = p_role_id;

  foreach v_name in array p_permission_names loop
    select p.id into v_perm_id from public.permissions p where p.name = v_name;
    insert into public.role_permissions (role_id, permission_id)
    values (p_role_id, v_perm_id)
    on conflict do nothing;
    v_added := v_added + 1;
  end loop;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  )
  select
    public.current_user_org_id(),
    null,
    auth.uid(),
    'role.permissions_update',
    'role',
    p_role_id::text,
    jsonb_build_object(
      'role_name', v_role.name,
      'permission_count', v_added,
      'permissions', to_jsonb(p_permission_names)
    );

  return jsonb_build_object(
    'role_id', p_role_id,
    'role_name', v_role.name,
    'permission_count', v_added
  );
end;
$$;

grant execute on function public.update_role_permissions(uuid, text[]) to authenticated;
grant execute on function public.user_is_org_owner() to authenticated;
