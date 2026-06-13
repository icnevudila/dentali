-- Wave 4: Invoice payments ledger

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_invoice_payments_invoice on public.invoice_payments(invoice_id);

alter table public.invoice_payments enable row level security;

create policy invoice_payments_org on public.invoice_payments for all using (
  organization_id = public.current_user_org_id()
);

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv record;
  v_new_paid numeric;
  v_new_status text;
  v_org uuid := public.current_user_org_id();
begin
  select * into v_inv from public.invoices
  where id = p_invoice_id and organization_id = v_org;

  if not found then
    raise exception 'Invoice not found';
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

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'status', v_new_status,
    'balance', v_inv.total_amount - v_new_paid
  );
end;
$$;
