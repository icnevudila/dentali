-- Allow Queue module to read day schedule arrivals.
create or replace function public.get_day_schedule(p_branch_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_total int;
  v_scheduled int;
  v_completed int;
  v_cancelled int;
begin
  if not (
    public.has_permission('appointments.read', p_branch_id)
    or public.has_permission('queue.manage', p_branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'scheduled_at', a.scheduled_at,
      'purpose', a.purpose,
      'status', a.status,
      'patient_id', a.patient_id,
      'patient_name', trim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, '')),
      'provider_id', a.provider_id,
      'provider_name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
      'duration_minutes', a.duration_minutes
    ) order by a.scheduled_at
  ), '[]'::jsonb)
  into v_rows
  from public.appointments a
  join public.patients pt on pt.id = a.patient_id
  left join public.profiles pr on pr.id = a.provider_id
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  select
    count(*)::int,
    count(*) filter (where a.status in ('scheduled', 'confirmed'))::int,
    count(*) filter (where a.status = 'completed')::int,
    count(*) filter (where a.status = 'cancelled')::int
  into v_total, v_scheduled, v_completed, v_cancelled
  from public.appointments a
  where a.branch_id = p_branch_id
    and a.organization_id = public.current_user_org_id()
    and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'date', p_date,
    'summary', jsonb_build_object(
      'total', v_total,
      'scheduled', v_scheduled,
      'completed', v_completed,
      'cancelled', v_cancelled
    ),
    'appointments', v_rows
  );
end;
$$;

grant execute on function public.get_day_schedule(uuid, date) to authenticated;
