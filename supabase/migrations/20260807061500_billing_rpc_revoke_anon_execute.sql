-- P0 billing security: revoke anonymous/public EXECUTE on staff billing RPCs.
-- Portal payment RPCs (create_portal_payment_intent / prepare_portal_payment_intent) keep anon.
-- Webhook completion stays service_role-only (already applied earlier).
-- Internal underscore helpers and trigger recalc are not client-facing.

-- ---------------------------------------------------------------------------
-- Internal helpers / trigger — no anon/authenticated execute
-- ---------------------------------------------------------------------------
revoke all on function public._sync_invoice_payment_status(uuid) from public, anon, authenticated;
revoke all on function public._create_invoice_draft_from_plan(uuid) from public, anon, authenticated;
revoke all on function public._maybe_invoice_from_served_encounter(uuid) from public, anon, authenticated;
revoke all on function public._auto_hmo_claim_for_invoice(uuid) from public, anon, authenticated;
revoke all on function public._sync_ortho_balance_for_invoice(uuid) from public, anon, authenticated;
revoke all on function public.recalc_invoice_total_from_lines() from public, anon, authenticated;
revoke all on function public.assert_invoice_closeout_editable(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff billing RPCs — authenticated + service_role only
-- ---------------------------------------------------------------------------
revoke all on function public.record_invoice_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.record_invoice_payment(uuid, numeric, text, text) to authenticated, service_role;

revoke all on function public.delete_invoice_payment(uuid) from public, anon;
grant execute on function public.delete_invoice_payment(uuid) to authenticated, service_role;

revoke all on function public.void_invoice(uuid, text) from public, anon;
grant execute on function public.void_invoice(uuid, text) to authenticated, service_role;

revoke all on function public.create_manual_invoice(jsonb) from public, anon;
grant execute on function public.create_manual_invoice(jsonb) to authenticated, service_role;

revoke all on function public.create_payment_intent(uuid, text, numeric) from public, anon;
grant execute on function public.create_payment_intent(uuid, text, numeric) to authenticated, service_role;

revoke all on function public.complete_payment_intent(uuid) from public, anon;
grant execute on function public.complete_payment_intent(uuid) to authenticated, service_role;

revoke all on function public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid, numeric) from public, anon;
grant execute on function public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid, numeric) to authenticated, service_role;

revoke all on function public.update_invoice_line_item(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.update_invoice_line_item(uuid, text, numeric, numeric) to authenticated, service_role;

revoke all on function public.update_invoice_line_item(uuid, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_invoice_line_item(uuid, text, numeric, numeric, numeric) to authenticated, service_role;

revoke all on function public.update_invoice_discount(uuid, numeric) from public, anon;
grant execute on function public.update_invoice_discount(uuid, numeric) to authenticated, service_role;

revoke all on function public.backfill_patient_plan_invoices(uuid, uuid) from public, anon;
grant execute on function public.backfill_patient_plan_invoices(uuid, uuid) to authenticated, service_role;

revoke all on function public.create_invoice_from_ortho_case(uuid) from public, anon;
grant execute on function public.create_invoice_from_ortho_case(uuid) to authenticated, service_role;

comment on function public.record_invoice_payment(uuid, numeric, text, text) is
  'Staff payment ledger write. EXECUTE: authenticated + service_role only (not anon).';
comment on function public.complete_payment_intent(uuid) is
  'Staff gateway completion. EXECUTE: authenticated + service_role. Webhook uses complete_payment_intent_webhook.';
