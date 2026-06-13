-- HOTFIX: rpc:create_org_branch(text,text,text) MISSING
-- Supabase SQL Editor -> Run -> Settings -> API -> Reload schema

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
