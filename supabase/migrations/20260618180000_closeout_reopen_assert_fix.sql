-- Fix: reopen + draft snapshots still blocked billing via assert_invoice_closeout_editable.
-- Only finalized closeouts should lock invoice edits (same rule as check_closeout_lock).
-- Reopen today: unfinalize every finalized snapshot for the org on that clinic day
-- (org-wide null branch_id snapshots also lock all branches).

create or replace function public.assert_invoice_closeout_editable(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_clinic_date date;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;

  v_clinic_date := (v_inv.created_at at time zone 'Asia/Manila')::date;

  if exists (
    select 1
    from public.closeout_snapshots cs
    where cs.organization_id = v_inv.organization_id
      and (cs.branch_id is null or cs.branch_id = v_inv.branch_id)
      and cs.snapshot_date = v_clinic_date
      and cs.finalized = true
  ) then
    raise exception 'This calendar day has been closed out. Financial records for closed days cannot be modified or deleted.';
  end if;
end;
$$;

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
  if coalesce(current_setting('app.bypass_closeout_lock', true), '') = 'true' then
    if TG_OP = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    if TG_TABLE_NAME = 'invoices' then
      v_date := (old.created_at at time zone 'Asia/Manila')::date;
      v_branch_id := old.branch_id;
      v_org_id := old.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := (old.created_at at time zone 'Asia/Manila')::date;
      v_org_id := old.organization_id;
      select branch_id into v_branch_id from public.invoices where id = old.invoice_id;
    end if;
  else
    if TG_TABLE_NAME = 'invoices' then
      v_date := (new.created_at at time zone 'Asia/Manila')::date;
      v_branch_id := new.branch_id;
      v_org_id := new.organization_id;
    elsif TG_TABLE_NAME = 'invoice_payments' then
      v_date := (new.created_at at time zone 'Asia/Manila')::date;
      v_org_id := new.organization_id;
      select branch_id into v_branch_id from public.invoices where id = new.invoice_id;
    end if;
  end if;

  if exists (
    select 1
    from public.closeout_snapshots cs
    where cs.organization_id = v_org_id
      and (cs.branch_id is null or cs.branch_id = v_branch_id)
      and cs.snapshot_date = v_date
      and cs.finalized = true
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

create or replace function public.reopen_today_closeout_snapshot(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  if p_date is distinct from v_today then
    raise exception 'Only today''s closeout can be reopened from the app.';
  end if;

  with reopened as (
    update public.closeout_snapshots cs
    set finalized = false,
        created_by = auth.uid(),
        created_at = now()
    where cs.organization_id = v_org
      and cs.snapshot_date = p_date
      and cs.finalized = true
    returning cs.id
  )
  select id into v_id from reopened limit 1;

  if v_id is null then
    raise exception 'No finalized closeout snapshot found for today.';
  end if;

  return v_id;
end;
$$;

grant execute on function public.assert_invoice_closeout_editable(uuid) to authenticated;
grant execute on function public.reopen_today_closeout_snapshot(uuid, date) to authenticated;
