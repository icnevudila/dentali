-- Notebook features: discounts, ortho billing, org preferences, prescriptions, consent scans

-- ---------------------------------------------------------------------------
-- 0. Closeout lock helpers (migration backfill + derived invoice totals)
-- ---------------------------------------------------------------------------
create or replace function public.check_closeout_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_branch_id uuid;
  v_org_id uuid;
begin
  if coalesce(current_setting('app.bypass_closeout_lock', true), '') = 'true' then
    if TG_OP = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    if TG_TABLE_NAME = 'invoices' then
      v_date := old.created_at::date;
      v_branch_id := old.branch_id;
      v_org_id := old.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := old.created_at::date;
      v_org_id := old.organization_id;
      select branch_id into v_branch_id from public.invoices where id = old.invoice_id;
    end if;
  else
    if TG_TABLE_NAME = 'invoices' then
      v_date := new.created_at::date;
      v_branch_id := new.branch_id;
      v_org_id := new.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := new.created_at::date;
      v_org_id := new.organization_id;
      select branch_id into v_branch_id from public.invoices where id = new.invoice_id;
    end if;
  end if;

  if exists (
    select 1 from public.closeout_snapshots
    where organization_id = v_org_id
      and (branch_id is null or branch_id = v_branch_id)
      and snapshot_date = v_date
  ) then
    raise exception 'This calendar day has been closed out. Financial records for closed days cannot be modified or deleted.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

create or replace function public.assert_invoice_closeout_editable(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;

  if exists (
    select 1 from public.closeout_snapshots cs
    where cs.organization_id = v_inv.organization_id
      and (cs.branch_id is null or cs.branch_id = v_inv.branch_id)
      and cs.snapshot_date = v_inv.created_at::date
  ) then
    raise exception 'This calendar day has been closed out. Financial records for closed days cannot be modified or deleted.';
  end if;
end;
$$;

create or replace function public._sync_invoice_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_paid numeric(12,2);
  v_new_status text;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.invoice_payments
  where invoice_id = p_invoice_id;

  v_new_status := case
    when v_inv.status = 'void' then 'void'
    when v_paid >= v_inv.total_amount and v_inv.total_amount > 0 then 'paid'
    when v_paid > 0 then 'partial'
    when v_inv.status = 'draft' then 'draft'
    else 'sent'
  end;

  if v_new_status = 'paid' then
    v_paid := v_inv.total_amount;
  end if;

  perform set_config('app.bypass_closeout_lock', 'true', true);
  update public.invoices
  set paid_amount = v_paid,
      status = v_new_status,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Invoice discounts
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column if not exists subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0);

alter table public.invoice_line_items
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);

create or replace function public.recalc_invoice_total_from_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
begin
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);

  select coalesce(sum(line_total), 0) into v_subtotal
  from public.invoice_line_items
  where invoice_id = v_invoice_id;

  select coalesce(discount_amount, 0) into v_discount
  from public.invoices
  where id = v_invoice_id;

  perform set_config('app.bypass_closeout_lock', 'true', true);
  update public.invoices
  set subtotal_amount = v_subtotal,
      total_amount = greatest(v_subtotal - v_discount, 0),
      updated_at = now()
  where id = v_invoice_id;

  return coalesce(NEW, OLD);
end;
$$;

create or replace function public.add_invoice_line_item(
  p_invoice_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1,
  p_tooth_number text default null,
  p_procedure_id uuid default null,
  p_treatment_plan_item_id uuid default null,
  p_discount_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_line_total numeric(12,2);
  v_sort int;
  v_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status in ('void', 'paid') then raise exception 'Cannot edit % invoice', v_inv.status; end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then raise exception 'Permission denied'; end if;
  perform public.assert_invoice_closeout_editable(p_invoice_id);

  v_line_total := greatest(
    round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0) - coalesce(p_discount_amount, 0), 2),
    0
  );

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.invoice_line_items where invoice_id = p_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, organization_id, procedure_id, treatment_plan_item_id,
    description, tooth_number, quantity, unit_price, discount_amount, line_total, sort_order
  ) values (
    p_invoice_id, v_inv.organization_id, p_procedure_id, p_treatment_plan_item_id,
    p_description, p_tooth_number, coalesce(p_quantity, 1), coalesce(p_unit_price, 0),
    coalesce(p_discount_amount, 0), v_line_total, v_sort
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_invoice_line_item(
  p_item_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1,
  p_discount_amount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.invoice_line_items%rowtype;
  v_inv public.invoices%rowtype;
  v_line_total numeric(12,2);
begin
  select * into v_item from public.invoice_line_items where id = p_item_id;
  if not found then raise exception 'Line item not found'; end if;

  select * into v_inv from public.invoices where id = v_item.invoice_id;
  if v_inv.status in ('void', 'paid') then raise exception 'Cannot edit line items on a % invoice', v_inv.status; end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then raise exception 'Permission denied'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Description is required'; end if;
  if coalesce(p_quantity, 0) <= 0 then raise exception 'Quantity must be positive'; end if;
  if coalesce(p_unit_price, 0) < 0 then raise exception 'Unit price cannot be negative'; end if;
  if coalesce(p_discount_amount, 0) < 0 then raise exception 'Discount cannot be negative'; end if;
  perform public.assert_invoice_closeout_editable(v_item.invoice_id);

  v_line_total := greatest(
    round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0) - coalesce(p_discount_amount, 0), 2),
    0
  );

  update public.invoice_line_items
  set description = trim(p_description),
      unit_price = coalesce(p_unit_price, 0),
      quantity = coalesce(p_quantity, 1),
      discount_amount = coalesce(p_discount_amount, 0),
      line_total = v_line_total
  where id = p_item_id;

  perform public._sync_invoice_payment_status(v_item.invoice_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id, v_inv.branch_id, auth.uid(),
    'invoice.line_item_update', 'invoice', v_inv.id::text,
    jsonb_build_object('line_item_id', p_item_id, 'discount_amount', coalesce(p_discount_amount, 0))
  );

  return jsonb_build_object('invoice_id', v_inv.id, 'line_item_id', p_item_id);
end;
$$;

create or replace function public.update_invoice_discount(
  p_invoice_id uuid,
  p_discount_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_subtotal numeric(12,2);
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status in ('void', 'paid') then raise exception 'Cannot discount a % invoice', v_inv.status; end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then raise exception 'Permission denied'; end if;
  if coalesce(p_discount_amount, 0) < 0 then raise exception 'Discount cannot be negative'; end if;

  select coalesce(sum(line_total), 0) into v_subtotal
  from public.invoice_line_items where invoice_id = p_invoice_id;

  if coalesce(p_discount_amount, 0) > v_subtotal then
    raise exception 'Discount cannot exceed subtotal';
  end if;

  perform public.assert_invoice_closeout_editable(p_invoice_id);

  update public.invoices
  set discount_amount = coalesce(p_discount_amount, 0),
      subtotal_amount = v_subtotal,
      total_amount = greatest(v_subtotal - coalesce(p_discount_amount, 0), 0),
      updated_at = now()
  where id = p_invoice_id;

  perform public._sync_invoice_payment_status(p_invoice_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id, v_inv.branch_id, auth.uid(),
    'invoice.discount_update', 'invoice', p_invoice_id::text,
    jsonb_build_object('discount_amount', coalesce(p_discount_amount, 0), 'subtotal', v_subtotal)
  );

  return jsonb_build_object('id', p_invoice_id, 'total_amount', greatest(v_subtotal - coalesce(p_discount_amount, 0), 0));
end;
$$;

-- Backfill subtotals (single transaction — bypass closeout for derived totals only)
do $notebook_backfill$
begin
  perform set_config('app.bypass_closeout_lock', 'true', true);

  update public.invoices inv
  set subtotal_amount = coalesce((
    select sum(line_total) from public.invoice_line_items li where li.invoice_id = inv.id
  ), 0),
  total_amount = greatest(
    coalesce((select sum(line_total) from public.invoice_line_items li where li.invoice_id = inv.id), 0)
    - coalesce(inv.discount_amount, 0),
    0
  );
end;
$notebook_backfill$;

-- ---------------------------------------------------------------------------
-- 2. Organization preferences (branch pricing, custom procedure pricing)
-- ---------------------------------------------------------------------------
alter table public.organization_settings
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create or replace function public.get_organization_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.current_user_org_id();
  v_prefs jsonb;
  v_branch_count int;
begin
  select coalesce(os.preferences, '{}'::jsonb) into v_prefs
  from public.organization_settings os
  where os.organization_id = v_org_id;

  if v_prefs is null then
    v_prefs := '{}'::jsonb;
  end if;

  select count(*)::int into v_branch_count
  from public.branches b
  where b.organization_id = v_org_id and b.is_active = true;

  return v_prefs || jsonb_build_object(
    'branch_count', v_branch_count,
    'branch_procedure_pricing_enabled',
      coalesce((v_prefs->>'branch_procedure_pricing_enabled')::boolean, v_branch_count > 1),
    'custom_procedure_show_price',
      coalesce((v_prefs->>'custom_procedure_show_price')::boolean, false)
  );
end;
$$;

create or replace function public.update_organization_preferences(p_preferences jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.current_user_org_id();
  v_merged jsonb;
begin
  if not public.has_permission('settings.manage', (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  )) then
    raise exception 'Permission denied';
  end if;

  insert into public.organization_settings (organization_id, preferences)
  values (v_org_id, coalesce(p_preferences, '{}'::jsonb))
  on conflict (organization_id) do update
  set preferences = public.organization_settings.preferences || coalesce(p_preferences, '{}'::jsonb),
      updated_at = now()
  returning preferences into v_merged;

  return v_merged;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ortho: revert adjustment + invoice from case
-- ---------------------------------------------------------------------------
alter table public.ortho_cases
  add column if not exists linked_invoice_id uuid references public.invoices(id) on delete set null;

create or replace function public.revert_ortho_adjustment(p_adjustment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj public.ortho_adjustments%rowtype;
  v_case public.ortho_cases%rowtype;
begin
  select * into v_adj from public.ortho_adjustments where id = p_adjustment_id;
  if not found then raise exception 'Adjustment not found'; end if;

  select * into v_case from public.ortho_cases where id = v_adj.case_id;
  if v_case.status <> 'active' then raise exception 'Case is closed'; end if;
  if not public.has_permission('dental_chart.write', v_case.branch_id) then
    raise exception 'Permission denied';
  end if;

  delete from public.ortho_adjustments where id = p_adjustment_id;

  update public.ortho_cases set updated_at = now(), updated_by = auth.uid() where id = v_case.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_case.organization_id, v_case.branch_id, auth.uid(),
    'ortho.adjustment_revert', 'ortho_case', v_case.id::text,
    jsonb_build_object('adjustment_id', p_adjustment_id, 'procedure', v_adj.procedure)
  );

  return public.calculate_ortho_balance(v_case.id);
end;
$$;

create or replace function public.create_invoice_from_ortho_case(p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.ortho_cases%rowtype;
  v_balance jsonb;
  v_balance_due numeric(12,2);
  v_invoice_id uuid;
  v_invoice_number text;
  v_description text;
begin
  select * into v_case from public.ortho_cases where id = p_case_id;
  if not found then raise exception 'Case not found'; end if;
  if not public.has_permission('billing.write', v_case.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_case.linked_invoice_id is not null then
    return jsonb_build_object('id', v_case.linked_invoice_id, 'existing', true);
  end if;

  v_balance := public.calculate_ortho_balance(p_case_id);
  v_balance_due := (v_balance->>'balance')::numeric;

  if v_balance_due <= 0 then
    raise exception 'No outstanding ortho balance to invoice';
  end if;

  v_invoice_number := 'ORTHO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_description := coalesce(
    'Orthodontic treatment — ' || nullif(trim(v_case.appliance_type), ''),
    'Orthodontic contract balance'
  );

  insert into public.invoices (
    organization_id, branch_id, patient_id,
    invoice_number, series, total_amount, subtotal_amount, status, created_by
  ) values (
    v_case.organization_id, v_case.branch_id, v_case.patient_id,
    v_invoice_number, 'ORTHO', 0, 0, 'draft', auth.uid()
  )
  returning id into v_invoice_id;

  perform public.add_invoice_line_item(
    v_invoice_id, v_description, v_balance_due, 1, null, null, null, 0
  );

  update public.ortho_cases
  set linked_invoice_id = v_invoice_id, updated_at = now(), updated_by = auth.uid()
  where id = p_case_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_case.organization_id, v_case.branch_id, auth.uid(),
    'ortho.invoice_create', 'invoice', v_invoice_id::text,
    jsonb_build_object('case_id', p_case_id, 'balance_due', v_balance_due)
  );

  return jsonb_build_object('id', v_invoice_id, 'invoice_number', v_invoice_number, 'existing', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Scanned consent upload (paper PDF/photo)
-- ---------------------------------------------------------------------------
create or replace function public.register_scanned_consent(
  p_consent_id uuid,
  p_storage_path text,
  p_file_size bigint default 0,
  p_content_type text default 'application/pdf'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
begin
  if p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception 'Storage path required';
  end if;

  select * into v_consent
  from public.patient_consents
  where id = p_consent_id and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then raise exception 'Consent not found'; end if;
  if v_consent.status = 'voided' then raise exception 'Cannot attach scan to voided consent'; end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set signed_pdf_path = p_storage_path,
      status = 'signed',
      signed_at = coalesce(signed_at, now()),
      signed_by = coalesce(signed_by, auth.uid())
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id, v_consent.branch_id, auth.uid(),
    'consent.scan_uploaded', 'patient_consent', p_consent_id::text,
    jsonb_build_object('storage_path', p_storage_path, 'file_size', p_file_size, 'content_type', p_content_type)
  );

  return jsonb_build_object('consent_id', p_consent_id, 'storage_path', p_storage_path);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Prescriptions
-- ---------------------------------------------------------------------------
insert into public.permissions (name, description) values
  ('prescriptions.read', 'View prescriptions'),
  ('prescriptions.write', 'Create and sign prescriptions')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin') and p.name in ('prescriptions.read', 'prescriptions.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'dentist' and p.name in ('prescriptions.read', 'prescriptions.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name in ('assistant', 'receptionist') and p.name = 'prescriptions.read'
on conflict do nothing;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescriber_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'signed', 'voided')),
  diagnosis text,
  general_instructions text,
  signed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prescriptions_patient on public.prescriptions(patient_id, created_at desc);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  drug_name text not null,
  strength text,
  dosage text,
  frequency text,
  duration text,
  quantity text,
  instructions text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_prescription_items_rx on public.prescription_items(prescription_id, sort_order);

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;

drop policy if exists prescriptions_select on public.prescriptions;
drop policy if exists prescriptions_write on public.prescriptions;
drop policy if exists prescription_items_select on public.prescription_items;
drop policy if exists prescription_items_write on public.prescription_items;

create policy prescriptions_select on public.prescriptions for select to authenticated using (
  organization_id = public.current_user_org_id()
  and public.user_has_branch_access(branch_id)
  and public.has_permission('prescriptions.read', branch_id)
);

create policy prescriptions_write on public.prescriptions for all to authenticated using (
  organization_id = public.current_user_org_id()
  and public.user_has_branch_access(branch_id)
  and public.has_permission('prescriptions.write', branch_id)
) with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('prescriptions.write', branch_id)
);

create policy prescription_items_select on public.prescription_items for select to authenticated using (
  exists (
    select 1 from public.prescriptions rx
    where rx.id = prescription_items.prescription_id
      and rx.organization_id = public.current_user_org_id()
      and public.has_permission('prescriptions.read', rx.branch_id)
  )
);

create policy prescription_items_write on public.prescription_items for all to authenticated using (
  exists (
    select 1 from public.prescriptions rx
    where rx.id = prescription_items.prescription_id
      and rx.status = 'draft'
      and public.has_permission('prescriptions.write', rx.branch_id)
  )
) with check (true);

create or replace function public.upsert_prescription_draft(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := coalesce((p_payload->>'organization_id')::uuid, public.current_user_org_id());
  v_item jsonb;
  v_sort int := 0;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;
  if not public.has_permission('prescriptions.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_id is null then
    insert into public.prescriptions (
      organization_id, branch_id, patient_id, prescriber_id,
      diagnosis, general_instructions, created_by
    ) values (
      v_org_id, v_branch_id, v_patient_id, auth.uid(),
      nullif(p_payload->>'diagnosis', ''),
      nullif(p_payload->>'general_instructions', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.prescriptions
    set diagnosis = nullif(p_payload->>'diagnosis', ''),
        general_instructions = nullif(p_payload->>'general_instructions', ''),
        updated_at = now()
    where id = v_id and status = 'draft' and organization_id = v_org_id;
    if not found then raise exception 'Draft prescription not found or not editable'; end if;
    delete from public.prescription_items where prescription_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
  loop
    v_sort := v_sort + 1;
    insert into public.prescription_items (
      prescription_id, drug_name, strength, dosage, frequency, duration, quantity, instructions, sort_order
    ) values (
      v_id,
      coalesce(v_item->>'drug_name', 'Medication'),
      nullif(v_item->>'strength', ''),
      nullif(v_item->>'dosage', ''),
      nullif(v_item->>'frequency', ''),
      nullif(v_item->>'duration', ''),
      nullif(v_item->>'quantity', ''),
      nullif(v_item->>'instructions', ''),
      v_sort
    );
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.sign_prescription(p_prescription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rx public.prescriptions%rowtype;
  v_item_count int;
begin
  select * into v_rx from public.prescriptions where id = p_prescription_id for update;
  if not found then raise exception 'Prescription not found'; end if;
  if v_rx.status <> 'draft' then raise exception 'Only draft prescriptions can be signed'; end if;
  if not public.has_permission('prescriptions.write', v_rx.branch_id) then
    raise exception 'Permission denied';
  end if;

  select count(*) into v_item_count from public.prescription_items where prescription_id = p_prescription_id;
  if v_item_count = 0 then raise exception 'Add at least one medication'; end if;

  update public.prescriptions
  set status = 'signed',
      prescriber_id = coalesce(prescriber_id, auth.uid()),
      signed_at = now(),
      updated_at = now()
  where id = p_prescription_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_rx.organization_id, v_rx.branch_id, auth.uid(),
    'prescription.sign', 'prescription', p_prescription_id::text,
    jsonb_build_object('patient_id', v_rx.patient_id, 'item_count', v_item_count)
  );

  return jsonb_build_object('id', p_prescription_id, 'status', 'signed');
end;
$$;

create or replace function public.void_prescription(p_prescription_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rx public.prescriptions%rowtype;
begin
  select * into v_rx from public.prescriptions where id = p_prescription_id for update;
  if not found then raise exception 'Prescription not found'; end if;
  if v_rx.status = 'voided' then raise exception 'Already voided'; end if;
  if not public.has_permission('prescriptions.write', v_rx.branch_id) then
    raise exception 'Permission denied';
  end if;

  update public.prescriptions
  set status = 'voided', voided_at = now(), void_reason = nullif(p_reason, ''), updated_at = now()
  where id = p_prescription_id;

  return jsonb_build_object('id', p_prescription_id, 'status', 'voided');
end;
$$;

-- Grants at end
grant execute on function public.assert_invoice_closeout_editable(uuid) to authenticated;
grant execute on function public.update_invoice_discount(uuid, numeric) to authenticated;
grant execute on function public.get_organization_preferences() to authenticated;
grant execute on function public.update_organization_preferences(jsonb) to authenticated;
grant execute on function public.revert_ortho_adjustment(uuid) to authenticated;
grant execute on function public.create_invoice_from_ortho_case(uuid) to authenticated;
grant execute on function public.register_scanned_consent(uuid, text, bigint, text) to authenticated;
grant execute on function public.upsert_prescription_draft(jsonb) to authenticated;
grant execute on function public.sign_prescription(uuid) to authenticated;
grant execute on function public.void_prescription(uuid, text) to authenticated;
