-- VA-F4-05/06: schedule heatmap + cancel trend in appointments analytics

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
  v_cancel jsonb := '[]'::jsonb;
  v_heatmap jsonb := '[]'::jsonb;
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

    select count(*)::int into v_cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and a.status = 'cancelled'
      and (a.updated_at at time zone 'Asia/Manila')::date = d;

    v_cancel := v_cancel || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'dow', hm.dow,
    'hour', hm.hr,
    'value', hm.cnt
  ) order by hm.dow_ord, hm.hr), '[]'::jsonb)
  into v_heatmap
  from (
    select
      to_char(a.scheduled_at at time zone 'Asia/Manila', 'Dy') as dow,
      extract(isodow from (a.scheduled_at at time zone 'Asia/Manila')::date)::int as dow_ord,
      to_char(a.scheduled_at at time zone 'Asia/Manila', 'HH24') || ':00' as hr,
      count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
      and a.status not in ('cancelled', 'no_show')
    group by 1, 2, 3
  ) hm;

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
    'cancel_trend', v_cancel,
    'day_hour_heatmap', v_heatmap,
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
