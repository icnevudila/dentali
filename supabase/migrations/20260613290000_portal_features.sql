-- 1. Drop existing constraint on branch_public_tokens and recreate with 'portal'
alter table public.branch_public_tokens drop constraint if exists branch_public_tokens_token_type_check;
alter table public.branch_public_tokens add constraint branch_public_tokens_token_type_check check (token_type in ('kiosk', 'display', 'portal'));

-- 2. Update generate_branch_public_token to accept 'portal'
create or replace function public.generate_branch_public_token(
  p_branch_id uuid,
  p_token_type text,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_token text;
  v_id uuid;
begin
  if p_token_type not in ('kiosk', 'display', 'portal') then
    raise exception 'Invalid token type';
  end if;

  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.branch_public_tokens (
    organization_id, branch_id, token_type, label, created_by
  ) values (
    v_org, p_branch_id, p_token_type, p_label, auth.uid()
  )
  returning id, token into v_id, v_token;

  return jsonb_build_object('id', v_id, 'token', v_token, 'token_type', p_token_type);
end;
$$;

-- 3. Update create_kiosk_session to allow 'portal' tokens
create or replace function public.create_kiosk_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_session_id uuid;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type in ('kiosk', 'portal')
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid or expired link';
  end if;

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  insert into public.kiosk_sessions (organization_id, branch_id, token_id, expires_at)
  values (v_t.organization_id, v_t.branch_id, v_t.id, now() + interval '24 hours')
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'expires_at', (now() + interval '24 hours'),
    'token_type', v_t.token_type
  );
end;
$$;

-- 4. Create submit_portal_appointment for existing patients
create or replace function public.submit_portal_appointment(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_provider_id uuid,
  p_date date,
  p_time time
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
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please use New Patient Registration.';
  end if;

  -- Combine date and time into timestamp (assumes Asia/Manila, can be adjusted)
  v_scheduled_at := (p_date || ' ' || p_time || ' +08')::timestamptz;

  -- Create appointment
  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id, scheduled_at, duration_minutes, purpose, status
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, p_provider_id, v_scheduled_at, 30, 'Portal Booking', 'scheduled'
  )
  returning id into v_appointment_id;

  return jsonb_build_object('appointment_id', v_appointment_id);
end;
$$;

-- Grant permissions
grant execute on function public.submit_portal_appointment(uuid, text, text, uuid, date, time) to anon, authenticated;
