-- VA-F4-24: active display count seen in last 7 days

create or replace function public.get_display_health_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_active_tokens int;
  v_active_displays_7d int;
  v_last_heartbeat timestamptz;
  v_last_queue_activity timestamptz;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select count(*)::int
  into v_active_tokens
  from public.branch_public_tokens t
  where t.organization_id = v_org
    and t.branch_id = p_branch_id
    and t.token_type = 'display'
    and t.is_active = true
    and (t.expires_at is null or t.expires_at > now());

  select count(*)::int
  into v_active_displays_7d
  from public.display_heartbeats dh
  where dh.organization_id = v_org
    and dh.branch_id = p_branch_id
    and dh.last_seen_at >= now() - interval '7 days';

  select max(dh.last_seen_at)
  into v_last_heartbeat
  from public.display_heartbeats dh
  where dh.organization_id = v_org
    and dh.branch_id = p_branch_id;

  select max(greatest(q.checked_in_at, q.called_at, q.served_at))
  into v_last_queue_activity
  from public.queue_entries q
  where q.organization_id = v_org
    and q.branch_id = p_branch_id
    and q.checked_in_at >= (current_date - interval '7 days');

  return jsonb_build_object(
    'active_display_tokens', coalesce(v_active_tokens, 0),
    'active_displays_7d', coalesce(v_active_displays_7d, 0),
    'has_active_link', coalesce(v_active_tokens, 0) > 0,
    'last_refresh_at', v_last_heartbeat,
    'minutes_since_refresh', case
      when v_last_heartbeat is null then null
      else round(extract(epoch from (now() - v_last_heartbeat)) / 60.0)::int
    end,
    'is_online', v_last_heartbeat is not null and v_last_heartbeat >= now() - interval '5 minutes',
    'last_queue_activity', v_last_queue_activity,
    'minutes_since_activity', case
      when v_last_queue_activity is null then null
      else round(extract(epoch from (now() - v_last_queue_activity)) / 60.0)::int
    end
  );
end;
$$;

grant execute on function public.get_display_health_analytics(uuid) to authenticated;
