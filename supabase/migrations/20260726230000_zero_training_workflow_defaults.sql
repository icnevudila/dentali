-- Zero-training: seed branch_workflow_settings (defaults ON) on org/branch create + backfill.

create or replace function public.bootstrap_clinic(
  p_org_name text,
  p_branch_name text default 'Main Clinic'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  insert into public.branch_workflow_settings (branch_id, organization_id, settings)
  values (v_branch_id, v_org_id, public._default_workflow_settings())
  on conflict (branch_id) do nothing;

  return jsonb_build_object(
    'status', 'created',
    'organization_id', v_org_id,
    'branch_id', v_branch_id,
    'slug', v_slug
  );
end;
$function$;

create or replace function public.create_org_branch(
  p_name text,
  p_address text default null::text,
  p_contact_number text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  insert into public.branch_workflow_settings (branch_id, organization_id, settings)
  values (v_branch_id, v_org_id, public._default_workflow_settings())
  on conflict (branch_id) do nothing;

  -- Assign creator to the new branch (same role they hold on another branch, else admin)
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
$function$;

-- Backfill any existing branches missing an explicit settings row.
insert into public.branch_workflow_settings (branch_id, organization_id, settings)
select b.id, b.organization_id, public._default_workflow_settings()
from public.branches b
where not exists (
  select 1 from public.branch_workflow_settings s where s.branch_id = b.id
)
on conflict (branch_id) do nothing;
