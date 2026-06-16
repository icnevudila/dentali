-- Closeout snapshot: one row per org + branch + clinic day (re-save updates, no duplicates).
create or replace function public.save_closeout_snapshot(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_payload jsonb;
  v_id uuid;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  v_payload := public.get_daily_closeout(p_branch_id, p_date);

  select cs.id
  into v_id
  from public.closeout_snapshots cs
  where cs.organization_id = v_org
    and cs.snapshot_date = p_date
    and cs.branch_id is not distinct from p_branch_id
  limit 1;

  if v_id is not null then
    update public.closeout_snapshots
    set payload = v_payload,
        created_by = auth.uid(),
        created_at = now()
    where id = v_id;
    return v_id;
  end if;

  insert into public.closeout_snapshots (organization_id, branch_id, snapshot_date, payload, created_by)
  values (v_org, p_branch_id, p_date, v_payload, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
