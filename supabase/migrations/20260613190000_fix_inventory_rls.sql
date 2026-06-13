-- Drop the old overly restrictive policy
drop policy if exists inventory_items_all on public.inventory_items;

-- Allow all authenticated users with branch access to view inventory items
create policy inventory_items_select on public.inventory_items
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

-- Only allow users with settings.manage permission to insert/update/delete inventory items
create policy inventory_items_insert on public.inventory_items
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );

create policy inventory_items_update on public.inventory_items
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  ) with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );

create policy inventory_items_delete on public.inventory_items
  for delete to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  );