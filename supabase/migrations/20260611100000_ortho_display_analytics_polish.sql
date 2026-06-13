-- Ortho adjustment timeline + TV display token metrics (VA-F4-14, VA-F4-24)

create or replace function public.get_ortho_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'active_cases', (
      select count(*)::int from public.ortho_cases
      where organization_id = v_org and branch_id = p_branch_id and status = 'active'
    ),
    'balance_distribution', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.bucket, 'value', b.cnt)), '[]'::jsonb)
      from (
        select
          case
            when (public.calculate_ortho_balance(oc.id)->>'balance_due')::numeric <= 0 then 'Paid up'
            when (public.calculate_ortho_balance(oc.id)->>'balance_due')::numeric <= 5000 then 'Under ₱5k'
            else 'Over ₱5k'
          end as bucket,
          count(*)::int as cnt
        from public.ortho_cases oc
        where oc.organization_id = v_org and oc.branch_id = p_branch_id and oc.status = 'active'
        group by 1
      ) b
    ),
    'adjustment_timeline', (
      select coalesce(jsonb_agg(jsonb_build_object('label', d.label, 'value', d.cnt) order by d.sort_key), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('week', oa.adjustment_date), 'Mon DD') as label,
          date_trunc('week', oa.adjustment_date) as sort_key,
          count(*)::int as cnt
        from public.ortho_adjustments oa
        join public.ortho_cases oc on oc.id = oa.case_id
        where oc.organization_id = v_org
          and oc.branch_id = p_branch_id
          and oa.adjustment_date >= (current_date - interval '84 days')
        group by 1, 2
        order by 2
      ) d
    )
  );
end;
$$;

grant execute on function public.get_ortho_analytics(uuid) to authenticated;

create or replace function public.get_display_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('queue.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'active_display_tokens', (
      select count(*)::int
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = 'display'
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
    ),
    'active_kiosk_tokens', (
      select count(*)::int
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = 'kiosk'
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
    ),
    'last_kiosk_session_at', (
      select max(ks.created_at)
      from public.kiosk_sessions ks
      where ks.organization_id = v_org and ks.branch_id = p_branch_id
    ),
    'display_tokens_created_7d', (
      select count(*)::int
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = 'display'
        and t.created_at >= now() - interval '7 days'
    )
  );
end;
$$;

grant execute on function public.get_display_analytics(uuid) to authenticated;
