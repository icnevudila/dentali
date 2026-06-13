-- Module 20: Patient balance RPC

create or replace function public.get_patient_balance(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient record;
  v_open_balance numeric;
  v_total_billed numeric;
  v_total_paid numeric;
  v_open_count bigint;
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
  into v_open_balance, v_total_billed, v_total_paid, v_open_count
  from public.invoices inv
  where inv.patient_id = p_patient_id
    and inv.organization_id = v_patient.organization_id
    and inv.status <> 'void';

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'open_balance', v_open_balance,
    'total_billed', v_total_billed,
    'total_paid', v_total_paid,
    'open_invoice_count', v_open_count
  );
end;
$$;

grant execute on function public.get_patient_balance(uuid) to authenticated;
