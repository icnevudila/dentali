-- Branch deactivate with audit trail + admin branch listing

create or replace function public.get_org_branches_for_settings()
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
  select
    b.id,
    b.name,
    b.organization_id,
    b.address,
    b.contact_number,
    coalesce(b.is_active, true),
    'admin'::text
  from public.branches b
  where b.organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  order by b.is_active desc, b.name;
$$;

grant execute on function public.get_org_branches_for_settings() to authenticated;

create or replace function public.deactivate_branch(
  p_branch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch public.branches%rowtype;
  v_active_count int;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Deactivation reason is required (min 3 characters)';
  end if;

  select * into v_branch
  from public.branches
  where id = p_branch_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Branch not found';
  end if;

  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if coalesce(v_branch.is_active, true) = false then
    raise exception 'Branch is already inactive';
  end if;

  select count(*)::int into v_active_count
  from public.branches
  where organization_id = v_branch.organization_id
    and coalesce(is_active, true) = true
    and id <> p_branch_id;

  if v_active_count = 0 then
    raise exception 'Cannot deactivate the last active branch in the organization';
  end if;

  update public.branches
  set is_active = false, updated_at = now()
  where id = p_branch_id;

  update public.branch_public_tokens
  set is_active = false
  where branch_id = p_branch_id and is_active = true;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_branch.organization_id,
    p_branch_id,
    auth.uid(),
    'branch.deactivate',
    'branch',
    p_branch_id::text,
    jsonb_build_object('reason', trim(p_reason), 'branch_name', v_branch.name)
  );

  return jsonb_build_object(
    'status', 'deactivated',
    'branch_id', p_branch_id,
    'branch_name', v_branch.name
  );
end;
$$;

grant execute on function public.deactivate_branch(uuid, text) to authenticated;
