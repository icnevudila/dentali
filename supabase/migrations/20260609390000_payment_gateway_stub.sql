-- Module 20: Payment gateway stub (GCash / PayMongo)

create table if not exists public.payment_gateway_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null check (provider in ('gcash', 'paymongo')),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'expired')),
  external_ref text not null,
  checkout_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_intents_invoice
  on public.payment_gateway_intents(invoice_id, created_at desc);

alter table public.payment_gateway_intents enable row level security;

create policy payment_intents_select on public.payment_gateway_intents
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  );

create policy payment_intents_insert on public.payment_gateway_intents
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.write', branch_id)
  );

create policy payment_intents_update on public.payment_gateway_intents
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.write', branch_id)
  );

create or replace function public.create_payment_intent(
  p_invoice_id uuid,
  p_provider text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_ref text;
  v_url text;
  v_intent_id uuid;
begin
  select i.id, i.organization_id, i.branch_id, i.total_amount, i.paid_amount, i.status
  into v_inv
  from public.invoices i
  where i.id = p_invoice_id;

  if v_inv.id is null then
    raise exception 'Invoice not found';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Cannot pay void invoice';
  end if;

  if p_amount <= 0 or p_amount > (v_inv.total_amount - v_inv.paid_amount) then
    raise exception 'Invalid amount';
  end if;

  if p_provider not in ('gcash', 'paymongo') then
    raise exception 'Unsupported provider';
  end if;

  v_ref := upper(p_provider) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_url := 'https://checkout.stub.ph-dental.local/' || lower(p_provider) || '/' || v_ref;

  insert into public.payment_gateway_intents (
    organization_id, branch_id, invoice_id, provider, amount,
    external_ref, checkout_url, created_by
  ) values (
    v_inv.organization_id, v_inv.branch_id, p_invoice_id, p_provider, p_amount,
    v_ref, v_url, auth.uid()
  )
  returning id into v_intent_id;

  return jsonb_build_object(
    'id', v_intent_id,
    'provider', p_provider,
    'amount', p_amount,
    'status', 'pending',
    'external_ref', v_ref,
    'checkout_url', v_url
  );
end;
$$;

create or replace function public.complete_payment_intent(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_payment jsonb;
begin
  select *
  into v_intent
  from public.payment_gateway_intents
  where id = p_intent_id
  for update;

  if v_intent.id is null then
    raise exception 'Intent not found';
  end if;

  if not public.has_permission('billing.write', v_intent.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'Intent is not pending';
  end if;

  v_payment := public.record_invoice_payment(
    v_intent.invoice_id,
    v_intent.amount,
    v_intent.provider,
    'Online payment via ' || v_intent.provider || ' (' || v_intent.external_ref || ')'
  );

  update public.payment_gateway_intents
  set status = 'completed', completed_at = now()
  where id = p_intent_id;

  return v_payment || jsonb_build_object('intent_id', p_intent_id);
end;
$$;

grant execute on function public.create_payment_intent(uuid, text, numeric) to authenticated;
grant execute on function public.complete_payment_intent(uuid) to authenticated;
