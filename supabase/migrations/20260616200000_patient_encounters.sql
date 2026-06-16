-- Patient encounters: one record per clinic arrival (check-in), scoped journey & billing

create table if not exists public.patient_encounters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  source_type text not null check (source_type in ('appointment', 'walk_in')),
  appointment_id uuid references public.appointments(id) on delete set null,
  queue_entry_id uuid references public.queue_entries(id) on delete set null,
  display_code text,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_encounters_patient
  on public.patient_encounters(patient_id, opened_at desc);

create index if not exists idx_patient_encounters_branch_open
  on public.patient_encounters(branch_id, status, opened_at desc)
  where status = 'open';

alter table public.patient_encounters enable row level security;

create policy patient_encounters_select on public.patient_encounters
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy patient_encounters_insert on public.patient_encounters
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

create policy patient_encounters_update on public.patient_encounters
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('queue.manage', branch_id)
      or public.has_permission('dental_chart.write', branch_id)
    )
  );

-- Link artifacts to encounters
alter table public.queue_entries
  add column if not exists encounter_id uuid references public.patient_encounters(id) on delete set null;

alter table public.clinical_notes
  add column if not exists encounter_id uuid references public.patient_encounters(id) on delete set null;

alter table public.treatment_plans
  add column if not exists encounter_id uuid references public.patient_encounters(id) on delete set null;

alter table public.invoices
  add column if not exists encounter_id uuid references public.patient_encounters(id) on delete set null;

create index if not exists idx_queue_entries_encounter on public.queue_entries(encounter_id);
create index if not exists idx_clinical_notes_encounter on public.clinical_notes(encounter_id);
create index if not exists idx_treatment_plans_encounter on public.treatment_plans(encounter_id);
create index if not exists idx_invoices_encounter on public.invoices(encounter_id);

-- ---------------------------------------------------------------------------
-- Open encounter on check-in (internal)
-- ---------------------------------------------------------------------------
create or replace function public._open_patient_encounter(
  p_org uuid,
  p_branch uuid,
  p_patient uuid,
  p_appointment_id uuid,
  p_queue_entry_id uuid,
  p_source_type text,
  p_display_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  v_code := coalesce(
    p_display_code,
    'VIS-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  insert into public.patient_encounters (
    organization_id, branch_id, patient_id, source_type,
    appointment_id, queue_entry_id, display_code, created_by
  ) values (
    p_org, p_branch, p_patient, p_source_type,
    p_appointment_id, p_queue_entry_id, v_code, auth.uid()
  )
  returning id into v_id;

  if p_queue_entry_id is not null then
    update public.queue_entries
    set encounter_id = v_id, updated_at = now()
    where id = p_queue_entry_id;
  end if;

  perform public.emit_workflow_event(
    p_branch, 'encounter.opened', 'patient_encounter', v_id::text,
    jsonb_build_object(
      'patient_id', p_patient,
      'appointment_id', p_appointment_id,
      'queue_entry_id', p_queue_entry_id,
      'display_code', v_code
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Close encounter ("Muayene bitir")
-- ---------------------------------------------------------------------------
create or replace function public.close_patient_encounter(p_encounter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
begin
  select * into v_enc from public.patient_encounters where id = p_encounter_id;

  if v_enc.id is null then
    raise exception 'Encounter not found';
  end if;

  if v_enc.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_has_branch_access(v_enc.branch_id) then
    raise exception 'Branch access denied';
  end if;

  if not (
    public.has_permission('queue.manage', v_enc.branch_id)
    or public.has_permission('dental_chart.write', v_enc.branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  if v_enc.status <> 'open' then
    return jsonb_build_object('id', v_enc.id, 'status', v_enc.status, 'already_closed', true);
  end if;

  update public.patient_encounters
  set status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      updated_at = now()
  where id = p_encounter_id;

  perform public.emit_workflow_event(
    v_enc.branch_id, 'encounter.closed', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_enc.patient_id)
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_enc.organization_id, v_enc.branch_id, auth.uid(),
    'encounter.close', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_enc.patient_id)
  );

  return jsonb_build_object('id', p_encounter_id, 'status', 'closed', 'closed_at', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- List encounters for patient
-- ---------------------------------------------------------------------------
create or replace function public.get_patient_encounters(
  p_patient_id uuid,
  p_branch_id uuid default null,
  p_limit int default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_rows jsonb;
begin
  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.organization_id = v_org
  ) then
    raise exception 'Patient not found';
  end if;

  select coalesce(jsonb_agg(row_to_json(e)::jsonb order by e.opened_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      pe.id,
      pe.display_code,
      pe.source_type,
      pe.status,
      pe.opened_at,
      pe.closed_at,
      pe.appointment_id,
      pe.queue_entry_id,
      pe.branch_id,
      qe.status as queue_status,
      qe.display_code as queue_code,
      (select count(*)::int from public.clinical_notes cn where cn.encounter_id = pe.id) as note_count,
      (select count(*)::int from public.treatment_plans tp where tp.encounter_id = pe.id) as plan_count,
      (select count(*)::int from public.invoices inv where inv.encounter_id = pe.id) as invoice_count
    from public.patient_encounters pe
    left join public.queue_entries qe on qe.id = pe.queue_entry_id
    where pe.patient_id = p_patient_id
      and pe.organization_id = v_org
      and (p_branch_id is null or pe.branch_id = p_branch_id)
    order by pe.opened_at desc
    limit greatest(1, least(p_limit, 200))
  ) e;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Encounter detail with linked artifacts
-- ---------------------------------------------------------------------------
create or replace function public.get_patient_encounter_detail(p_encounter_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
  v_queue jsonb;
  v_appt jsonb;
  v_notes jsonb;
  v_plans jsonb;
  v_invoices jsonb;
begin
  select * into v_enc from public.patient_encounters where id = p_encounter_id;

  if v_enc.id is null then
    raise exception 'Encounter not found';
  end if;

  if v_enc.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_has_branch_access(v_enc.branch_id) then
    raise exception 'Branch access denied';
  end if;

  select to_jsonb(q.*) into v_queue
  from public.queue_entries q
  where q.id = v_enc.queue_entry_id;

  select to_jsonb(a.*) into v_appt
  from public.appointments a
  where a.id = v_enc.appointment_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cn.id,
      'title', cn.title,
      'status', cn.status,
      'signed_at', cn.signed_at,
      'created_at', cn.created_at
    ) order by cn.created_at desc
  ), '[]'::jsonb)
  into v_notes
  from public.clinical_notes cn
  where cn.encounter_id = p_encounter_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tp.id,
      'title', tp.title,
      'status', tp.status,
      'total_estimated', tp.total_estimated,
      'approved_at', tp.approved_at,
      'created_at', tp.created_at
    ) order by tp.created_at desc
  ), '[]'::jsonb)
  into v_plans
  from public.treatment_plans tp
  where tp.encounter_id = p_encounter_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', inv.id,
      'invoice_number', inv.invoice_number,
      'status', inv.status,
      'total_amount', inv.total_amount,
      'paid_amount', inv.paid_amount,
      'created_at', inv.created_at
    ) order by inv.created_at desc
  ), '[]'::jsonb)
  into v_invoices
  from public.invoices inv
  where inv.encounter_id = p_encounter_id;

  return jsonb_build_object(
    'encounter', jsonb_build_object(
      'id', v_enc.id,
      'display_code', v_enc.display_code,
      'source_type', v_enc.source_type,
      'status', v_enc.status,
      'opened_at', v_enc.opened_at,
      'closed_at', v_enc.closed_at,
      'patient_id', v_enc.patient_id,
      'branch_id', v_enc.branch_id,
      'appointment_id', v_enc.appointment_id,
      'queue_entry_id', v_enc.queue_entry_id
    ),
    'queue', v_queue,
    'appointment', v_appt,
    'notes', v_notes,
    'plans', v_plans,
    'invoices', v_invoices
  );
end;
$$;

-- Active open encounter for patient + branch
create or replace function public.get_active_patient_encounter(
  p_patient_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select pe.id into v_id
  from public.patient_encounters pe
  where pe.patient_id = p_patient_id
    and pe.branch_id = p_branch_id
    and pe.organization_id = public.current_user_org_id()
    and pe.status = 'open'
  order by pe.opened_at desc
  limit 1;

  if v_id is null then
    return null;
  end if;

  return public.get_patient_encounter_detail(v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in: open encounter + link queue
-- ---------------------------------------------------------------------------
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
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
  v_encounter_id uuid;
  v_pending_consents int;
  v_source text;
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
    select count(*) into v_pending_consents
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_org
      and pc.status = 'pending';

    if v_pending_consents > 0 then
      raise exception 'Pending consents must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if v_force and public._workflow_enabled(v_branch_id, 'consent_gate_checkin') then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org, v_branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_patient_id::text,
      jsonb_build_object('pending_consents', v_pending_consents)
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

  v_encounter_id := public._open_patient_encounter(
    v_org, v_branch_id, v_patient_id, v_appointment_id, v_id, v_source, v_code
  );

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
      'encounter_id', v_encounter_id
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'appointment_id', v_appointment_id,
    'encounter_id', v_encounter_id,
    'status', 'waiting'
  );
end;
$$;

create or replace function public.check_in_appointment(
  p_appointment_id uuid,
  p_force_billing_override boolean default false,
  p_force_checkin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_code text;
  v_queue_id uuid;
  v_encounter_id uuid;
  v_pending_consents int;
begin
  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment cannot be checked in';
  end if;

  if not public._user_can_check_in(v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(
    v_appt.patient_id, v_appt.branch_id, p_force_billing_override, 'appointment_check_in'
  );

  if public._workflow_enabled(v_appt.branch_id, 'consent_gate_checkin') and not p_force_checkin then
    select count(*) into v_pending_consents
    from public.patient_consents pc
    where pc.patient_id = v_appt.patient_id
      and pc.organization_id = v_appt.organization_id
      and pc.status = 'pending';

    if v_pending_consents > 0 then
      raise exception 'Pending consents must be signed before check-in. Set force_checkin to override (logged).';
    end if;
  end if;

  if p_force_checkin and public._workflow_enabled(v_appt.branch_id, 'consent_gate_checkin') then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_appt.organization_id, v_appt.branch_id, auth.uid(),
      'checkin.consent_override', 'patient', v_appt.patient_id::text,
      jsonb_build_object('appointment_id', v_appt.id, 'pending_consents', v_pending_consents)
    );
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

  v_encounter_id := public._open_patient_encounter(
    v_appt.organization_id, v_appt.branch_id, v_appt.patient_id,
    v_appt.id, v_queue_id, 'appointment', v_code
  );

  update public.appointments
  set status = 'checked_in', updated_at = now()
  where id = v_appt.id
    and status in ('scheduled', 'confirmed');

  perform public.emit_workflow_event(
    v_appt.branch_id, 'patient.checked_in', 'queue_entry', v_queue_id::text,
    jsonb_build_object(
      'patient_id', v_appt.patient_id,
      'appointment_id', v_appt.id,
      'display_code', v_code,
      'encounter_id', v_encounter_id
    )
  );

  return jsonb_build_object(
    'queue_id', v_queue_id,
    'display_code', v_code,
    'encounter_id', v_encounter_id,
    'appointment_id', v_appt.id,
    'status', 'waiting'
  );
end;
$$;

-- Treatment plan: optional encounter_id in payload
create or replace function public.create_treatment_plan(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := coalesce((p_payload->>'organization_id')::uuid, public.current_user_org_id());
  v_title text := nullif(trim(p_payload->>'title'), '');
  v_encounter_id uuid := nullif(p_payload->>'encounter_id', '')::uuid;
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null or v_title is null then
    raise exception 'branch_id, patient_id, and title are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('dental_chart.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.treatment_plans (
    organization_id, branch_id, patient_id, title, status, created_by, encounter_id
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_title, 'proposed', auth.uid(), v_encounter_id
  )
  returning id into v_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'treatment_plan.create', 'treatment_plan', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'title', v_title, 'encounter_id', v_encounter_id)
  );

  return jsonb_build_object('id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: one encounter per historical queue entry
-- ---------------------------------------------------------------------------
insert into public.patient_encounters (
  organization_id, branch_id, patient_id, source_type,
  appointment_id, queue_entry_id, display_code, status,
  opened_at, closed_at, created_by
)
select
  qe.organization_id,
  qe.branch_id,
  qe.patient_id,
  case when qe.appointment_id is not null then 'appointment' else 'walk_in' end,
  qe.appointment_id,
  qe.id,
  coalesce(qe.display_code, 'VIS-' || upper(substring(replace(qe.id::text, '-', ''), 1, 8))),
  case
    when qe.status = 'cancelled' then 'cancelled'
    when qe.status = 'served' then 'closed'
    else 'closed'
  end,
  qe.checked_in_at,
  case when qe.status in ('served', 'cancelled') then coalesce(qe.completed_at, qe.updated_at) else qe.completed_at end,
  qe.created_by
from public.queue_entries qe
where qe.encounter_id is null
  and not exists (
    select 1 from public.patient_encounters pe where pe.queue_entry_id = qe.id
  );

update public.queue_entries qe
set encounter_id = pe.id
from public.patient_encounters pe
where pe.queue_entry_id = qe.id
  and qe.encounter_id is null;

-- Link notes/plans/invoices by appointment + same calendar day as encounter
update public.clinical_notes cn
set encounter_id = pe.id
from public.patient_encounters pe
where cn.encounter_id is null
  and cn.patient_id = pe.patient_id
  and cn.branch_id = pe.branch_id
  and (
    (cn.appointment_id is not null and cn.appointment_id = pe.appointment_id)
    or (
      cn.created_at >= pe.opened_at - interval '2 hours'
      and cn.created_at <= coalesce(pe.closed_at, pe.opened_at) + interval '24 hours'
    )
  );

update public.treatment_plans tp
set encounter_id = pe.id
from public.patient_encounters pe
where tp.encounter_id is null
  and tp.patient_id = pe.patient_id
  and tp.branch_id = pe.branch_id
  and tp.created_at >= pe.opened_at - interval '2 hours'
  and tp.created_at <= coalesce(pe.closed_at, pe.opened_at) + interval '24 hours';

update public.invoices inv
set encounter_id = pe.id
from public.patient_encounters pe
where inv.encounter_id is null
  and inv.patient_id = pe.patient_id
  and inv.branch_id = pe.branch_id
  and inv.created_at >= pe.opened_at - interval '2 hours'
  and inv.created_at <= coalesce(pe.closed_at, pe.opened_at) + interval '48 hours';

grant execute on function public.close_patient_encounter(uuid) to authenticated;
grant execute on function public.get_patient_encounters(uuid, uuid, int) to authenticated;
grant execute on function public.get_patient_encounter_detail(uuid) to authenticated;
grant execute on function public.get_active_patient_encounter(uuid, uuid) to authenticated;
