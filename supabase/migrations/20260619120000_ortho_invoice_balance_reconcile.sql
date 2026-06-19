-- Reconcile orthodontic contract balance with linked invoices.
-- Patient balance should not double-count an ortho contract once it has been
-- converted to an invoice. Invoice open balance carries the receivable.

create or replace function public.calculate_ortho_balance(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_case public.ortho_cases%rowtype;
  v_adjustment_paid numeric := 0;
  v_invoice_total numeric := 0;
  v_invoice_paid numeric := 0;
  v_total_paid numeric := 0;
  v_balance numeric := 0;
  v_uninvoiced_balance numeric := 0;
begin
  select * into v_case
  from public.ortho_cases
  where id = p_case_id;

  if not found then
    raise exception 'Case not found';
  end if;

  select coalesce(sum(payment_amount), 0)
  into v_adjustment_paid
  from public.ortho_adjustments
  where case_id = p_case_id;

  if v_case.linked_invoice_id is not null then
    select
      coalesce(total_amount, 0),
      coalesce(paid_amount, 0)
    into v_invoice_total, v_invoice_paid
    from public.invoices
    where id = v_case.linked_invoice_id
      and status <> 'void';
  end if;

  v_total_paid := v_adjustment_paid + coalesce(v_invoice_paid, 0);
  v_balance := greatest(v_case.contract_amount - v_total_paid, 0);
  v_uninvoiced_balance := greatest(v_case.contract_amount - v_adjustment_paid - coalesce(v_invoice_total, 0), 0);

  return jsonb_build_object(
    'contract_amount', v_case.contract_amount,
    'adjustment_paid', v_adjustment_paid,
    'invoice_total', coalesce(v_invoice_total, 0),
    'invoice_paid', coalesce(v_invoice_paid, 0),
    'total_paid', v_total_paid,
    'balance', v_balance,
    'uninvoiced_balance', v_uninvoiced_balance
  );
end;
$$;

create or replace function public.get_patient_balance(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_invoice_open numeric := 0;
  v_total_billed numeric := 0;
  v_total_paid numeric := 0;
  v_open_count bigint := 0;
  v_ortho_open numeric := 0;
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
    count(*) filter (where inv.status in ('draft', 'sent', 'partial') and inv.total_amount > inv.paid_amount)
  into v_invoice_open, v_total_billed, v_total_paid, v_open_count
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_patient.organization_id
    and inv.status <> 'void';

  select coalesce(sum(greatest(
    oc.contract_amount
      - coalesce((
          select sum(oa.payment_amount)
          from public.ortho_adjustments oa
          where oa.case_id = oc.id
        ), 0)
      - coalesce((
          select inv.total_amount
          from public.invoices inv
          where inv.id = oc.linked_invoice_id
            and inv.status <> 'void'
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

create or replace function public._assert_patient_billing_clear(
  p_patient_id uuid,
  p_branch_id uuid,
  p_force boolean default false,
  p_context text default 'service'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_invoice_open numeric := 0;
  v_ortho_open numeric := 0;
  v_overdue_open numeric := 0;
  v_missing bigint := 0;
  v_soft_context boolean := p_context in (
    'check_in', 'appointment_check_in', 'kiosk_check_in', 'appointment_book'
  );
  v_meaningful_threshold numeric := 5000;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if p_force then
    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    )
    select
      p.organization_id,
      p_branch_id,
      auth.uid(),
      'billing.gate_override',
      'patient',
      p_patient_id::text,
      jsonb_build_object('context', p_context)
    from public.patients p
    where p.id = p_patient_id;
    return;
  end if;

  if not public._workflow_enabled(p_branch_id, 'billing_gate_block_services') then
    return;
  end if;

  select p.organization_id into v_org
  from public.patients p
  where p.id = p_patient_id
    and p.organization_id = public.current_user_org_id();

  if v_org is null then
    raise exception 'Patient not found';
  end if;

  select coalesce(sum(greatest(inv.total_amount - inv.paid_amount, 0)), 0)
  into v_invoice_open
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_org
    and inv.status <> 'void';

  select coalesce(sum(greatest(
    oc.contract_amount
      - coalesce((
          select sum(oa.payment_amount)
          from public.ortho_adjustments oa
          where oa.case_id = oc.id
        ), 0)
      - coalesce((
          select inv.total_amount
          from public.invoices inv
          where inv.id = oc.linked_invoice_id
            and inv.status <> 'void'
        ), 0),
    0
  )), 0)
  into v_ortho_open
  from public.ortho_cases oc
  where oc.patient_id = p_patient_id
    and oc.organization_id = v_org
    and oc.status = 'active';

  if v_soft_context then
    select coalesce(sum(greatest(inv.total_amount - inv.paid_amount, 0)), 0)
    into v_overdue_open
    from public.invoices inv
    where inv.patient_id = p_patient_id
      and inv.organization_id = v_org
      and inv.status <> 'void'
      and inv.due_date is not null
      and inv.due_date < v_today
      and (inv.total_amount - inv.paid_amount) > 0;

    if v_overdue_open > 0 or (v_invoice_open + v_ortho_open) >= v_meaningful_threshold then
      raise exception
        'Billing clearance required: overdue balance or significant outstanding amount. Use billing override to continue (logged).';
    end if;
    return;
  end if;

  select count(*) into v_missing
  from public.treatment_plans tp
  where tp.patient_id = p_patient_id
    and tp.organization_id = v_org
    and tp.status in ('approved', 'in_progress')
    and exists (
      select 1 from public.treatment_plan_items i
      where i.plan_id = tp.id and i.status <> 'cancelled'
    )
    and not exists (
      select 1 from public.invoices inv
      where inv.treatment_plan_id = tp.id and inv.status <> 'void'
    );

  if v_missing > 0 or (v_invoice_open + v_ortho_open) > 0 then
    raise exception
      'Billing clearance required: collect outstanding balance or create missing plan invoice before proceeding. Use billing override to continue (logged).';
  end if;
end;
$$;

grant execute on function public.calculate_ortho_balance(uuid) to authenticated;
grant execute on function public.get_patient_balance(uuid) to authenticated;
