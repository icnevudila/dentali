-- Queue display codes must be unique per branch and clinic day.
-- The old count(*) + 1 generator could duplicate under concurrent check-ins.

alter table public.queue_entries
  add column if not exists queue_day date;

update public.queue_entries
set queue_day = (checked_in_at at time zone 'Asia/Manila')::date
where queue_day is null;

alter table public.queue_entries
  alter column queue_day set default ((now() at time zone 'Asia/Manila')::date),
  alter column queue_day set not null;

create or replace function public.set_queue_entry_day()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.queue_day := coalesce(new.queue_day, (new.checked_in_at at time zone 'Asia/Manila')::date);
  return new;
end;
$$;

drop trigger if exists trg_set_queue_entry_day on public.queue_entries;
create trigger trg_set_queue_entry_day
before insert or update of checked_in_at, queue_day on public.queue_entries
for each row execute function public.set_queue_entry_day();

with ordered as (
  select
    id,
    branch_id,
    queue_day,
    case
      when appointment_id is not null then 'A'
      when coalesce(notes, '') ilike '%kiosk%' then 'K'
      else 'W'
    end as prefix,
    row_number() over (
      partition by branch_id, queue_day
      order by checked_in_at, created_at, id
    ) as seq
  from public.queue_entries
),
renumbered as (
  select
    id,
    prefix || lpad(seq::text, 3, '0') as new_display_code
  from ordered
)
update public.queue_entries qe
set display_code = r.new_display_code
from renumbered r
where qe.id = r.id
  and qe.display_code is distinct from r.new_display_code;

create unique index if not exists idx_queue_entries_branch_day_display_code
  on public.queue_entries(branch_id, queue_day, display_code);

create or replace function public._queue_display_prefix(
  p_appointment_id uuid default null,
  p_source text default null
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_source text := lower(coalesce(p_source, ''));
begin
  if v_source = 'kiosk' then
    return 'K';
  end if;

  if p_appointment_id is not null or v_source = 'appointment' then
    return 'A';
  end if;

  return 'W';
end;
$$;

create or replace function public._next_queue_display_code(
  p_branch_id uuid,
  p_prefix text default 'Q'
)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_prefix text := upper(left(regexp_replace(coalesce(nullif(p_prefix, ''), 'Q'), '[^A-Za-z0-9]', '', 'g'), 2));
  v_next integer;
begin
  if p_branch_id is null then
    raise exception 'branch_id is required';
  end if;

  if v_prefix = '' then
    v_prefix := 'Q';
  end if;

  perform pg_advisory_xact_lock(hashtext('queue-display-code:' || p_branch_id::text || ':' || v_day::text));

  select coalesce(
    max(nullif(regexp_replace(display_code, '^[^0-9]*', ''), '')::integer),
    0
  ) + 1
  into v_next
  from public.queue_entries
  where branch_id = p_branch_id
    and queue_day = v_day;

  return v_prefix || lpad(v_next::text, 3, '0');
end;
$$;

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

  v_source := case when v_appointment_id is not null then 'appointment' else 'walk_in' end;
  v_code := public._next_queue_display_code(
    v_branch_id,
    public._queue_display_prefix(v_appointment_id, v_source)
  );

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

grant execute on function public._queue_display_prefix(uuid, text) to authenticated;
grant execute on function public._next_queue_display_code(uuid, text) to authenticated;
grant execute on function public.check_in_patient(jsonb) to authenticated;
