-- Hard-block writes to not-wired workflow settings keys at the RPC boundary.
-- UI already rejects these; API/RPC clients must not flip them as "live".

create or replace function public.upsert_branch_workflow_settings(
  p_branch_id uuid,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_merged jsonb;
  v_result jsonb;
  v_blocked text[];
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Settings object is required';
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[])
  into v_blocked
  from jsonb_object_keys(p_settings) as k
  where k in ('require_deposit_on_book', 'no_show_fee_policy');

  if coalesce(array_length(v_blocked, 1), 0) > 0 then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, p_branch_id, auth.uid(),
      'workflow_settings.not_wired_rejected', 'branch', p_branch_id::text,
      jsonb_build_object('blocked_keys', to_jsonb(v_blocked))
    );

    raise exception
      'Workflow setting is not enforced yet and cannot be toggled as live: %',
      array_to_string(v_blocked, ', ');
  end if;

  select coalesce(bws.settings, public._default_workflow_settings()) || coalesce(p_settings, '{}'::jsonb)
  into v_merged
  from public.branches b
  left join public.branch_workflow_settings bws on bws.branch_id = b.id
  where b.id = p_branch_id
    and b.organization_id = v_org;

  if v_merged is null then
    raise exception 'Branch not found';
  end if;

  insert into public.branch_workflow_settings (branch_id, organization_id, settings, updated_at)
  values (p_branch_id, v_org, v_merged, now())
  on conflict (branch_id) do update
  set settings = excluded.settings,
      updated_at = now()
  returning settings into v_result;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, p_branch_id, auth.uid(),
    'workflow_settings.updated', 'branch', p_branch_id::text,
    jsonb_build_object('settings', v_result)
  );

  return v_result;
end;
$$;

revoke all on function public.upsert_branch_workflow_settings(uuid, jsonb) from public;
revoke all on function public.upsert_branch_workflow_settings(uuid, jsonb) from anon;
grant execute on function public.upsert_branch_workflow_settings(uuid, jsonb) to authenticated;

comment on function public.upsert_branch_workflow_settings(uuid, jsonb) is
  'Merges branch workflow settings; settings.manage; rejects not-wired keys require_deposit_on_book and no_show_fee_policy.';
