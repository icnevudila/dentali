-- Dedicated inventory permissions (read / write) — replaces settings.manage for stock ops

insert into public.permissions (name, description) values
  ('inventory.read', 'View inventory items and stock levels'),
  ('inventory.write', 'Create, update, and adjust inventory items')
on conflict (name) do nothing;

-- Owner and admin inherit all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.name in ('inventory.read', 'inventory.write')
on conflict do nothing;

-- Front desk: view stock for alerts context
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'receptionist'
  and p.name = 'inventory.read'
on conflict do nothing;

-- Dentist: view stock (BOM context)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'dentist'
  and p.name = 'inventory.read'
on conflict do nothing;

-- RLS: read with inventory.read OR legacy settings.manage
drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('inventory.read', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

drop policy if exists inventory_items_insert on public.inventory_items;
create policy inventory_items_insert on public.inventory_items
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('inventory.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

drop policy if exists inventory_items_update on public.inventory_items;
create policy inventory_items_update on public.inventory_items
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('inventory.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  ) with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('inventory.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

drop policy if exists inventory_items_delete on public.inventory_items;
create policy inventory_items_delete on public.inventory_items
  for delete to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('inventory.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

drop policy if exists inventory_movements_insert on public.inventory_movements;
create policy inventory_movements_insert on public.inventory_movements
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and (
      public.has_permission('inventory.write', branch_id)
      or public.has_permission('settings.manage', branch_id)
    )
  );

create or replace function public.adjust_inventory_stock(
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item public.inventory_items%rowtype;
declare v_delta numeric;
declare v_new_qty numeric;
begin
  select * into v_item from public.inventory_items where id = p_item_id;
  if not found then raise exception 'Item not found'; end if;
  if not (
    public.has_permission('inventory.write', v_item.branch_id)
    or public.has_permission('settings.manage', v_item.branch_id)
  ) then
    raise exception 'Permission denied';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  v_delta := case p_movement_type when 'out' then -p_quantity else p_quantity end;
  v_new_qty := v_item.quantity_on_hand + v_delta;
  if v_new_qty < 0 then raise exception 'Insufficient stock'; end if;

  insert into public.inventory_movements (organization_id, branch_id, item_id, movement_type, quantity, notes, created_by)
  values (v_item.organization_id, v_item.branch_id, p_item_id, p_movement_type, p_quantity, p_notes, auth.uid());

  update public.inventory_items set quantity_on_hand = v_new_qty, updated_at = now() where id = p_item_id;

  return jsonb_build_object('item_id', p_item_id, 'quantity_on_hand', v_new_qty);
end; $$;

grant execute on function public.adjust_inventory_stock(uuid, text, numeric, text) to authenticated;
