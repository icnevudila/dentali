-- Migration: Lock invoices and payments on closed days (closeout locked)
-- Enforces strict accounting controls to prevent employees/users from modifying financial records after daily closeout.

create or replace function public.check_closeout_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_branch_id uuid;
  v_org_id uuid;
begin
  if TG_OP = 'DELETE' then
    if TG_TABLE_NAME = 'invoices' then
      v_date := old.created_at::date;
      v_branch_id := old.branch_id;
      v_org_id := old.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := old.created_at::date;
      v_org_id := old.organization_id;
      select branch_id into v_branch_id from public.invoices where id = old.invoice_id;
    end if;
  else
    if TG_TABLE_NAME = 'invoices' then
      v_date := new.created_at::date;
      v_branch_id := new.branch_id;
      v_org_id := new.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := new.created_at::date;
      v_org_id := new.organization_id;
      select branch_id into v_branch_id from public.invoices where id = new.invoice_id;
    end if;
  end if;

  if exists (
    select 1 from public.closeout_snapshots
    where organization_id = v_org_id
      and (branch_id is null or branch_id = v_branch_id)
      and snapshot_date = v_date
  ) then
    raise exception 'This calendar day has been closed out. Financial records for closed days cannot be modified or deleted.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Drop triggers if they exist to avoid duplicate issues on re-run
drop trigger if exists trg_invoices_closeout_lock on public.invoices;
drop trigger if exists trg_invoice_payments_closeout_lock on public.invoice_payments;

-- Attach triggers
create trigger trg_invoices_closeout_lock
  before update or delete on public.invoices
  for each row execute function public.check_closeout_lock();

create trigger trg_invoice_payments_closeout_lock
  before update or delete on public.invoice_payments
  for each row execute function public.check_closeout_lock();
