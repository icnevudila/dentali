-- Entity-scoped audit history for record detail panels

create or replace function public.get_unified_audit_trail(
  p_branch_id uuid default null,
  p_source text default 'all',
  p_limit int default 100,
  p_offset int default 0,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_action_contains text default null,
  p_actor_contains text default null,
  p_entity_type text default null,
  p_entity_id text default null
)
returns table (
  id uuid,
  source text,
  action text,
  entity_type text,
  entity_id text,
  branch_id uuid,
  profile_id uuid,
  actor_name text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_branch uuid := coalesce(
    p_branch_id,
    (select sba.branch_id from public.staff_branch_assignments sba where sba.profile_id = auth.uid() limit 1)
  );
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.user_is_org_admin()
    or public.has_permission('audit.read', v_branch)
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select *
  from (
    select
      oal.id,
      'organization'::text as source,
      oal.action,
      oal.entity_type,
      oal.entity_id,
      oal.branch_id,
      oal.profile_id,
      coalesce(pr.full_name, pr.email, 'Unknown') as actor_name,
      coalesce(oal.metadata, '{}'::jsonb) as metadata,
      null::text as ip_address,
      null::text as user_agent,
      oal.created_at
    from public.organization_audit_logs oal
    left join public.profiles pr on pr.id = oal.profile_id
    where oal.organization_id = v_org
      and (p_branch_id is null or oal.branch_id is null or oal.branch_id = p_branch_id)
      and p_source in ('all', 'organization')

    union all

    select
      sal.id,
      'session'::text as source,
      sal.event_type as action,
      'session'::text as entity_type,
      sal.event_type as entity_id,
      null::uuid as branch_id,
      sal.profile_id,
      coalesce(pr.full_name, pr.email, 'Unknown') as actor_name,
      '{}'::jsonb as metadata,
      sal.ip_address,
      sal.user_agent,
      sal.created_at
    from public.session_audit_logs sal
    left join public.profiles pr on pr.id = sal.profile_id
    where sal.organization_id = v_org
      and p_source in ('all', 'session')
  ) combined
  where (p_since is null or combined.created_at >= p_since)
    and (p_until is null or combined.created_at <= p_until)
    and (
      p_action_contains is null
      or btrim(p_action_contains) = ''
      or combined.action ilike '%' || btrim(p_action_contains) || '%'
    )
    and (
      p_actor_contains is null
      or btrim(p_actor_contains) = ''
      or combined.actor_name ilike '%' || btrim(p_actor_contains) || '%'
    )
    and (
      p_entity_type is null
      or btrim(p_entity_type) = ''
      or combined.entity_type ilike btrim(p_entity_type)
    )
    and (
      p_entity_id is null
      or btrim(p_entity_id) = ''
      or combined.entity_id = btrim(p_entity_id)
    )
  order by combined.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_unified_audit_trail(
  uuid, text, int, int, timestamptz, timestamptz, text, text, text, text
) to authenticated;
