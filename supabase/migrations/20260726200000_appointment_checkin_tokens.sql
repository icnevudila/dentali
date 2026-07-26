-- QR / link check-in tokens for appointments (public redeem → queue entry)

create table if not exists public.appointment_checkin_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists appointment_checkin_tokens_appt_idx
  on public.appointment_checkin_tokens (appointment_id, created_at desc);

create index if not exists appointment_checkin_tokens_token_idx
  on public.appointment_checkin_tokens (token)
  where used_at is null;

alter table public.appointment_checkin_tokens enable row level security;

drop policy if exists appointment_checkin_tokens_staff on public.appointment_checkin_tokens;
create policy appointment_checkin_tokens_staff on public.appointment_checkin_tokens
  for all to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create or replace function public.create_appointment_checkin_token(
  p_appointment_id uuid,
  p_ttl_hours int default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_token text;
  v_ttl int := greatest(coalesce(p_ttl_hours, 12), 1);
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id)
     and not public.has_permission('queue.manage', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_appt.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'Appointment is not eligible for check-in link';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.appointment_checkin_tokens (
    organization_id, branch_id, appointment_id, patient_id, token, expires_at, created_by
  ) values (
    v_appt.organization_id,
    v_appt.branch_id,
    v_appt.id,
    v_appt.patient_id,
    v_token,
    now() + make_interval(hours => v_ttl),
    auth.uid()
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', (now() + make_interval(hours => v_ttl)),
    'appointment_id', v_appt.id,
    'patient_id', v_appt.patient_id
  );
end;
$$;

grant execute on function public.create_appointment_checkin_token(uuid, int) to authenticated;

create or replace function public.get_appointment_checkin_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointment_checkin_tokens%rowtype;
  v_patient record;
  v_appt record;
  v_branch record;
begin
  select * into v_row
  from public.appointment_checkin_tokens
  where token = nullif(trim(p_token), '');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if v_row.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select first_name, last_name into v_patient
  from public.patients where id = v_row.patient_id;

  select scheduled_at, status into v_appt
  from public.appointments where id = v_row.appointment_id;

  select name into v_branch
  from public.branches where id = v_row.branch_id;

  return jsonb_build_object(
    'ok', true,
    'token', p_token,
    'branch_name', coalesce(v_branch.name, 'Clinic'),
    'patient_first_name', coalesce(v_patient.first_name, ''),
    'patient_last_name', coalesce(v_patient.last_name, ''),
    'scheduled_at', v_appt.scheduled_at,
    'appointment_status', v_appt.status,
    'expires_at', v_row.expires_at
  );
end;
$$;

grant execute on function public.get_appointment_checkin_by_token(text) to anon, authenticated;

create or replace function public.redeem_appointment_checkin_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointment_checkin_tokens%rowtype;
  v_code text;
  v_queue_id uuid;
begin
  select * into v_row
  from public.appointment_checkin_tokens
  where token = nullif(trim(p_token), '')
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if v_row.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_row.branch_id
      and patient_id = v_row.patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    update public.appointment_checkin_tokens
    set used_at = now()
    where id = v_row.id;

    return jsonb_build_object('ok', true, 'already_in_queue', true);
  end if;

  v_code := public._next_queue_display_code(v_row.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_row.organization_id, v_row.branch_id, v_row.patient_id, v_row.appointment_id,
    v_code, 'QR / link check-in', null
  )
  returning id into v_queue_id;

  update public.appointments
  set status = 'checked_in',
      updated_at = now()
  where id = v_row.appointment_id
    and status in ('scheduled', 'confirmed');

  update public.appointment_checkin_tokens
  set used_at = now()
  where id = v_row.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_row.organization_id,
    v_row.branch_id,
    null,
    'appointment.checkin_token_redeemed',
    'appointment',
    v_row.appointment_id::text,
    jsonb_build_object('queue_id', v_queue_id, 'display_code', v_code, 'via', 'qr_link')
  );

  return jsonb_build_object(
    'ok', true,
    'queue_id', v_queue_id,
    'display_code', v_code,
    'already_in_queue', false
  );
end;
$$;

grant execute on function public.redeem_appointment_checkin_token(text) to anon, authenticated;
