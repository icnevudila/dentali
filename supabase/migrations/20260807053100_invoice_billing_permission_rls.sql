-- P0 billing security: invoices / invoice_payments RLS require billing.* permissions.
-- Org membership alone must not grant ledger access.
--
-- Staff reads: has_permission('billing.read', branch_id)
-- Staff invoice inserts: has_permission('billing.write', branch_id)
-- Direct UPDATE/DELETE on invoices blocked (no policies) — paid_amount/status mutations
-- stay on SECURITY DEFINER RPCs (record_invoice_payment, void_invoice, _sync_*, etc.).
-- invoice_payments ledger: SELECT only for authenticated; INSERT/UPDATE/DELETE revoked.
-- PayMongo webhook path (complete_payment_intent_webhook SECURITY DEFINER) is unchanged
-- and continues to bypass RLS as table owner (FORCE RLS not enabled).

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
drop policy if exists invoices_org on public.invoices;
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;

comment on table public.invoices is
  'Clinic invoices. Authenticated SELECT requires billing.read; INSERT requires billing.write. '
  'paid_amount/status must not be written via direct client UPDATE — use SECURITY DEFINER RPCs '
  '(record_invoice_payment, void_invoice, complete_payment_intent*, sync helpers).';

create policy invoices_select on public.invoices
  for select
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.has_permission('billing.read', branch_id)
  );

create policy invoices_insert on public.invoices
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('billing.write', branch_id)
  );

-- No UPDATE/DELETE policies: blocks direct paid_amount/status (and other) mutation via PostgREST.
-- SECURITY DEFINER RPCs and service_role continue to work (owner / role bypass when FORCE RLS off).

revoke all on table public.invoices from anon;
revoke update, delete, truncate on table public.invoices from authenticated;
grant select, insert on table public.invoices to authenticated;
grant all on table public.invoices to service_role;

comment on policy invoices_select on public.invoices is
  'Staff may read invoices in their org only with billing.read on the invoice branch.';
comment on policy invoices_insert on public.invoices is
  'Staff may insert invoices only with billing.write. Prefer create_manual_invoice / plan draft RPCs.';

-- ---------------------------------------------------------------------------
-- invoice_payments (payment ledger — RPC-only writes)
-- ---------------------------------------------------------------------------
drop policy if exists invoice_payments_org on public.invoice_payments;
drop policy if exists invoice_payments_select on public.invoice_payments;
drop policy if exists invoice_payments_insert on public.invoice_payments;
drop policy if exists invoice_payments_update on public.invoice_payments;
drop policy if exists invoice_payments_delete on public.invoice_payments;
drop policy if exists invoice_payments_all on public.invoice_payments;

comment on table public.invoice_payments is
  'Payment ledger for invoices. Authenticated SELECT requires billing.read on the parent invoice branch. '
  'INSERT/UPDATE/DELETE are revoked for authenticated — use record_invoice_payment, '
  'delete_invoice_payment, or complete_payment_intent_webhook (SECURITY DEFINER).';

create policy invoice_payments_select on public.invoice_payments
  for select
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1
      from public.invoices inv
      where inv.id = invoice_payments.invoice_id
        and public.has_permission('billing.read', inv.branch_id)
    )
  );

revoke all on table public.invoice_payments from anon;
revoke insert, update, delete, truncate on table public.invoice_payments from authenticated;
grant select on table public.invoice_payments to authenticated;
grant all on table public.invoice_payments to service_role;

comment on policy invoice_payments_select on public.invoice_payments is
  'Staff may read payment rows only with billing.read on the parent invoice branch. Ledger writes are RPC-only.';
