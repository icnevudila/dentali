-- Billing mutation RPCs: guarded line-item updates and payment deletion with audit

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

  update public.invoices
  set paid_amount = v_paid,
      status = v_new_status,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.update_invoice_line_item(
  p_item_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1
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
  if not found then
    raise exception 'Line item not found';
  end if;

  select * into v_inv from public.invoices where id = v_item.invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_inv.status in ('void', 'paid') then
    raise exception 'Cannot edit line items on a % invoice', v_inv.status;
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required';
  end if;

  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  if coalesce(p_unit_price, 0) < 0 then
    raise exception 'Unit price cannot be negative';
  end if;

  v_line_total := round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0), 2);

  update public.invoice_line_items
  set description = trim(p_description),
      unit_price = coalesce(p_unit_price, 0),
      quantity = coalesce(p_quantity, 1),
      line_total = v_line_total
  where id = p_item_id;

  perform public._sync_invoice_payment_status(v_item.invoice_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id, v_inv.branch_id, auth.uid(),
    'invoice.line_item_update', 'invoice', v_inv.id::text,
    jsonb_build_object(
      'line_item_id', p_item_id,
      'description', trim(p_description),
      'unit_price', coalesce(p_unit_price, 0),
      'quantity', coalesce(p_quantity, 1),
      'invoice_number', v_inv.invoice_number
    )
  );

  return jsonb_build_object('invoice_id', v_inv.id, 'line_item_id', p_item_id);
end;
$$;

create or replace function public.delete_invoice_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.invoice_payments%rowtype;
  v_inv public.invoices%rowtype;
begin
  select * into v_payment from public.invoice_payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  select * into v_inv from public.invoices where id = v_payment.invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Cannot delete payments on a void invoice';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  delete from public.invoice_payments where id = p_payment_id;

  perform public._sync_invoice_payment_status(v_payment.invoice_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id, v_inv.branch_id, auth.uid(),
    'invoice.payment_delete', 'invoice', v_inv.id::text,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'amount', v_payment.amount,
      'payment_method', v_payment.payment_method,
      'invoice_number', v_inv.invoice_number
    )
  );

  return jsonb_build_object('invoice_id', v_inv.id, 'payment_id', p_payment_id);
end;
$$;

grant execute on function public.update_invoice_line_item(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.delete_invoice_payment(uuid) to authenticated;
