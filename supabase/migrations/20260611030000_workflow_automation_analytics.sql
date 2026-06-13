-- Workflow engine, cross-module automation, owner analytics RPCs

-- ---------------------------------------------------------------------------
-- Appointment status: add checked_in
-- ---------------------------------------------------------------------------
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'));

-- ---------------------------------------------------------------------------
-- Workflow tables
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_events_unprocessed
  on public.workflow_events(organization_id, created_at desc)
  where processed_at is null;

alter table public.workflow_events enable row level security;

drop policy if exists workflow_events_select on public.workflow_events;
create policy workflow_events_select on public.workflow_events
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (public.user_is_org_admin() or public.has_permission('audit.read', branch_id))
  );

create table if not exists public.branch_workflow_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  settings jsonb not null default jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true
  ),
  updated_at timestamptz not null default now()
);

alter table public.branch_workflow_settings enable row level security;

drop policy if exists branch_workflow_settings_select on public.branch_workflow_settings;
create policy branch_workflow_settings_select on public.branch_workflow_settings
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists branch_workflow_settings_write on public.branch_workflow_settings;
create policy branch_workflow_settings_write on public.branch_workflow_settings
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('settings.manage', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

create table if not exists public.slot_notification_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  slot_at timestamptz not null,
  source_appointment_id uuid references public.appointments(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_slot_notification_pending
  on public.slot_notification_queue(branch_id, created_at)
  where processed_at is null;

alter table public.slot_notification_queue enable row level security;

drop policy if exists slot_notification_queue_select on public.slot_notification_queue;
create policy slot_notification_queue_select on public.slot_notification_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.read', branch_id)
  );

-- ---------------------------------------------------------------------------
-- Workflow helpers
-- ---------------------------------------------------------------------------
create or replace function public._default_workflow_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true
  );
$$;

create or replace function public._workflow_enabled(p_branch_id uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  if p_branch_id is null then
    return true;
  end if;

  select coalesce(bws.settings, public._default_workflow_settings())
  into v_settings
  from public.branch_workflow_settings bws
  where bws.branch_id = p_branch_id;

  if v_settings is null then
    v_settings := public._default_workflow_settings();
  end if;

  return coalesce((v_settings ->> p_key)::boolean, true);
end;
$$;

create or replace function public.emit_workflow_event(
  p_branch_id uuid,
  p_event_type text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_id uuid;
begin
  insert into public.workflow_events (
    organization_id, branch_id, event_type, entity_type, entity_id, payload
  ) values (
    v_org, p_branch_id, p_event_type, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_branch_workflow_settings(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(bws.settings, public._default_workflow_settings())
  into v_settings
  from public.branch_workflow_settings bws
  where bws.branch_id = p_branch_id;

  return coalesce(v_settings, public._default_workflow_settings());
end;
$$;

grant execute on function public.get_branch_workflow_settings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invoice draft from treatment plan (internal + automation)
-- ---------------------------------------------------------------------------
create or replace function public._create_invoice_draft_from_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_existing uuid;
  v_invoice_id uuid;
  v_item record;
  v_inv_num text;
begin
  select * into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id();

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  select id into v_existing
  from public.invoices
  where treatment_plan_id = p_plan_id
    and status <> 'void'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_inv_num := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.invoices (
    organization_id, branch_id, patient_id, treatment_plan_id,
    invoice_number, total_amount, paid_amount, status, created_by
  ) values (
    v_plan.organization_id, v_plan.branch_id, v_plan.patient_id, p_plan_id,
    v_inv_num, 0, 0, 'draft', auth.uid()
  )
  returning id into v_invoice_id;

  for v_item in
    select * from public.treatment_plan_items where plan_id = p_plan_id order by created_at
  loop
    perform public.add_invoice_line_item(
      v_invoice_id,
      coalesce(v_item.description, 'Treatment item'),
      coalesce(v_item.estimated_price, 0),
      1,
      v_item.tooth_number,
      v_item.procedure_id,
      v_item.id
    );
  end loop;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'invoice.auto_draft_from_plan',
    'invoice',
    v_invoice_id::text,
    jsonb_build_object('treatment_plan_id', p_plan_id)
  );

  return v_invoice_id;
end;
$$;

create or replace function public._auto_hmo_claim_for_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_ins record;
  v_provider_id uuid;
  v_claim_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null then return null; end if;

  select pip.* into v_ins
  from public.patient_insurance_profiles pip
  where pip.patient_id = v_inv.patient_id
    and pip.payer_type = 'hmo'
    and pip.is_primary = true
  limit 1;

  if v_ins.id is null then return null; end if;

  select hp.id into v_provider_id
  from public.hmo_providers hp
  where hp.organization_id = v_inv.organization_id
    and hp.is_active = true
    and lower(hp.name) = lower(coalesce(v_ins.payer_name, ''))
  limit 1;

  if exists (
    select 1 from public.hmo_claims hc
    where hc.invoice_id = p_invoice_id and hc.status <> 'rejected'
  ) then
    return null;
  end if;

  insert into public.hmo_claims (
    organization_id, branch_id, patient_id, invoice_id, provider_id,
    member_id, claimed_amount, status, created_by
  ) values (
    v_inv.organization_id, v_inv.branch_id, v_inv.patient_id, p_invoice_id, v_provider_id,
    v_ins.member_id, v_inv.total_amount, 'draft', auth.uid()
  )
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approve plan → auto invoice (+ optional HMO)
-- ---------------------------------------------------------------------------
create or replace function public.approve_treatment_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_estimate jsonb;
  v_count bigint;
  v_invoice_id uuid := null;
  v_claim_id uuid := null;
begin
  select *
  into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status not in ('draft', 'proposed') then
    raise exception 'Plan cannot be approved from status %', v_plan.status;
  end if;

  select count(*) into v_count
  from public.treatment_plan_items
  where plan_id = p_plan_id;

  if v_count = 0 then
    raise exception 'Add at least one procedure before approving';
  end if;

  v_estimate := public.calculate_treatment_estimate(p_plan_id);

  update public.treatment_plans
  set status = 'approved', approved_at = now(), updated_at = now()
  where id = p_plan_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'treatment_plan.approved',
    'treatment_plan',
    p_plan_id::text,
    jsonb_build_object(
      'total_estimated', v_estimate->'total_estimated',
      'item_count', v_estimate->'item_count'
    )
  );

  if public._workflow_enabled(v_plan.branch_id, 'auto_approve_creates_invoice') then
    v_invoice_id := public._create_invoice_draft_from_plan(p_plan_id);
    if public._workflow_enabled(v_plan.branch_id, 'auto_hmo_claim_on_invoice') and v_invoice_id is not null then
      v_claim_id := public._auto_hmo_claim_for_invoice(v_invoice_id);
    end if;
    perform public.emit_workflow_event(
      v_plan.branch_id,
      'treatment_plan.approved',
      'treatment_plan',
      p_plan_id::text,
      jsonb_build_object('invoice_id', v_invoice_id, 'hmo_claim_id', v_claim_id)
    );
  end if;

  return v_estimate || jsonb_build_object(
    'status', 'approved',
    'approved_at', now(),
    'invoice_id', v_invoice_id,
    'hmo_claim_id', v_claim_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in → appointment checked_in + consent gate
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
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
  v_pending_consents int;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if not public.has_permission('queue.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

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

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_org, v_branch_id, v_patient_id, v_appointment_id,
    v_code, v_notes, auth.uid()
  )
  returning id into v_id;

  if v_appointment_id is not null and public._workflow_enabled(v_branch_id, 'auto_checkin_updates_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_appointment_id
      and status in ('scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_branch_id, 'patient.checked_in', 'queue_entry', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'appointment_id', v_appointment_id, 'display_code', v_code)
  );

  return jsonb_build_object(
    'id', v_id,
    'display_code', v_code,
    'status', 'waiting',
    'appointment_id', v_appointment_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue served → appointment completed
-- ---------------------------------------------------------------------------
create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    raise exception 'Queue entry not found';
  end if;

  if not public.has_permission('queue.manage', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status not in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  update public.queue_entries
  set status = p_status,
      chair_label = coalesce(p_chair_label, chair_label),
      called_at = case when p_status = 'now_serving' and called_at is null then now() else called_at end,
      completed_at = case when p_status = 'served' then now() else completed_at end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  if p_status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'completed', updated_at = now()
    where id = v_entry.appointment_id
      and status in ('checked_in', 'scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_entry.branch_id, 'queue.status_changed', 'queue_entry', p_entry_id::text,
    jsonb_build_object('status', p_status, 'appointment_id', v_entry.appointment_id)
  );

  return jsonb_build_object('id', p_entry_id, 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- No-show → slot notification queue
-- ---------------------------------------------------------------------------
create or replace function public.mark_appointment_no_show(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_appt.status not in ('scheduled', 'confirmed', 'checked_in') then
    raise exception 'Only active appointments can be marked no-show';
  end if;

  update public.appointments
  set status = 'no_show', updated_at = now()
  where id = p_appointment_id;

  if public._workflow_enabled(v_appt.branch_id, 'auto_waitlist_on_slot_open') then
    insert into public.slot_notification_queue (
      organization_id, branch_id, slot_at, source_appointment_id
    ) values (
      v_appt.organization_id, v_appt.branch_id, v_appt.scheduled_at, p_appointment_id
    );
    perform public.emit_workflow_event(
      v_appt.branch_id, 'slot.opened', 'appointment', p_appointment_id::text,
      jsonb_build_object('slot_at', v_appt.scheduled_at)
    );
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id,
    v_appt.branch_id,
    auth.uid(),
    'appointment.no_show',
    'appointment',
    p_appointment_id,
    jsonb_build_object(
      'scheduled_at', v_appt.scheduled_at,
      'patient_id', v_appt.patient_id,
      'previous_status', v_appt.status
    )
  );

  return jsonb_build_object(
    'id', p_appointment_id,
    'status', 'no_show',
    'scheduled_at', v_appt.scheduled_at,
    'branch_id', v_appt.branch_id,
    'waitlist_queued', public._workflow_enabled(v_appt.branch_id, 'auto_waitlist_on_slot_open')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner analytics RPC
-- ---------------------------------------------------------------------------
create or replace function public.get_owner_analytics(
  p_branch_id uuid default null,
  p_period_days int default 7,
  p_locale text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_end date := current_date;
  v_daily_appts jsonb := '[]'::jsonb;
  v_daily_coll jsonb := '[]'::jsonb;
  v_status jsonb := '[]'::jsonb;
  v_branch_compare jsonb;
  v_totals jsonb;
  d date;
  v_cnt int;
  v_amt numeric;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if p_branch_id is not null then
    if not (
      public.user_is_org_admin()
      or public.has_permission('appointments.read', p_branch_id)
    ) then
      raise exception 'Permission denied';
    end if;
  elsif not public.user_is_org_admin() then
    raise exception 'Organization-wide analytics requires admin access';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := v_end - (p_period_days - 1);

  for d in select generate_series(v_start, v_end, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.appointments a
    where a.organization_id = v_org
      and (p_branch_id is null or a.branch_id = p_branch_id)
      and (a.scheduled_at at time zone 'Asia/Manila')::date = d;

    v_daily_appts := v_daily_appts || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));

    select coalesce(sum(ip.amount), 0) into v_amt
    from public.invoice_payments ip
    join public.invoices inv on inv.id = ip.invoice_id
    where inv.organization_id = v_org
      and (p_branch_id is null or inv.branch_id = p_branch_id)
      and ip.created_at::date = d;

    v_daily_coll := v_daily_coll || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_amt
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'count', s.cnt) order by s.cnt desc), '[]'::jsonb)
  into v_status
  from (
    select a.status, count(*)::int as cnt
    from public.appointments a
    where a.organization_id = v_org
      and (p_branch_id is null or a.branch_id = p_branch_id)
      and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end
    group by a.status
  ) s;

  if p_branch_id is null then
    select coalesce(jsonb_agg(jsonb_build_object('label', b.name, 'value', bc.cnt) order by bc.cnt desc), '[]'::jsonb)
    into v_branch_compare
    from (
      select inv.branch_id, count(*)::int as cnt
      from public.invoices inv
      where inv.organization_id = v_org
        and inv.status in ('draft', 'sent', 'partial')
      group by inv.branch_id
    ) bc
    join public.branches b on b.id = bc.branch_id;
  end if;

  select jsonb_build_object(
    'appointments', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'completed', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and a.status = 'completed' and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'cancelled', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and a.status = 'cancelled' and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'no_show', (select count(*) from public.appointments a where a.organization_id = v_org and (p_branch_id is null or a.branch_id = p_branch_id) and a.status = 'no_show' and (a.scheduled_at at time zone 'Asia/Manila')::date between v_start and v_end),
    'collected', (select coalesce(sum(ip.amount), 0) from public.invoice_payments ip join public.invoices inv on inv.id = ip.invoice_id where inv.organization_id = v_org and (p_branch_id is null or inv.branch_id = p_branch_id) and ip.created_at::date between v_start and v_end),
    'open_invoices', (select count(*) from public.invoices inv where inv.organization_id = v_org and (p_branch_id is null or inv.branch_id = p_branch_id) and inv.status in ('draft', 'sent', 'partial')),
    'pending_consents', (select count(*) from public.patient_consents pc where pc.organization_id = v_org and (p_branch_id is null or pc.branch_id = p_branch_id) and pc.status = 'pending'),
    'queue_waiting', (select count(*) from public.queue_entries qe where qe.organization_id = v_org and (p_branch_id is null or qe.branch_id = p_branch_id) and qe.status in ('waiting', 'ready')),
    'hmo_draft', (select count(*) from public.hmo_claims hc where hc.organization_id = v_org and (p_branch_id is null or hc.branch_id = p_branch_id) and hc.status = 'draft')
  ) into v_totals;

  return jsonb_build_object(
    'period_days', p_period_days,
    'daily_appointments', v_daily_appts,
    'daily_collections', v_daily_coll,
    'status_breakdown', v_status,
    'totals', v_totals,
    'branch_compare', v_branch_compare
  );
end;
$$;

grant execute on function public.get_owner_analytics(uuid, int, text) to authenticated;

-- Queue analytics
create or replace function public.get_queue_analytics(
  p_branch_id uuid,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_median numeric;
  v_peak jsonb;
  v_flow jsonb;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select percentile_cont(0.5) within group (order by extract(epoch from (coalesce(called_at, completed_at) - checked_in_at)) / 60.0)
  into v_median
  from public.queue_entries
  where branch_id = p_branch_id
    and status = 'served'
    and checked_in_at >= now() - (greatest(p_period_days, 1) || ' days')::interval;

  select coalesce(jsonb_agg(jsonb_build_object('label', h.hr, 'value', h.cnt) order by h.cnt desc), '[]'::jsonb)
  into v_peak
  from (
    select to_char(checked_in_at at time zone 'Asia/Manila', 'HH24') || ':00' as hr, count(*)::int as cnt
    from public.queue_entries
    where branch_id = p_branch_id
      and checked_in_at >= now() - (greatest(p_period_days, 1) || ' days')::interval
    group by 1
    order by cnt desc
    limit 8
  ) h;

  select coalesce(jsonb_agg(jsonb_build_object('label', s.status, 'value', s.cnt)), '[]'::jsonb)
  into v_flow
  from (
    select status, count(*)::int as cnt
    from public.queue_entries
    where branch_id = p_branch_id
      and checked_in_at::date = current_date
    group by status
  ) s;

  return jsonb_build_object(
    'median_wait_minutes', round(coalesce(v_median, 0)::numeric, 1),
    'peak_hours', v_peak,
    'today_flow', v_flow
  );
end;
$$;

grant execute on function public.get_queue_analytics(uuid, int) to authenticated;

-- Daily closeout
create or replace function public.get_daily_closeout(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'date', p_date,
    'collected', (
      select coalesce(sum(ip.amount), 0)
      from public.invoice_payments ip
      join public.invoices inv on inv.id = ip.invoice_id
      where inv.organization_id = v_org
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and ip.created_at::date = p_date
    ),
    'open_balance', (
      select coalesce(sum(inv.total_amount - inv.paid_amount), 0)
      from public.invoices inv
      where inv.organization_id = v_org
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'open_invoice_count', (
      select count(*)
      from public.invoices inv
      where inv.organization_id = v_org
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'appointments_completed', (
      select count(*)
      from public.appointments a
      where a.organization_id = v_org
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'completed'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'no_show', (
      select count(*)
      from public.appointments a
      where a.organization_id = v_org
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'no_show'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'pending_consents', (
      select count(*)
      from public.patient_consents pc
      where pc.organization_id = v_org
        and (p_branch_id is null or pc.branch_id = p_branch_id)
        and pc.status = 'pending'
    ),
    'hmo_pending', (
      select count(*)
      from public.hmo_claims hc
      where hc.organization_id = v_org
        and (p_branch_id is null or hc.branch_id = p_branch_id)
        and hc.status in ('draft', 'submitted', 'under_review')
    ),
    'low_stock', (
      select case when p_branch_id is null then 0 else (
        select count(*) from public.inventory_items i
        where i.branch_id = p_branch_id and i.is_active
          and (i.quantity_on_hand <= i.min_stock_level or (i.expiry_date is not null and i.expiry_date < current_date))
      ) end
    )
  );
end;
$$;

grant execute on function public.get_daily_closeout(uuid, date) to authenticated;

-- AR aging
create or replace function public.get_ar_aging(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('billing.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('label', bucket, 'value', amt) order by ord)
    from (
      select
        case
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 30 then '0–30 days'
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 60 then '31–60 days'
          else '60+ days'
        end as bucket,
        case
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 30 then 1
          when age(current_date, coalesce(inv.due_date, inv.created_at::date)) <= 60 then 2
          else 3
        end as ord,
        sum(inv.total_amount - inv.paid_amount) as amt
      from public.invoices inv
      where inv.branch_id = p_branch_id
        and inv.status in ('draft', 'sent', 'partial')
      group by 1, 2
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_ar_aging(uuid) to authenticated;
