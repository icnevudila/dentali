-- Secure procedure_inventory_links (was RLS-disabled; advisory critical)

alter table public.procedure_inventory_links enable row level security;

drop policy if exists procedure_inventory_links_select on public.procedure_inventory_links;
create policy procedure_inventory_links_select on public.procedure_inventory_links
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.has_permission('inventory.read', (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    ))
  );

drop policy if exists procedure_inventory_links_insert on public.procedure_inventory_links;
create policy procedure_inventory_links_insert on public.procedure_inventory_links
  for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('inventory.write', (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    ))
  );

drop policy if exists procedure_inventory_links_update on public.procedure_inventory_links;
create policy procedure_inventory_links_update on public.procedure_inventory_links
  for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.has_permission('inventory.write', (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    ))
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('inventory.write', (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    ))
  );

drop policy if exists procedure_inventory_links_delete on public.procedure_inventory_links;
create policy procedure_inventory_links_delete on public.procedure_inventory_links
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.has_permission('inventory.write', (
      select sba.branch_id from public.staff_branch_assignments sba
      where sba.profile_id = auth.uid() limit 1
    ))
  );

grant select, insert, update, delete on public.procedure_inventory_links to authenticated;
