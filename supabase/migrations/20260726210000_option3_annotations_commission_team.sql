-- Option-3 remaining: radiology annotations, commission ledger RLS,
-- staff team messages, staff timesheet, portal payment prep RPC.

-- ---------------------------------------------------------------------------
-- 1) Radiology annotation persistence (versioned jsonb on document)
-- ---------------------------------------------------------------------------
alter table public.patient_documents
  add column if not exists annotations jsonb not null default '[]'::jsonb,
  add column if not exists annotations_version integer not null default 1,
  add column if not exists annotations_updated_at timestamptz,
  add column if not exists annotations_updated_by uuid references public.profiles(id) on delete set null;

drop policy if exists patient_documents_update on public.patient_documents;
create policy patient_documents_update on public.patient_documents
  for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.write', coalesce(branch_id, (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    )))
  );

create or replace function public.save_patient_document_annotations(
  p_document_id uuid,
  p_annotations jsonb,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_doc public.patient_documents%rowtype;
  v_org uuid := public.current_user_org_id();
  v_new_version integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(p_annotations) is distinct from 'array' then
    raise exception 'Annotations must be a JSON array';
  end if;

  select * into v_doc
  from public.patient_documents
  where id = p_document_id
    and organization_id = v_org
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  if not public.has_permission('patients.write', coalesce(v_doc.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  if p_expected_version is not null and v_doc.annotations_version is distinct from p_expected_version then
    raise exception 'Annotation version conflict (expected %, found %)',
      p_expected_version, v_doc.annotations_version;
  end if;

  v_new_version := coalesce(v_doc.annotations_version, 1) + 1;

  update public.patient_documents
  set
    annotations = p_annotations,
    annotations_version = v_new_version,
    annotations_updated_at = now(),
    annotations_updated_by = auth.uid()
  where id = p_document_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (
    v_doc.organization_id,
    v_doc.branch_id,
    auth.uid(),
    'patient_document.annotations_save',
    'patient_document',
    p_document_id::text,
    jsonb_build_object(
      'patient_id', v_doc.patient_id,
      'version', v_new_version,
      'annotation_count', jsonb_array_length(p_annotations)
    )
  );

  return jsonb_build_object(
    'document_id', p_document_id,
    'annotations_version', v_new_version,
    'annotations_updated_at', now()
  );
end;
$$;

revoke all on function public.save_patient_document_annotations(uuid, jsonb, integer) from public;
grant execute on function public.save_patient_document_annotations(uuid, jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Provider commissions: RLS + write on payment
-- ---------------------------------------------------------------------------
alter table public.provider_commissions enable row level security;

drop policy if exists provider_commissions_select on public.provider_commissions;
create policy provider_commissions_select on public.provider_commissions
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('billing.read', branch_id)
      or public.has_permission('staff.manage', branch_id)
      or provider_id = auth.uid()
    )
  );

-- Writes only via SECURITY DEFINER payment RPC
revoke insert, update, delete on public.provider_commissions from authenticated, anon;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inv record;
  v_new_paid numeric;
  v_new_status text;
  v_org uuid := public.current_user_org_id();
  v_encounter_closed boolean := false;
  v_provider_id uuid;
  v_rate numeric;
  v_commission numeric;
begin
  select * into v_inv from public.invoices
  where id = p_invoice_id and organization_id = v_org;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  v_new_paid := coalesce(v_inv.paid_amount, 0) + p_amount;

  if v_new_paid >= v_inv.total_amount then
    v_new_status := 'paid';
    v_new_paid := v_inv.total_amount;
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := v_inv.status;
  end if;

  insert into public.invoice_payments (invoice_id, organization_id, amount, payment_method, notes, recorded_by)
  values (p_invoice_id, v_org, p_amount, p_payment_method, p_notes, auth.uid());

  update public.invoices
  set paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  where id = p_invoice_id;

  if v_new_status = 'paid'
    and v_inv.encounter_id is not null
    and public._workflow_enabled(v_inv.branch_id, 'auto_close_encounter_on_payment') then
    v_encounter_closed := public._close_encounter_automation(v_inv.encounter_id);
  end if;

  -- Commission: appointment provider → else invoice creator, if rate > 0
  v_provider_id := null;
  if v_inv.encounter_id is not null then
    select a.provider_id into v_provider_id
    from public.patient_encounters pe
    join public.appointments a on a.id = pe.appointment_id
    where pe.id = v_inv.encounter_id
    limit 1;
  end if;

  if v_provider_id is null then
    v_provider_id := v_inv.created_by;
  end if;

  if v_provider_id is not null then
    select coalesce(sp.commission_rate, 0) into v_rate
    from public.staff_profiles sp
    where sp.profile_id = v_provider_id;

    if coalesce(v_rate, 0) > 0 then
      v_commission := round(p_amount * v_rate / 100.0, 2);
      if v_commission > 0 then
        insert into public.provider_commissions (
          organization_id, branch_id, provider_id, invoice_id, amount
        ) values (
          v_inv.organization_id, v_inv.branch_id, v_provider_id, p_invoice_id, v_commission
        );
      end if;
    end if;
  end if;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (
    v_inv.organization_id,
    v_inv.branch_id,
    auth.uid(),
    'invoice.payment_record',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'amount', p_amount,
      'method', p_payment_method,
      'commission', v_commission,
      'provider_id', v_provider_id
    )
  );

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'status', v_new_status,
    'balance', v_inv.total_amount - v_new_paid,
    'encounter_closed', v_encounter_closed,
    'commission_amount', v_commission,
    'commission_provider_id', v_provider_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Staff team messages (branch chat MVP)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_messages_branch_created
  on public.staff_messages(branch_id, created_at desc);

alter table public.staff_messages enable row level security;

drop policy if exists staff_messages_select on public.staff_messages;
create policy staff_messages_select on public.staff_messages
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() and sba.branch_id = staff_messages.branch_id
    )
  );

drop policy if exists staff_messages_insert on public.staff_messages;
create policy staff_messages_insert on public.staff_messages
  for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and author_id = auth.uid()
    and exists (
      select 1 from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() and sba.branch_id = staff_messages.branch_id
    )
  );

grant select, insert on public.staff_messages to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Staff timesheet (clock in / out)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint staff_time_entries_out_after_in check (
    clock_out_at is null or clock_out_at >= clock_in_at
  )
);

create index if not exists idx_staff_time_entries_profile
  on public.staff_time_entries(profile_id, clock_in_at desc);

create unique index if not exists idx_staff_time_entries_open
  on public.staff_time_entries(profile_id)
  where clock_out_at is null;

alter table public.staff_time_entries enable row level security;

drop policy if exists staff_time_entries_select on public.staff_time_entries;
create policy staff_time_entries_select on public.staff_time_entries
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      profile_id = auth.uid()
      or public.has_permission('staff.manage', branch_id)
    )
  );

drop policy if exists staff_time_entries_insert on public.staff_time_entries;
create policy staff_time_entries_insert on public.staff_time_entries
  for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and profile_id = auth.uid()
    and exists (
      select 1 from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() and sba.branch_id = staff_time_entries.branch_id
    )
  );

drop policy if exists staff_time_entries_update on public.staff_time_entries;
create policy staff_time_entries_update on public.staff_time_entries
  for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and profile_id = auth.uid()
  )
  with check (
    organization_id = public.current_user_org_id()
    and profile_id = auth.uid()
  );

grant select, insert, update on public.staff_time_entries to authenticated;

create or replace function public.clock_in_staff(p_branch_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() and sba.branch_id = p_branch_id
  ) then
    raise exception 'Not assigned to this branch';
  end if;

  if exists (
    select 1 from public.staff_time_entries
    where profile_id = auth.uid() and clock_out_at is null
  ) then
    raise exception 'Already clocked in';
  end if;

  insert into public.staff_time_entries (organization_id, branch_id, profile_id, note)
  values (v_org, p_branch_id, auth.uid(), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_org, p_branch_id, auth.uid(), 'staff.clock_in', 'staff_time_entry', v_id::text, '{}'::jsonb);

  return jsonb_build_object('id', v_id, 'clock_in_at', now());
end;
$$;

create or replace function public.clock_out_staff(p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.staff_time_entries%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_row
  from public.staff_time_entries
  where profile_id = auth.uid() and clock_out_at is null
  for update;

  if not found then
    raise exception 'Not clocked in';
  end if;

  update public.staff_time_entries
  set
    clock_out_at = now(),
    note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note)
  where id = v_row.id
  returning * into v_row;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (
    v_row.organization_id, v_row.branch_id, auth.uid(),
    'staff.clock_out', 'staff_time_entry', v_row.id::text,
    jsonb_build_object('minutes', greatest(0, round(extract(epoch from (v_row.clock_out_at - v_row.clock_in_at)) / 60)))
  );

  return jsonb_build_object(
    'id', v_row.id,
    'clock_in_at', v_row.clock_in_at,
    'clock_out_at', v_row.clock_out_at
  );
end;
$$;

revoke all on function public.clock_in_staff(uuid, text) from public;
revoke all on function public.clock_out_staff(text) from public;
grant execute on function public.clock_in_staff(uuid, text) to authenticated;
grant execute on function public.clock_out_staff(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Portal payment: validate + create intent row; edge fills live checkout
-- ---------------------------------------------------------------------------
create or replace function public.prepare_portal_payment_intent(
  p_session_id uuid,
  p_phone text,
  p_last_name text,
  p_invoice_id uuid,
  p_provider text default 'paymongo',
  p_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_inv public.invoices%rowtype;
  v_balance numeric;
  v_amount numeric;
  v_intent_id uuid;
  v_ref text;
begin
  if p_provider not in ('paymongo', 'gcash') then
    raise exception 'Unsupported provider';
  end if;

  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_patient_id := public._portal_resolve_patient(p_session_id, p_phone, p_last_name);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.patient_id <> v_patient_id then raise exception 'Invoice does not belong to patient'; end if;
  if v_inv.organization_id <> v_session.organization_id then raise exception 'Organization mismatch'; end if;
  if v_inv.status = 'void' then raise exception 'Cannot pay void invoice'; end if;

  v_balance := greatest(v_inv.total_amount - v_inv.paid_amount, 0);
  v_amount := coalesce(p_amount, v_balance);
  if v_amount <= 0 or v_amount > v_balance then
    raise exception 'Invalid amount';
  end if;

  v_ref := 'portal-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  insert into public.payment_gateway_intents (
    organization_id, branch_id, invoice_id, provider, amount, status, external_ref, checkout_url, created_by
  ) values (
    v_inv.organization_id, v_inv.branch_id, v_inv.id, p_provider, v_amount, 'pending', v_ref, '', null
  )
  returning id into v_intent_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (
    v_inv.organization_id, v_inv.branch_id, null, 'portal.payment_intent.prepare', 'payment_gateway_intent', v_intent_id::text,
    jsonb_build_object('invoice_id', v_inv.id, 'provider', p_provider, 'amount', v_amount)
  );

  return jsonb_build_object(
    'intent_id', v_intent_id,
    'invoice_id', v_inv.id,
    'organization_id', v_inv.organization_id,
    'branch_id', v_inv.branch_id,
    'provider', p_provider,
    'amount', v_amount,
    'external_ref', v_ref,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.prepare_portal_payment_intent(uuid, text, text, uuid, text, numeric) from public;
grant execute on function public.prepare_portal_payment_intent(uuid, text, text, uuid, text, numeric) to anon, authenticated;
