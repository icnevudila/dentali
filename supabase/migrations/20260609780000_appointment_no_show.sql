-- Module 13: Mark appointment no-show + day schedule summary

create or replace function public.mark_appointment_no_show(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  select a.*
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Only scheduled or confirmed appointments can be marked no-show';
  end if;

  update public.appointments
  set status = 'no_show',
      updated_at = now()
  where id = p_appointment_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id,
    v_appt.branch_id,
    auth.uid(),
    'appointment.no_show',
    'appointment',
    p_appointment_id,
    jsonb_build_object(
      'scheduled_at', v_appt.scheduled_at,
      'patient_id', v_appt.patient_id,
      'previous_status', v_appt.status
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'status', 'no_show',
    'scheduled_at', v_appt.scheduled_at,
    'branch_id', v_appt.branch_id
  );
end;
$$;

grant execute on function public.mark_appointment_no_show(uuid) to authenticated;

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
  v_no_show int;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
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
    count(*) filter (where a.status = 'cancelled')::int,
    count(*) filter (where a.status = 'no_show')::int
  into v_total, v_scheduled, v_completed, v_cancelled, v_no_show
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
      'cancelled', v_cancelled,
      'no_show', v_no_show
    ),
    'appointments', v_rows
  );
end;
$$;
