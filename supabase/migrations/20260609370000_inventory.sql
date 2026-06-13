-- Module 23: Inventory & supplies

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  unit text default 'pc',
  quantity_on_hand numeric(12, 2) not null default 0,
  min_stock_level numeric(12, 2) not null default 0,
  expiry_date date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity numeric(12, 2) not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_branch on public.inventory_items(branch_id, is_active);
create index if not exists idx_inventory_movements_item on public.inventory_movements(item_id, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy inventory_items_all on public.inventory_items
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('settings.manage', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy inventory_movements_insert on public.inventory_movements
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('settings.manage', branch_id)
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
  if not public.has_permission('settings.manage', v_item.branch_id) then raise exception 'Permission denied'; end if;
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
