-- Module 04: Effective settings RPC (org + branch overrides + clinic hours)

create or replace function public.get_effective_settings(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_branch record;
  v_org_settings record;
  v_org_timezone text;
  v_branch_overrides jsonb;
  v_hours jsonb;
begin
  select b.id, b.name, b.organization_id
  into v_branch
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_branch.id is null then
    raise exception 'Branch not found';
  end if;

  if not public.user_has_branch_access(p_branch_id)
    and not public.has_permission('settings.manage', p_branch_id) then
    if not public.has_permission('appointments.read', p_branch_id) then
      raise exception 'Permission denied';
    end if;
  end if;

  insert into public.organization_settings (organization_id)
  values (v_branch.organization_id)
  on conflict (organization_id) do nothing;

  perform public.ensure_branch_clinic_hours(p_branch_id);

  select o.timezone into v_org_timezone
  from public.organizations o
  where o.id = v_branch.organization_id;

  select os.default_timezone, os.currency_code
  into v_org_settings
  from public.organization_settings os
  where os.organization_id = v_branch.organization_id;

  select coalesce(jsonb_object_agg(bs.key, bs.value), '{}'::jsonb)
  into v_branch_overrides
  from public.branch_settings bs
  where bs.branch_id = p_branch_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'day_of_week', ch.day_of_week,
      'open_time', to_char(ch.open_time, 'HH24:MI'),
      'close_time', to_char(ch.close_time, 'HH24:MI'),
      'is_closed', ch.is_closed
    ) order by ch.day_of_week
  ), '[]'::jsonb)
  into v_hours
  from public.clinic_hours ch
  where ch.branch_id = p_branch_id;

  return jsonb_build_object(
    'branch_id', v_branch.id,
    'branch_name', v_branch.name,
    'organization_id', v_branch.organization_id,
    'timezone', coalesce(v_org_timezone, v_org_settings.default_timezone, 'Asia/Manila'),
    'currency_code', coalesce(v_org_settings.currency_code, 'PHP'),
    'branch_overrides', coalesce(v_branch_overrides, '{}'::jsonb),
    'clinic_hours', v_hours
  );
end;
$$;

grant execute on function public.get_effective_settings(uuid) to authenticated;
