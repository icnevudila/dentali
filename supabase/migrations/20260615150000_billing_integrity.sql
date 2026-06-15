-- Billing integrity: plan → invoice always, lock approved plans, unified patient balance

-- Block treatment plan item changes after approval (charges go through invoice)
create or replace function public.guard_treatment_plan_items_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select tp.status
  into v_status
  from public.treatment_plans tp
  where tp.id = coalesce(NEW.plan_id, OLD.plan_id);

  if v_status in ('approved', 'in_progress', 'completed') then
    raise exception 'Cannot modify items on an approved treatment plan. Update the linked invoice in Billing instead.';
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_guard_treatment_plan_items on public.treatment_plan_items;
create trigger trg_guard_treatment_plan_items
  before insert or update or delete on public.treatment_plan_items
  for each row execute function public.guard_treatment_plan_items_mutation();

-- Approve plan → always create draft invoice (workflow flag only gates HMO automation)
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

  v_invoice_id := public._create_invoice_draft_from_plan(p_plan_id);

  if public._workflow_enabled(v_plan.branch_id, 'auto_hmo_claim_on_invoice') and v_invoice_id is not null then
    v_claim_id := public._auto_hmo_claim_for_invoice(v_invoice_id);
  end if;

  if public._workflow_enabled(v_plan.branch_id, 'auto_approve_creates_invoice') then
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

-- Unified patient balance: invoices + active ortho contract remainder
create or replace function public.get_patient_balance(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_invoice_open numeric;
  v_total_billed numeric;
  v_total_paid numeric;
  v_open_count bigint;
  v_ortho_open numeric;
begin
  select p.id, p.organization_id
  into v_patient
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_patient.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.has_permission('billing.read', (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  )) then
    raise exception 'Permission denied';
  end if;

  select
    coalesce(sum(greatest(inv.total_amount - inv.paid_amount, 0)), 0),
    coalesce(sum(inv.total_amount), 0),
    coalesce(sum(inv.paid_amount), 0),
    count(*) filter (where inv.status in ('draft', 'sent', 'partial'))
  into v_invoice_open, v_total_billed, v_total_paid, v_open_count
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_patient.organization_id
    and inv.status <> 'void';

  select coalesce(sum(greatest(
    oc.contract_amount - coalesce((
      select sum(oa.payment_amount)
      from public.ortho_adjustments oa
      where oa.case_id = oc.id
    ), 0),
    0
  )), 0)
  into v_ortho_open
  from public.ortho_cases oc
  where oc.patient_id = p_patient_id
    and oc.organization_id = v_patient.organization_id
    and oc.status = 'active';

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'open_balance', v_invoice_open + v_ortho_open,
    'invoice_open_balance', v_invoice_open,
    'ortho_open_balance', v_ortho_open,
    'total_billed', v_total_billed,
    'total_paid', v_total_paid,
    'open_invoice_count', v_open_count
  );
end;
$$;

-- Staff billing gate: surface gaps before checkout
create or replace function public.get_patient_billing_gate(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_balance jsonb;
  v_missing jsonb;
  v_primary_invoice uuid;
begin
  select p.id, p.organization_id
  into v_patient
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_patient.id is null then
    raise exception 'Patient not found';
  end if;

  if not public.has_permission('billing.read', (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  )) then
    raise exception 'Permission denied';
  end if;

  v_balance := public.get_patient_balance(p_patient_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'plan_id', tp.id,
    'title', tp.title,
    'total_estimated', tp.total_estimated
  ) order by tp.approved_at desc nulls last), '[]'::jsonb)
  into v_missing
  from public.treatment_plans tp
  where tp.patient_id = p_patient_id
    and tp.organization_id = v_patient.organization_id
    and tp.status in ('approved', 'in_progress')
    and exists (
      select 1 from public.treatment_plan_items i
      where i.plan_id = tp.id and i.status <> 'cancelled'
    )
    and not exists (
      select 1 from public.invoices inv
      where inv.treatment_plan_id = tp.id and inv.status <> 'void'
    );

  select inv.id
  into v_primary_invoice
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_patient.organization_id
    and inv.status in ('draft', 'sent', 'partial')
    and inv.total_amount > inv.paid_amount
  order by
    case inv.status when 'draft' then 0 when 'partial' then 1 else 2 end,
    inv.created_at desc
  limit 1;

  return v_balance || jsonb_build_object(
    'approved_plans_missing_invoice', v_missing,
    'primary_open_invoice_id', v_primary_invoice,
    'has_billing_gap', (
      jsonb_array_length(v_missing) > 0
      or (v_balance->>'open_balance')::numeric > 0
    ),
    'can_checkout', (
      jsonb_array_length(v_missing) = 0
      and (v_balance->>'open_balance')::numeric <= 0
    )
  );
end;
$$;

grant execute on function public.get_patient_billing_gate(uuid) to authenticated;
