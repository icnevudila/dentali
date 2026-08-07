-- P0 billing security follow-up: payment_gateway_intents mutations are RPC / edge-only.
-- Authenticated clients only SELECT pending intents (payment-gateway-service.ts).
-- create_payment_intent / complete_payment_intent* / webhook are SECURITY DEFINER
-- (or service_role via edge). Direct UPDATE previously allowed marking status completed
-- without recording ledger payments — revoke that path.

drop policy if exists payment_intents_insert on public.payment_gateway_intents;
drop policy if exists payment_intents_update on public.payment_gateway_intents;
drop policy if exists payment_intents_delete on public.payment_gateway_intents;

-- Keep SELECT policy (already billing.read + branch access). Recreate idempotently.
drop policy if exists payment_intents_select on public.payment_gateway_intents;
create policy payment_intents_select on public.payment_gateway_intents
  for select
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  );

comment on table public.payment_gateway_intents is
  'Payment gateway checkout intents. Authenticated SELECT requires billing.read. '
  'INSERT/UPDATE/DELETE revoked for authenticated — use create_payment_intent, '
  'complete_payment_intent, complete_payment_intent_webhook (SECURITY DEFINER) or service_role edge.';

comment on policy payment_intents_select on public.payment_gateway_intents is
  'Staff may read gateway intents with billing.read on the branch. Mutations are RPC/edge-only.';

revoke all on table public.payment_gateway_intents from anon;
revoke insert, update, delete, truncate on table public.payment_gateway_intents from authenticated;
grant select on table public.payment_gateway_intents to authenticated;
grant all on table public.payment_gateway_intents to service_role;
