-- Module 13: Drag-reschedule validated update

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_scheduled_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_appt_date date;
  v_appt_time time;
  v_slot_taken boolean;
  v_old_at timestamptz;
begin
  if p_appointment_id is null or p_scheduled_at is null then
    raise exception 'appointment_id and scheduled_at are required';
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
    raise exception 'Only scheduled or confirmed appointments can be rescheduled';
  end if;

  if v_appt.provider_id is not null then
    v_appt_date := (p_scheduled_at at time zone 'Asia/Manila')::date;
    v_appt_time := (p_scheduled_at at time zone 'Asia/Manila')::time;

    perform public.ensure_provider_availability_defaults(v_appt.branch_id, v_appt.provider_id);

    if not exists (
      select 1 from public.provider_availability pa
      where pa.branch_id = v_appt.branch_id
        and pa.provider_id = v_appt.provider_id
        and pa.day_of_week = extract(dow from v_appt_date)::smallint
        and pa.is_available
        and v_appt_time >= pa.start_time
        and v_appt_time < pa.end_time
    ) then
      raise exception 'Provider is not available at this time';
    end if;

    select exists (
      select 1 from public.appointments a
      where a.branch_id = v_appt.branch_id
        and coalesce(a.provider_id, v_appt.provider_id) = v_appt.provider_id
        and a.scheduled_at = p_scheduled_at
        and a.id <> p_appointment_id
        and a.status not in ('cancelled', 'no_show')
    ) into v_slot_taken;

    if v_slot_taken then
      raise exception 'Time slot is already booked';
    end if;
  end if;

  v_old_at := v_appt.scheduled_at;

  update public.appointments
  set scheduled_at = p_scheduled_at,
      updated_at = now()
  where id = p_appointment_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id,
    v_appt.branch_id,
    auth.uid(),
    'appointment.rescheduled',
    'appointment',
    p_appointment_id,
    jsonb_build_object(
      'from', v_old_at,
      'to', p_scheduled_at,
      'patient_id', v_appt.patient_id
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'scheduled_at', p_scheduled_at,
    'status', v_appt.status
  );
end;
$$;

grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;
