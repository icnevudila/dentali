-- Fix Kiosk checkin phone match for Philippine phone prefixes (09 vs 639)
create or replace function public.submit_kiosk_checkin(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_code text;
  v_entry_id uuid;
  v_phone_norm text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  -- Extract only digits, and take the last 10 digits
  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please check with the front desk.';
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_session.branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'You are already checked in. Please wait to be called.';
  end if;

  v_code := public._next_queue_display_code(v_session.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, display_code, notes
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, v_code, 'Kiosk check-in'
  )
  returning id into v_entry_id;

  return jsonb_build_object('entry_id', v_entry_id, 'display_code', v_code);
end;
$$;
