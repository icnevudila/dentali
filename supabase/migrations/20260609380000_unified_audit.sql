-- Module 24: Unified audit trail (organization + session)

-- Allow audit.read holders (not only org admins)
drop policy if exists org_audit_select on public.organization_audit_logs;
create policy org_audit_select on public.organization_audit_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or exists (
        select 1
        from public.staff_branch_assignments sba
        join public.role_permissions rp on rp.role_id = sba.role_id
        join public.permissions perm on perm.id = rp.permission_id
        where sba.profile_id = auth.uid()
          and perm.name = 'audit.read'
          and (
            organization_audit_logs.branch_id is null
            or sba.branch_id = organization_audit_logs.branch_id
          )
      )
    )
  );

drop policy if exists session_audit_select on public.session_audit_logs;
create policy session_audit_select on public.session_audit_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or exists (
        select 1
        from public.staff_branch_assignments sba
        join public.role_permissions rp on rp.role_id = sba.role_id
        join public.permissions perm on perm.id = rp.permission_id
        where sba.profile_id = auth.uid()
          and perm.name = 'audit.read'
      )
    )
  );

create or replace function public.get_unified_audit_trail(
  p_branch_id uuid default null,
  p_source text default 'all',
  p_limit int default 100,
  p_offset int default 0
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
  order by combined.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.get_unified_audit_trail(uuid, text, int, int) to authenticated;
