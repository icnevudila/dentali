-- get_available_appointment_slots must stay read-only (STABLE).
-- ensure_provider_availability_defaults writes rows; call it from the client instead.

create or replace function public.get_available_appointment_slots(
  p_branch_id uuid,
  p_provider_id uuid,
  p_date date,
  p_exclude_appointment_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_dow smallint;
  v_avail record;
  v_clinic record;
  v_slots jsonb := '[]'::jsonb;
  v_cursor time;
  v_end time;
  v_slot_mins int;
  v_slot interval;
  v_ts timestamptz;
  v_taken boolean;
begin
  if p_branch_id is null or p_provider_id is null or p_date is null then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id;

  if v_org_id is null then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  v_dow := extract(dow from p_date)::smallint;

  select pa.start_time, pa.end_time, pa.slot_minutes, pa.is_available
  into v_avail
  from public.provider_availability pa
  where pa.branch_id = p_branch_id
    and pa.provider_id = p_provider_id
    and pa.day_of_week = v_dow
    and pa.organization_id = v_org_id;

  select ch.open_time, ch.close_time, ch.is_closed
  into v_clinic
  from public.clinic_hours ch
  where ch.branch_id = p_branch_id
    and ch.day_of_week = v_dow;

  if v_avail is null or not coalesce(v_avail.is_available, false) then
    if v_clinic is null or coalesce(v_clinic.is_closed, false) then
      return jsonb_build_object('date', p_date, 'slots', v_slots);
    end if;

    v_cursor := coalesce(v_clinic.open_time, '09:00'::time);
    v_end := coalesce(v_clinic.close_time, '17:00'::time);
    v_slot_mins := 30;
  else
    v_cursor := coalesce(v_avail.start_time, v_clinic.open_time, '09:00'::time);
    v_end := coalesce(v_avail.end_time, v_clinic.close_time, '17:00'::time);
    v_slot_mins := greatest(coalesce(v_avail.slot_minutes, 30), 15);
  end if;

  if v_cursor is null or v_end is null or v_cursor >= v_end then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  v_slot := make_interval(mins => v_slot_mins);

  while v_cursor < v_end loop
    v_ts := (p_date + v_cursor) at time zone 'Asia/Manila';
    select exists (
      select 1 from public.appointments a
      where a.branch_id = p_branch_id
        and coalesce(a.provider_id, p_provider_id) = p_provider_id
        and a.scheduled_at = v_ts
        and a.status not in ('cancelled', 'no_show')
        and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
    ) into v_taken;

    v_slots := v_slots || jsonb_build_array(jsonb_build_object(
      'time', to_char(v_cursor, 'HH24:MI'),
      'available', not v_taken
    ));

    v_cursor := v_cursor + v_slot;
  end loop;

  return jsonb_build_object(
    'date', p_date,
    'provider_id', p_provider_id,
    'slots', v_slots
  );
end;
$$;

grant execute on function public.get_available_appointment_slots(uuid, uuid, date, uuid) to authenticated, anon;
