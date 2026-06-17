-- A-Z clinic flow hardening:
-- 1) Repair and prevent duplicate daily queue display codes.
-- 2) Make staff/kiosk check-in write encounter_id back to queue_entries.
-- 3) Keep all changes idempotent and safe to re-run.

alter table public.queue_entries
  add column if not exists queue_day date;

create or replace function public.set_queue_entry_day()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.queue_day := (coalesce(new.checked_in_at, now()) at time zone 'Asia/Manila')::date;
  return new;
end;
$$;

drop trigger if exists trg_set_queue_entry_day on public.queue_entries;
create trigger trg_set_queue_entry_day
before insert or update of checked_in_at, queue_day on public.queue_entries
for each row execute function public.set_queue_entry_day();

update public.queue_entries
set queue_day = (coalesce(checked_in_at, created_at, now()) at time zone 'Asia/Manila')::date
where queue_day is null;

with ranked as (
  select
    id,
    branch_id,
    queue_day,
    row_number() over (
      partition by branch_id, queue_day
      order by coalesce(checked_in_at, created_at), id
    ) as rn
  from public.queue_entries
  where queue_day is not null
)
update public.queue_entries qe
set display_code = 'Q' || lpad(ranked.rn::text, 3, '0')
from ranked
where ranked.id = qe.id;

create unique index if not exists idx_queue_entries_branch_day_display_code
  on public.queue_entries(branch_id, queue_day, display_code)
  where queue_day is not null;

create or replace function public._next_queue_display_code(p_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_lock_key bigint;
  v_num int;
begin
  if p_branch_id is null then
    raise exception 'branch_id is required';
  end if;

  -- Serialize per branch/day so parallel front-desk/kiosk check-ins cannot both get Q001.
  v_lock_key := hashtextextended(p_branch_id::text || ':' || v_day::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select coalesce(max(nullif(regexp_replace(display_code, '\D', '', 'g'), '')::int), 0) + 1
  into v_num
  from public.queue_entries
  where branch_id = p_branch_id
    and queue_day = v_day;

  return 'Q' || lpad(v_num::text, 3, '0');
end;
$$;

grant execute on function public._next_queue_display_code(uuid) to authenticated, anon;

create or replace function public.repair_queue_display_codes(
  p_branch_id uuid default null,
  p_day date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_changed int := 0;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  update public.queue_entries
  set queue_day = (coalesce(checked_in_at, created_at, now()) at time zone 'Asia/Manila')::date
  where organization_id = v_org
    and (p_branch_id is null or branch_id = p_branch_id)
    and (p_day is null or (coalesce(checked_in_at, created_at, now()) at time zone 'Asia/Manila')::date = p_day);

  with ranked as (
    select
      id,
      'Q' || lpad(row_number() over (
        partition by branch_id, queue_day
        order by coalesce(checked_in_at, created_at), id
      )::text, 3, '0') as next_code
    from public.queue_entries
    where organization_id = v_org
      and (p_branch_id is null or branch_id = p_branch_id)
      and (p_day is null or queue_day = p_day)
  ),
  updated as (
    update public.queue_entries qe
    set display_code = ranked.next_code
    from ranked
    where ranked.id = qe.id
      and qe.display_code is distinct from ranked.next_code
    returning qe.id
  )
  select count(*) into v_changed from updated;

  return jsonb_build_object('changed', v_changed, 'branch_id', p_branch_id, 'queue_day', p_day);
end;
$$;

revoke all on function public.repair_queue_display_codes(uuid, date) from public;
grant execute on function public.repair_queue_display_codes(uuid, date) to authenticated;

create or replace function public.check_in_patient(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_appointment_id uuid := nullif(p_payload->>'appointment_id', '')::uuid;
  v_notes text := nullif(p_payload->>'notes', '');
  v_force boolean := coalesce((p_payload->>'force_checkin')::boolean, false);
  v_force_billing boolean := coalesce((p_payload->>'force_billing_override')::boolean, false);
  v_reuse_encounter_id uuid := nullif(p_payload->>'reuse_encounter_id', '')::uuid;
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
  v_encounter_id uuid;
  v_pending_intake int;
  v_source text;
  v_reuse_enc public.patient_encounters%rowtype;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if not public._user_can_check_in(v_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(
    v_patient_id, v_branch_id, v_force_billing, 'check_in'
  );

  if public._workflow_enabled(v_branch_id, 'consent_gate_checkin') and not v_force then
    v_pending_intake := public._pending_intake_consent_count(v_patient_id, v_org);

    if v_pending_intake > 0 then
      raise exception
        'Intake consents (data privacy and general treatment) must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if v_force and public._workflow_enabled(v_branch_id, 'consent_gate_checkin') then
    v_pending_intake := public._pending_intake_consent_count(v_patient_id, v_org);
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_patient_id::text,
      jsonb_build_object('pending_intake_consents', v_pending_intake)
    );
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  if v_appointment_id is null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    select a.id into v_appointment_id
    from public.appointments a
    where a.branch_id = v_branch_id
      and a.patient_id = v_patient_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status in ('scheduled', 'confirmed')
    order by a.scheduled_at
    limit 1;
  end if;

  v_code := public._next_queue_display_code(v_branch_id);
  v_source := case when v_appointment_id is not null then 'appointment' else 'walk_in' end;

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_org, v_branch_id, v_patient_id, v_appointment_id,
    v_code, v_notes, auth.uid()
  )
  returning id into v_id;

  if v_reuse_encounter_id is not null then
    select * into v_reuse_enc
    from public.patient_encounters pe
    where pe.id = v_reuse_encounter_id
      and pe.patient_id = v_patient_id
      and pe.branch_id = v_branch_id
      and pe.organization_id = v_org
      and pe.status = 'open';

    if v_reuse_enc.id is null then
      raise exception 'Open encounter not found for reuse';
    end if;

    v_encounter_id := v_reuse_enc.id;

    update public.queue_entries
    set encounter_id = v_encounter_id, updated_at = now()
    where id = v_id;

    if v_appointment_id is not null then
      update public.patient_encounters
      set appointment_id = coalesce(appointment_id, v_appointment_id),
          queue_entry_id = coalesce(queue_entry_id, v_id),
          updated_at = now()
      where id = v_encounter_id;
    end if;

    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'encounter.reused_on_checkin', 'patient_encounter', v_encounter_id::text,
      jsonb_build_object('patient_id', v_patient_id, 'queue_entry_id', v_id)
    );
  else
    v_encounter_id := public._open_patient_encounter(
      v_org, v_branch_id, v_patient_id, v_appointment_id, v_id, v_source, v_code
    );

    update public.queue_entries
    set encounter_id = v_encounter_id, updated_at = now()
    where id = v_id
      and encounter_id is distinct from v_encounter_id;
  end if;

  if v_appointment_id is not null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_branch_id, 'patient.checked_in', 'queue_entry', v_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'appointment_id', v_appointment_id,
      'display_code', v_code,
      'encounter_id', v_encounter_id,
      'reused_encounter', v_reuse_encounter_id is not null
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'appointment_id', v_appointment_id,
    'encounter_id', v_encounter_id,
    'status', 'waiting',
    'reused_encounter', v_reuse_encounter_id is not null
  );
end;
$$;

grant execute on function public.check_in_patient(jsonb) to authenticated;

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
  v_encounter_id uuid;
  v_phone_norm text;
  v_active_count int;
  v_pending_intake int;
  v_appointment_id uuid;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
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
    raise exception 'We could not find your record. Please check with the front desk.';
  end if;

  if public._workflow_enabled(v_session.branch_id, 'consent_gate_checkin') then
    v_pending_intake := public._pending_intake_consent_count(v_patient_id, v_session.organization_id);
    if v_pending_intake > 0 then
      raise exception 'Please see the front desk to sign intake forms before check-in.';
    end if;
  end if;

  if public._workflow_enabled(v_session.branch_id, 'billing_gate_block_services') then
    perform public._assert_patient_billing_clear(
      v_patient_id,
      v_session.branch_id,
      false,
      'kiosk_check_in'
    );
  end if;

  select count(*) into v_active_count
  from public.queue_entries
  where branch_id = v_session.branch_id
    and patient_id = v_patient_id
    and status in ('waiting', 'ready', 'now_serving', 'in_chair')
    and queue_day = (now() at time zone 'Asia/Manila')::date;

  if v_active_count > 0 then
    raise exception 'You are already checked in. Please wait to be called.';
  end if;

  if public._workflow_enabled(v_session.branch_id, 'auto_checkin_updates_appointment') then
    select a.id into v_appointment_id
    from public.appointments a
    where a.branch_id = v_session.branch_id
      and a.patient_id = v_patient_id
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status in ('scheduled', 'confirmed')
    order by a.scheduled_at
    limit 1;
  end if;

  v_code := public._next_queue_display_code(v_session.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id, display_code, notes
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, v_appointment_id, v_code, 'Kiosk check-in'
  )
  returning id into v_entry_id;

  if v_appointment_id is not null then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  v_encounter_id := public._open_patient_encounter(
    v_session.organization_id,
    v_session.branch_id,
    v_patient_id,
    v_appointment_id,
    v_entry_id,
    case when v_appointment_id is not null then 'appointment' else 'walk_in' end,
    v_code
  );

  update public.queue_entries
  set encounter_id = v_encounter_id, updated_at = now()
  where id = v_entry_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_session.organization_id, v_session.branch_id, null,
    'queue.kiosk_check_in', 'queue_entry', v_entry_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'display_code', v_code, 'encounter_id', v_encounter_id)
  );

  perform public.emit_workflow_event(
    v_session.branch_id, 'patient.checked_in', 'queue_entry', v_entry_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'display_code', v_code, 'encounter_id', v_encounter_id, 'source', 'kiosk')
  );

  return jsonb_build_object('entry_id', v_entry_id, 'display_code', v_code, 'encounter_id', v_encounter_id);
end;
$$;

grant execute on function public.submit_kiosk_checkin(uuid, text, text) to anon, authenticated;
