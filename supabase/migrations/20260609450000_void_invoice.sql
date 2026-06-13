-- Module 20: Void invoice RPC

create or replace function public.void_invoice(
  p_invoice_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select *
  into v_inv
  from public.invoices
  where id = p_invoice_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_inv.id is null then
    raise exception 'Invoice not found';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Invoice is already void';
  end if;

  if coalesce(v_inv.paid_amount, 0) > 0 then
    raise exception 'Cannot void invoice with recorded payments';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Void reason is required';
  end if;

  update public.invoices
  set status = 'void', updated_at = now()
  where id = p_invoice_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id,
    v_inv.branch_id,
    auth.uid(),
    'invoice.voided',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'reason', trim(p_reason),
      'invoice_number', v_inv.invoice_number,
      'total_amount', v_inv.total_amount
    )
  );

  return jsonb_build_object(
    'id', p_invoice_id,
    'status', 'void',
    'reason', trim(p_reason)
  );
end;
$$;

grant execute on function public.void_invoice(uuid, text) to authenticated;
