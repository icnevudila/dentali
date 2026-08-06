-- P0: PayMongo webhook payment completion without auth.uid / staff permissions.
-- Staff Mark paid continues to use complete_payment_intent → record_invoice_payment.
-- Follow-up (out of scope): migrate money columns to bigint minor units.

-- ---------------------------------------------------------------------------
-- Webhook / service-role completion (no has_permission / current_user_org_id)
-- ---------------------------------------------------------------------------
create or replace function public.complete_payment_intent_webhook(
  p_external_ref text,
  p_provider text default 'paymongo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_inv record;
  v_amount numeric;
  v_new_paid numeric;
  v_new_status text;
  v_balance numeric;
  v_encounter_closed boolean := false;
  v_provider_id uuid;
  v_rate numeric;
  v_commission numeric;
begin
  if p_external_ref is null or btrim(p_external_ref) = '' then
    raise exception 'Missing payment reference';
  end if;

  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'Missing provider';
  end if;

  select *
  into v_intent
  from public.payment_gateway_intents
  where external_ref = p_external_ref
    and provider = p_provider
  for update;

  if v_intent.id is null then
    raise exception 'Payment intent not found';
  end if;

  if v_intent.status = 'completed' then
    return jsonb_build_object(
      'status', v_intent.status,
      'intent_id', v_intent.id,
      'invoice_id', v_intent.invoice_id,
      'already_completed', true
    );
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'Payment intent is not pending';
  end if;

  -- Lock invoice to serialize concurrent webhook / staff payment writes.
  select *
  into v_inv
  from public.invoices
  where id = v_intent.invoice_id
    and organization_id = v_intent.organization_id
  for update;

  if v_inv.id is null then
    raise exception 'Invoice not found for payment intent';
  end if;

  if v_inv.organization_id is distinct from v_intent.organization_id
     or v_inv.branch_id is distinct from v_intent.branch_id then
    raise exception 'Payment intent org/branch mismatch';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Cannot pay void invoice';
  end if;

  v_balance := greatest(coalesce(v_inv.total_amount, 0) - coalesce(v_inv.paid_amount, 0), 0);
  if v_balance <= 0 then
    -- Idempotent-ish: mark intent completed without double-writing ledger.
    update public.payment_gateway_intents
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'webhook_completed', true,
          'skipped_ledger', true,
          'reason', 'invoice_already_paid'
        )
    where id = v_intent.id;

    insert into public.organization_audit_logs
      (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
    values (
      v_intent.organization_id,
      v_intent.branch_id,
      null,
      'payment.webhook_complete',
      'invoice',
      v_intent.invoice_id::text,
      jsonb_build_object(
        'intent_id', v_intent.id,
        'provider', v_intent.provider,
        'amount', v_intent.amount,
        'skipped_ledger', true,
        'reason', 'invoice_already_paid'
      )
    );

    return jsonb_build_object(
      'paid_amount', v_inv.paid_amount,
      'status', v_inv.status,
      'balance', 0,
      'intent_id', v_intent.id,
      'already_paid', true
    );
  end if;

  v_amount := least(v_intent.amount, v_balance);
  if v_amount <= 0 then
    raise exception 'Invalid payment amount';
  end if;

  v_new_paid := coalesce(v_inv.paid_amount, 0) + v_amount;
  if v_new_paid >= v_inv.total_amount then
    v_new_status := 'paid';
    v_new_paid := v_inv.total_amount;
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := v_inv.status;
  end if;

  insert into public.invoice_payments (
    invoice_id, organization_id, amount, payment_method, notes, recorded_by
  ) values (
    v_intent.invoice_id,
    v_intent.organization_id,
    v_amount,
    v_intent.provider,
    'Webhook payment via ' || v_intent.provider,
    null
  );

  update public.invoices
  set paid_amount = v_new_paid,
      status = v_new_status,
      updated_at = now()
  where id = v_intent.invoice_id;

  if v_new_status = 'paid'
    and v_inv.encounter_id is not null
    and public._workflow_enabled(v_inv.branch_id, 'auto_close_encounter_on_payment') then
    v_encounter_closed := public._close_encounter_automation(v_inv.encounter_id);
  end if;

  -- Commission: appointment provider → else invoice creator, if rate > 0
  v_provider_id := null;
  if v_inv.encounter_id is not null then
    select a.provider_id into v_provider_id
    from public.patient_encounters pe
    join public.appointments a on a.id = pe.appointment_id
    where pe.id = v_inv.encounter_id
    limit 1;
  end if;

  if v_provider_id is null then
    v_provider_id := v_inv.created_by;
  end if;

  if v_provider_id is not null then
    select coalesce(sp.commission_rate, 0) into v_rate
    from public.staff_profiles sp
    where sp.profile_id = v_provider_id;

    if coalesce(v_rate, 0) > 0 then
      v_commission := round(v_amount * v_rate / 100.0, 2);
      if v_commission > 0 then
        insert into public.provider_commissions (
          organization_id, branch_id, provider_id, invoice_id, amount
        ) values (
          v_inv.organization_id, v_inv.branch_id, v_provider_id, v_intent.invoice_id, v_commission
        );
      end if;
    end if;
  end if;

  update public.payment_gateway_intents
  set status = 'completed',
      completed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'webhook_completed', true,
        'applied_amount', v_amount
      )
  where id = v_intent.id;

  perform public._sync_ortho_balance_for_invoice(v_intent.invoice_id);

  insert into public.workflow_events (
    organization_id, branch_id, event_type, entity_type, entity_id, payload
  ) values (
    v_intent.organization_id,
    v_intent.branch_id,
    'payment.completed',
    'invoice',
    v_intent.invoice_id::text,
    jsonb_build_object(
      'intent_id', v_intent.id,
      'amount', v_amount,
      'provider', v_intent.provider,
      'source', 'webhook'
    )
  );

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (
    v_intent.organization_id,
    v_intent.branch_id,
    null,
    'payment.webhook_complete',
    'invoice',
    v_intent.invoice_id::text,
    jsonb_build_object(
      'intent_id', v_intent.id,
      'provider', v_intent.provider,
      'amount', v_amount,
      'status', v_new_status,
      'commission', v_commission,
      'provider_id', v_provider_id
    )
  );

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'status', v_new_status,
    'balance', v_inv.total_amount - v_new_paid,
    'intent_id', v_intent.id,
    'invoice_id', v_intent.invoice_id,
    'applied_amount', v_amount,
    'encounter_closed', v_encounter_closed,
    'commission_amount', v_commission,
    'commission_provider_id', v_provider_id
  );
end;
$$;

revoke all on function public.complete_payment_intent_webhook(text, text) from public;
revoke all on function public.complete_payment_intent_webhook(text, text) from anon, authenticated;
grant execute on function public.complete_payment_intent_webhook(text, text) to service_role;

comment on function public.complete_payment_intent_webhook(text, text) is
  'Service-role only. Completes a gateway intent from webhook HMAC path without auth.uid permission checks.';

-- Keep legacy name as a thin wrapper for existing callers / docs.
create or replace function public.complete_payment_intent_by_ref(
  p_external_ref text,
  p_provider text default 'paymongo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.complete_payment_intent_webhook(p_external_ref, p_provider);
end;
$$;

revoke all on function public.complete_payment_intent_by_ref(text, text) from public;
revoke all on function public.complete_payment_intent_by_ref(text, text) from anon, authenticated;
grant execute on function public.complete_payment_intent_by_ref(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Staff Mark paid: block live PayMongo intents (webhook must complete them)
-- ---------------------------------------------------------------------------
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

  if coalesce(v_intent.metadata->>'mode', '') = 'live' then
    raise exception 'Live gateway payments must complete via webhook';
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

grant execute on function public.complete_payment_intent(uuid) to authenticated;
