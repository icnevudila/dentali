-- booking_source on appointments, portal booking update, treatment plan item helpers

alter table public.appointments
  add column if not exists booking_source text not null default 'staff'
  check (booking_source in ('staff', 'portal', 'kiosk', 'phone', 'walk_in'));

comment on column public.appointments.booking_source is
  'How the appointment was booked: staff dashboard, patient portal, kiosk, phone, or walk-in.';

-- Backfill portal bookings from legacy bilingual purpose strings
update public.appointments
set booking_source = 'portal'
where booking_source = 'staff'
  and (
    purpose ilike '%portal%'
    or purpose ilike '%online randevu%'
  );

-- Portal appointment booking sets booking_source
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time,
  p_purpose text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_phone_norm text;
  v_scheduled_at timestamptz;
  v_purpose text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);

  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;
  v_purpose := nullif(trim(coalesce(p_purpose, '')), '');

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, status, booking_source
  ) values (
    v_session.organization_id,
    v_session.branch_id,
    v_patient_id,
    p_provider_id,
    v_scheduled_at,
    30,
    coalesce(v_purpose, 'Online booking'),
    'scheduled',
    'portal'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;

grant execute on function public.submit_portal_appointment(uuid, text, text, uuid, date, time, text) to anon, authenticated, service_role;
