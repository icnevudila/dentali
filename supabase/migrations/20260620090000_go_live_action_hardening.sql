-- Go-live action hardening: transactional writes, explicit permissions, and audit coverage.

drop policy if exists os_update on public.organization_settings;
create policy os_update on public.organization_settings
  for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists ch_update on public.clinic_hours;
create policy ch_update on public.clinic_hours
  for update to authenticated
  using (
    public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  )
  with check (
    public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );

create or replace function public.update_clinic_hour_guarded(
  p_hour_id uuid,
  p_open_time time default null,
  p_close_time time default null,
  p_is_closed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour public.clinic_hours%rowtype;
  v_org uuid := public.current_user_org_id();
begin
  select * into v_hour from public.clinic_hours where id = p_hour_id for update;
  if not found then raise exception 'Clinic hour not found'; end if;
  if not public.has_permission('settings.manage', v_hour.branch_id) then
    raise exception 'Permission denied';
  end if;
  if not p_is_closed and (p_open_time is null or p_close_time is null or p_open_time >= p_close_time) then
    raise exception 'Opening time must be before closing time';
  end if;

  update public.clinic_hours
  set open_time = case when p_is_closed then null else p_open_time end,
      close_time = case when p_is_closed then null else p_close_time end,
      is_closed = p_is_closed
  where id = p_hour_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values
    (v_org, v_hour.branch_id, auth.uid(), 'clinic_hours.update', 'clinic_hours', p_hour_id::text,
     jsonb_build_object('open_time', p_open_time, 'close_time', p_close_time, 'is_closed', p_is_closed));

  return jsonb_build_object('id', p_hour_id, 'updated', true);
end;
$$;

create or replace function public.create_lab_case_guarded(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_branch uuid := (p_payload->>'branch_id')::uuid;
  v_patient uuid := (p_payload->>'patient_id')::uuid;
  v_id uuid;
begin
  if v_org is null then raise exception 'Not authenticated'; end if;
  if not public.has_permission('dental_chart.write', v_branch) then raise exception 'Permission denied'; end if;
  if not exists (select 1 from public.patients where id = v_patient and organization_id = v_org) then
    raise exception 'Patient not found';
  end if;
  if trim(coalesce(p_payload->>'lab_name', '')) = '' or trim(coalesce(p_payload->>'case_type', '')) = '' then
    raise exception 'Lab name and case type are required';
  end if;

  insert into public.lab_cases (
    organization_id, branch_id, patient_id, provider_id, lab_name, case_type,
    sent_date, expected_date, status, cost, notes
  ) values (
    v_org, v_branch, v_patient, nullif(p_payload->>'provider_id', '')::uuid,
    trim(p_payload->>'lab_name'), trim(p_payload->>'case_type'),
    (p_payload->>'sent_date')::date, nullif(p_payload->>'expected_date', '')::date,
    'pending', coalesce(nullif(p_payload->>'cost', '')::numeric, 0), nullif(trim(p_payload->>'notes'), '')
  ) returning id into v_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_org, v_branch, auth.uid(), 'lab_case.create', 'lab_case', v_id::text,
    jsonb_build_object('patient_id', v_patient, 'case_type', p_payload->>'case_type'));

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.update_lab_case_status_guarded(p_case_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.lab_cases%rowtype;
begin
  if p_status not in ('pending', 'received', 'cancelled') then raise exception 'Invalid lab status'; end if;
  select * into v_case from public.lab_cases where id = p_case_id for update;
  if not found then raise exception 'Lab case not found'; end if;
  if not public.has_permission('dental_chart.write', v_case.branch_id) then raise exception 'Permission denied'; end if;

  update public.lab_cases
  set status = p_status,
      received_date = case when p_status = 'received' then coalesce(received_date, current_date) else received_date end,
      updated_at = now()
  where id = p_case_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_case.organization_id, v_case.branch_id, auth.uid(), 'lab_case.status', 'lab_case', p_case_id::text,
    jsonb_build_object('from', v_case.status, 'to', p_status));

  return jsonb_build_object('id', p_case_id, 'status', p_status);
end;
$$;

create or replace function public.set_notification_dry_run_guarded(p_branch_id uuid, p_dry_run boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('notifications.write', p_branch_id) then raise exception 'Permission denied'; end if;
  if not exists (select 1 from public.branches where id = p_branch_id and organization_id = v_org) then
    raise exception 'Branch not found';
  end if;

  insert into public.notification_branch_settings (branch_id, organization_id, dry_run_mode, updated_at)
  values (p_branch_id, v_org, p_dry_run, now())
  on conflict (branch_id) do update
  set dry_run_mode = excluded.dry_run_mode, updated_at = now();

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_org, p_branch_id, auth.uid(), 'notifications.dry_run.update', 'branch', p_branch_id::text,
    jsonb_build_object('dry_run_mode', p_dry_run));
  return jsonb_build_object('branch_id', p_branch_id, 'dry_run_mode', p_dry_run);
end;
$$;

create or replace function public.upsert_procedure_bom_line_guarded(
  p_procedure_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_branch uuid;
  v_id uuid;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  select branch_id into v_branch from public.inventory_items
  where id = p_inventory_item_id and organization_id = v_org;
  if v_branch is null or not public.has_permission('settings.manage', v_branch) then
    raise exception 'Permission denied';
  end if;
  if not exists (select 1 from public.procedures where id = p_procedure_id and organization_id = v_org) then
    raise exception 'Procedure not found';
  end if;

  insert into public.procedure_bom_lines (organization_id, procedure_id, inventory_item_id, quantity)
  values (v_org, p_procedure_id, p_inventory_item_id, p_quantity)
  on conflict (procedure_id, inventory_item_id) do update set quantity = excluded.quantity
  returning id into v_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_org, v_branch, auth.uid(), 'procedure_bom.upsert', 'procedure_bom_line', v_id::text,
    jsonb_build_object('procedure_id', p_procedure_id, 'inventory_item_id', p_inventory_item_id, 'quantity', p_quantity));

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.delete_procedure_bom_line_guarded(p_line_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
begin
  select bl.*, i.branch_id into v_line
  from public.procedure_bom_lines bl
  join public.inventory_items i on i.id = bl.inventory_item_id
  where bl.id = p_line_id;
  if v_line.id is null then raise exception 'BOM line not found'; end if;
  if not public.has_permission('settings.manage', v_line.branch_id) then raise exception 'Permission denied'; end if;

  delete from public.procedure_bom_lines where id = p_line_id;
  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_line.organization_id, v_line.branch_id, auth.uid(), 'procedure_bom.delete', 'procedure_bom_line', p_line_id::text,
    jsonb_build_object('procedure_id', v_line.procedure_id, 'inventory_item_id', v_line.inventory_item_id));
  return jsonb_build_object('id', p_line_id, 'deleted', true);
end;
$$;

create or replace function public.create_plan_invoice_guarded(p_plan_id uuid, p_series text default 'INV')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_invoice_id uuid;
  v_existing uuid;
  v_number text;
  v_item record;
begin
  select * into v_plan from public.treatment_plans where id = p_plan_id for update;
  if not found then raise exception 'Treatment plan not found'; end if;
  if not public.has_permission('billing.write', v_plan.branch_id) then raise exception 'Permission denied'; end if;
  select id into v_existing from public.invoices
  where treatment_plan_id = p_plan_id and status <> 'void'
  order by created_at desc limit 1;
  if v_existing is not null then return jsonb_build_object('id', v_existing, 'existing', true); end if;

  v_number := coalesce(nullif(trim(p_series), ''), 'INV') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invoices (
    organization_id, branch_id, patient_id, treatment_plan_id, invoice_number,
    series, total_amount, status, created_by
  ) values (
    v_plan.organization_id, v_plan.branch_id, v_plan.patient_id, p_plan_id, v_number,
    coalesce(nullif(trim(p_series), ''), 'INV'), 0, 'draft', auth.uid()
  ) returning id into v_invoice_id;

  for v_item in
    select * from public.treatment_plan_items
    where plan_id = p_plan_id and status <> 'cancelled' order by created_at
  loop
    perform public.add_invoice_line_item(
      v_invoice_id, v_item.description, coalesce(v_item.estimated_price, 0), 1,
      v_item.tooth_number, v_item.procedure_id, v_item.id, 0
    );
  end loop;
  if not exists (select 1 from public.invoice_line_items where invoice_id = v_invoice_id) then
    perform public.add_invoice_line_item(v_invoice_id, 'Treatment plan services', 0, 1, null, null, null, 0);
  end if;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_plan.organization_id, v_plan.branch_id, auth.uid(), 'invoice.create_from_plan', 'invoice', v_invoice_id::text,
    jsonb_build_object('treatment_plan_id', p_plan_id));
  return jsonb_build_object('id', v_invoice_id, 'existing', false);
end;
$$;

create or replace function public.resync_draft_invoice_from_plan_guarded(p_invoice_id uuid, p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_item record;
  v_count int := 0;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status <> 'draft' or v_inv.treatment_plan_id is distinct from p_plan_id then
    raise exception 'Only the linked draft invoice can be resynced';
  end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then raise exception 'Permission denied'; end if;

  delete from public.invoice_line_items where invoice_id = p_invoice_id;
  for v_item in
    select * from public.treatment_plan_items
    where plan_id = p_plan_id and status <> 'cancelled' order by created_at
  loop
    perform public.add_invoice_line_item(
      p_invoice_id, v_item.description, coalesce(v_item.estimated_price, 0), 1,
      v_item.tooth_number, v_item.procedure_id, v_item.id, 0
    );
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then
    perform public.add_invoice_line_item(p_invoice_id, 'Treatment plan services', 0, 1, null, null, null, 0);
  end if;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_inv.organization_id, v_inv.branch_id, auth.uid(), 'invoice.resync_from_plan', 'invoice', p_invoice_id::text,
    jsonb_build_object('treatment_plan_id', p_plan_id, 'line_count', v_count));
  return jsonb_build_object('id', p_invoice_id, 'line_count', v_count);
end;
$$;

revoke all on function public.update_clinic_hour_guarded(uuid, time, time, boolean) from public;
revoke all on function public.create_lab_case_guarded(jsonb) from public;
revoke all on function public.update_lab_case_status_guarded(uuid, text) from public;
revoke all on function public.set_notification_dry_run_guarded(uuid, boolean) from public;
revoke all on function public.upsert_procedure_bom_line_guarded(uuid, uuid, numeric) from public;
revoke all on function public.delete_procedure_bom_line_guarded(uuid) from public;
revoke all on function public.create_plan_invoice_guarded(uuid, text) from public;
revoke all on function public.resync_draft_invoice_from_plan_guarded(uuid, uuid) from public;

grant execute on function public.update_clinic_hour_guarded(uuid, time, time, boolean) to authenticated;
grant execute on function public.create_lab_case_guarded(jsonb) to authenticated;
grant execute on function public.update_lab_case_status_guarded(uuid, text) to authenticated;
grant execute on function public.set_notification_dry_run_guarded(uuid, boolean) to authenticated;
grant execute on function public.upsert_procedure_bom_line_guarded(uuid, uuid, numeric) to authenticated;
grant execute on function public.delete_procedure_bom_line_guarded(uuid) to authenticated;
grant execute on function public.create_plan_invoice_guarded(uuid, text) to authenticated;
grant execute on function public.resync_draft_invoice_from_plan_guarded(uuid, uuid) to authenticated;

-- Demo seeding is a staging/admin operation, never an authenticated application action.
revoke all on function public.seed_demo_showcase_data(uuid) from public;
revoke all on function public.seed_demo_showcase_data(uuid) from authenticated;
grant execute on function public.seed_demo_showcase_data(uuid) to service_role;
