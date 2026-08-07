-- Tiny related billing grant: branch procedure price overrides were org-membership ALL.
-- Settings UI uses SETTINGS_MANAGE; billing staff may also need read/write for pricing.
-- Match inventory-style dual permission (domain OR settings.manage).

drop policy if exists branch_procedure_prices_org on public.branch_procedure_prices;
drop policy if exists branch_procedure_prices_select on public.branch_procedure_prices;
drop policy if exists branch_procedure_prices_insert on public.branch_procedure_prices;
drop policy if exists branch_procedure_prices_update on public.branch_procedure_prices;
drop policy if exists branch_procedure_prices_delete on public.branch_procedure_prices;

comment on table public.branch_procedure_prices is
  'Per-branch procedure price overrides. SELECT: billing.read or settings.manage. '
  'INSERT/UPDATE/DELETE: billing.write or settings.manage on the branch.';

create policy branch_procedure_prices_select on public.branch_procedure_prices
  for select
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('billing.read', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

create policy branch_procedure_prices_insert on public.branch_procedure_prices
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('billing.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

create policy branch_procedure_prices_update on public.branch_procedure_prices
  for update
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('billing.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  )
  with check (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('billing.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

create policy branch_procedure_prices_delete on public.branch_procedure_prices
  for delete
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('billing.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

revoke all on table public.branch_procedure_prices from anon;
grant select, insert, update, delete on table public.branch_procedure_prices to authenticated;
grant all on table public.branch_procedure_prices to service_role;

comment on policy branch_procedure_prices_select on public.branch_procedure_prices is
  'Read branch price overrides with billing.read or settings.manage.';
comment on policy branch_procedure_prices_insert on public.branch_procedure_prices is
  'Insert branch price overrides with billing.write or settings.manage.';
comment on policy branch_procedure_prices_update on public.branch_procedure_prices is
  'Update branch price overrides with billing.write or settings.manage.';
comment on policy branch_procedure_prices_delete on public.branch_procedure_prices is
  'Delete branch price overrides with billing.write or settings.manage.';
