-- Module 13: Validated appointment creation + check-in from appointment

create or replace function public.create_appointment_validated(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_provider_id uuid := nullif(p_payload->>'provider_id', '')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_scheduled_at timestamptz := (p_payload->>'scheduled_at')::timestamptz;
  v_purpose text := nullif(trim(p_payload->>'purpose'), '');
  v_duration integer := coalesce((p_payload->>'duration_minutes')::integer, 30);
  v_appt_date date;
  v_appt_time time;
  v_slot_taken boolean;
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null or v_org_id is null or v_scheduled_at is null then
    raise exception 'branch_id, patient_id, organization_id, and scheduled_at are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = v_patient_id and p.organization_id = v_org_id
  ) then
    raise exception 'Patient not found';
  end if;

  if v_provider_id is not null then
    v_appt_date := (v_scheduled_at at time zone 'Asia/Manila')::date;
    v_appt_time := (v_scheduled_at at time zone 'Asia/Manila')::time;

    perform public.ensure_provider_availability_defaults(v_branch_id, v_provider_id);

    if not exists (
      select 1 from public.provider_availability pa
      where pa.branch_id = v_branch_id
        and pa.provider_id = v_provider_id
        and pa.day_of_week = extract(dow from v_appt_date)::smallint
        and pa.is_available
        and v_appt_time >= pa.start_time
        and v_appt_time < pa.end_time
    ) then
      raise exception 'Provider is not available at this time';
    end if;

    select exists (
      select 1 from public.appointments a
      where a.branch_id = v_branch_id
        and coalesce(a.provider_id, v_provider_id) = v_provider_id
        and a.scheduled_at = v_scheduled_at
        and a.status not in ('cancelled', 'no_show')
    ) into v_slot_taken;

    if v_slot_taken then
      raise exception 'Time slot is already booked';
    end if;
  end if;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_provider_id,
    v_scheduled_at, v_duration, v_purpose, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'status', 'scheduled',
    'scheduled_at', v_scheduled_at
  );
end;
$$;

create or replace function public.check_in_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_code text;
  v_queue_id uuid;
begin
  select a.*
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment cannot be checked in';
  end if;

  if not public.has_permission('queue.manage', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if exists (
    select 1 from public.queue_entries qe
    where qe.branch_id = v_appt.branch_id
      and qe.patient_id = v_appt.patient_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  v_code := public._next_queue_display_code(v_appt.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_appt.organization_id, v_appt.branch_id, v_appt.patient_id, v_appt.id,
    v_code, coalesce(v_appt.purpose, 'Appointment check-in'), auth.uid()
  )
  returning id into v_queue_id;

  update public.appointments
  set status = 'confirmed', updated_at = now()
  where id = v_appt.id;

  return jsonb_build_object(
    'queue_id', v_queue_id,
    'display_code', v_code,
    'appointment_id', v_appt.id,
    'status', 'waiting'
  );
end;
$$;

grant execute on function public.create_appointment_validated(jsonb) to authenticated;
grant execute on function public.check_in_appointment(uuid) to authenticated;
