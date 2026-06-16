-- Fix: two overloads of add_invoice_line_item (7-arg vs 8-arg with discount default)
-- caused "function ... is not unique" when approving treatment plans.

drop function if exists public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid);

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

grant execute on function public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid, numeric) to authenticated;

-- Explicit 8-arg calls avoid ambiguity in nested PL/pgSQL even during rollout.
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
      1::numeric,
      v_item.tooth_number,
      v_item.procedure_id,
      v_item.id,
      0::numeric
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
