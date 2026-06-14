-- Drop old signature of submit_portal_appointment
drop function if exists public.submit_portal_appointment(uuid, text, text, uuid, date, time);

-- Create new signature with p_purpose parameter
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time,
  p_purpose text default 'Portal Booking / Online Randevu'
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

  -- Ensure they are linked to this branch
  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient_id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, 
    v_session.branch_id, 
    v_patient_id, 
    p_provider_id, 
    v_scheduled_at, 
    30, 
    coalesce(p_purpose, 'Portal Booking / Online Randevu'), 
    'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;

grant execute on function public.submit_portal_appointment(uuid, text, text, uuid, date, time, text) to anon, authenticated, service_role;
