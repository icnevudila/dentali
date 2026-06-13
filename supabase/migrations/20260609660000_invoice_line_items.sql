-- Module 20: Invoice line items

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  treatment_plan_item_id uuid references public.treatment_plan_items(id) on delete set null,
  description text not null,
  tooth_number text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_line_items_invoice
  on public.invoice_line_items(invoice_id, sort_order);

alter table public.invoice_line_items enable row level security;

create policy invoice_line_items_select on public.invoice_line_items
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.invoices inv
      where inv.id = invoice_line_items.invoice_id
        and public.has_permission('billing.read', inv.branch_id)
    )
  );

create policy invoice_line_items_insert on public.invoice_line_items
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and exists (
      select 1 from public.invoices inv
      where inv.id = invoice_line_items.invoice_id
        and public.has_permission('billing.write', inv.branch_id)
        and inv.status <> 'void'
    )
  );

create or replace function public.recalc_invoice_total_from_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_new_total numeric(12,2);
begin
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);

  select coalesce(sum(line_total), 0) into v_new_total
  from public.invoice_line_items
  where invoice_id = v_invoice_id;

  update public.invoices
  set total_amount = v_new_total,
      updated_at = now()
  where id = v_invoice_id;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_invoice_line_items_recalc on public.invoice_line_items;
create trigger trg_invoice_line_items_recalc
  after insert or update or delete on public.invoice_line_items
  for each row execute function public.recalc_invoice_total_from_lines();

create or replace function public.add_invoice_line_item(
  p_invoice_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1,
  p_tooth_number text default null,
  p_procedure_id uuid default null,
  p_treatment_plan_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_line_total numeric(12,2);
  v_id uuid;
  v_sort int;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status = 'void' then raise exception 'Cannot edit void invoice'; end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  v_line_total := round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0), 2);

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.invoice_line_items where invoice_id = p_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, organization_id, procedure_id, treatment_plan_item_id,
    description, tooth_number, quantity, unit_price, line_total, sort_order
  ) values (
    p_invoice_id, v_inv.organization_id, p_procedure_id, p_treatment_plan_item_id,
    p_description, p_tooth_number, coalesce(p_quantity, 1), coalesce(p_unit_price, 0),
    v_line_total, v_sort
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid) to authenticated;
