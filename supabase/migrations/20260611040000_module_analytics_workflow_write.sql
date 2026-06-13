-- Module-specific analytics RPCs + workflow settings write

-- ---------------------------------------------------------------------------
-- Upsert branch workflow settings
-- ---------------------------------------------------------------------------
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
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
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

grant execute on function public.upsert_branch_workflow_settings(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Appointments analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_appointments_analytics(
  p_branch_id uuid,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_hourly jsonb := '[]'::jsonb;
  v_no_show jsonb := '[]'::jsonb;
  v_providers jsonb;
  d date;
  v_cnt int;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := v_end - (p_period_days - 1);

  select coalesce(jsonb_agg(jsonb_build_object('label', h.hr, 'value', h.cnt) order by h.hr), '[]'::jsonb)
  into v_hourly
  from (
    select to_char(a.scheduled_at at time zone 'Asia/Manila', 'HH24') || ':00' as hr,
           count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
      and a.status not in ('cancelled')
    group by 1
  ) h;

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and a.status = 'no_show'
      and (a.scheduled_at at time zone 'Asia/Manila')::date = d;

    v_no_show := v_no_show || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('label', coalesce(p.full_name, 'Unassigned'), 'value', pv.cnt) order by pv.cnt desc), '[]'::jsonb)
  into v_providers
  from (
    select coalesce(a.provider_id::text, 'none') as pid, count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
      and a.status not in ('cancelled', 'no_show')
    group by 1
  ) pv
  left join public.profiles p on p.id::text = pv.pid and pv.pid <> 'none';

  return jsonb_build_object(
    'hourly_load', v_hourly,
    'no_show_trend', v_no_show,
    'provider_utilization', v_providers,
    'occupancy_pct', (
      select round(
        100.0 * count(*) filter (where a.status in ('scheduled', 'confirmed', 'checked_in', 'completed'))
        / nullif(count(*), 0),
        1
      )
      from public.appointments a
      where a.organization_id = v_org
        and a.branch_id = p_branch_id
        and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
    )
  );
end;
$$;

grant execute on function public.get_appointments_analytics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Waitlist analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_waitlist_analytics(
  p_branch_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_funnel jsonb;
  v_conversion numeric;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', s.status, 'value', s.cnt) order by
    case s.status
      when 'waiting' then 1
      when 'contacted' then 2
      when 'booked' then 3
      when 'cancelled' then 4
      when 'expired' then 5
      else 6
    end), '[]'::jsonb)
  into v_funnel
  from (
    select status, count(*)::int as cnt
    from public.waitlist_entries
    where organization_id = v_org
      and branch_id = p_branch_id
      and created_at >= now() - (greatest(coalesce(p_period_days, 30), 1) || ' days')::interval
    group by status
  ) s;

  select round(
    100.0 * count(*) filter (where status = 'booked')
    / nullif(count(*) filter (where status in ('waiting', 'contacted', 'booked')), 0),
    1
  )
  into v_conversion
  from public.waitlist_entries
  where organization_id = v_org
    and branch_id = p_branch_id
    and created_at >= now() - (greatest(coalesce(p_period_days, 30), 1) || ' days')::interval;

  return jsonb_build_object(
    'status_funnel', v_funnel,
    'conversion_pct', coalesce(v_conversion, 0),
    'active_waiting', (
      select count(*)::int from public.waitlist_entries
      where organization_id = v_org and branch_id = p_branch_id and status = 'waiting'
    )
  );
end;
$$;

grant execute on function public.get_waitlist_analytics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Patients analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_patients_analytics(
  p_branch_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_new_patients jsonb := '[]'::jsonb;
  v_consent_rate numeric;
  d date;
  v_cnt int;
begin
  if not public.has_permission('patients.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 30), 90), 1);
  v_start := v_end - (p_period_days - 1);

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.patients p
    inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
    where p.organization_id = v_org
      and p.created_at::date = d;

    v_new_patients := v_new_patients || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select round(
    100.0 * count(*) filter (where pc.status = 'signed')
    / nullif(count(*), 0),
    1
  )
  into v_consent_rate
  from public.patient_consents pc
  inner join public.patient_branch_links pbl on pbl.patient_id = pc.patient_id and pbl.branch_id = p_branch_id
  where pc.organization_id = v_org;

  return jsonb_build_object(
    'new_patients_trend', v_new_patients,
    'consent_completion_pct', coalesce(v_consent_rate, 0),
    'total_active', (
      select count(*)::int
      from public.patients p
      inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
      where p.organization_id = v_org and p.status = 'active'
    )
  );
end;
$$;

grant execute on function public.get_patients_analytics(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Inventory analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_inventory_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_levels jsonb;
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('label', lvl.label, 'value', lvl.cnt)), '[]'::jsonb)
  into v_levels
  from (
    select
      case
        when i.expiry_date is not null and i.expiry_date < current_date then 'Expired'
        when i.quantity_on_hand <= 0 then 'Out of stock'
        when i.quantity_on_hand <= i.min_stock_level then 'Low'
        when i.expiry_date is not null and i.expiry_date <= current_date + 30 then 'Expiring soon'
        else 'OK'
      end as label,
      count(*)::int as cnt
    from public.inventory_items i
    where i.organization_id = v_org
      and i.branch_id = p_branch_id
      and i.is_active = true
    group by 1
  ) lvl;

  return jsonb_build_object(
    'stock_levels', v_levels,
    'low_stock_count', (
      select count(*)::int
      from public.inventory_items i
      where i.organization_id = v_org
        and i.branch_id = p_branch_id
        and i.is_active = true
        and i.quantity_on_hand <= i.min_stock_level
    ),
    'total_skus', (
      select count(*)::int
      from public.inventory_items i
      where i.organization_id = v_org and i.branch_id = p_branch_id and i.is_active = true
    )
  );
end;
$$;

grant execute on function public.get_inventory_analytics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_audit_analytics(
  p_branch_id uuid default null,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_daily jsonb := '[]'::jsonb;
  v_top_actions jsonb;
  d date;
  v_cnt int;
begin
  if not public.has_permission('audit.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := v_end - (p_period_days - 1);

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.organization_audit_logs oal
    where oal.organization_id = v_org
      and (p_branch_id is null or oal.branch_id = p_branch_id)
      and oal.created_at::date = d;

    v_daily := v_daily || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('label', a.action, 'value', a.cnt) order by a.cnt desc), '[]'::jsonb)
  into v_top_actions
  from (
    select action, count(*)::int as cnt
    from public.organization_audit_logs oal
    where oal.organization_id = v_org
      and (p_branch_id is null or oal.branch_id = p_branch_id)
      and oal.created_at::date between v_start and v_end
    group by action
    order by cnt desc
    limit 8
  ) a;

  return jsonb_build_object(
    'daily_events', v_daily,
    'top_actions', v_top_actions,
    'total_events', (
      select count(*)::int
      from public.organization_audit_logs oal
      where oal.organization_id = v_org
        and (p_branch_id is null or oal.branch_id = p_branch_id)
        and oal.created_at::date between v_start and v_end
    )
  );
end;
$$;

grant execute on function public.get_audit_analytics(uuid, int) to authenticated;
