-- Closeout snapshots are drafts until explicitly finalized at end of day.
-- Only finalized snapshots lock invoice/payment edits for that clinic day.

alter table public.closeout_snapshots
  add column if not exists finalized boolean not null default false;

-- Existing snapshots were saved as drafts; do not retroactively lock the clinic day.
update public.closeout_snapshots
set finalized = false
where finalized is distinct from true;

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

create or replace function public.save_closeout_snapshot(
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
  v_payload jsonb;
  v_id uuid;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  v_payload := public.get_daily_closeout(p_branch_id, p_date);

  select cs.id
  into v_id
  from public.closeout_snapshots cs
  where cs.organization_id = v_org
    and cs.snapshot_date = p_date
    and cs.branch_id is not distinct from p_branch_id
  limit 1;

  if v_id is not null then
    update public.closeout_snapshots
    set payload = v_payload,
        created_by = auth.uid(),
        created_at = now(),
        finalized = false
    where id = v_id
      and finalized = false;
    if not found then
      raise exception 'This day is already finalized. Billing is locked for this clinic day.';
    end if;
    return v_id;
  end if;

  insert into public.closeout_snapshots (
    organization_id, branch_id, snapshot_date, payload, created_by, finalized
  )
  values (v_org, p_branch_id, p_date, v_payload, auth.uid(), false)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.finalize_closeout_snapshot(
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
  v_payload jsonb;
  v_id uuid;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  v_payload := public.get_daily_closeout(p_branch_id, p_date);

  select cs.id
  into v_id
  from public.closeout_snapshots cs
  where cs.organization_id = v_org
    and cs.snapshot_date = p_date
    and cs.branch_id is not distinct from p_branch_id
  limit 1;

  if v_id is not null then
    update public.closeout_snapshots
    set payload = v_payload,
        created_by = auth.uid(),
        created_at = now(),
        finalized = true
    where id = v_id;
    return v_id;
  end if;

  insert into public.closeout_snapshots (
    organization_id, branch_id, snapshot_date, payload, created_by, finalized
  )
  values (v_org, p_branch_id, p_date, v_payload, auth.uid(), true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_closeout_history(
  p_branch_id uuid default null,
  p_limit int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cs.id,
      'snapshot_date', cs.snapshot_date,
      'branch_id', cs.branch_id,
      'payload', cs.payload,
      'created_at', cs.created_at,
      'finalized', cs.finalized
    ) order by cs.snapshot_date desc, cs.created_at desc)
    from (
      select * from public.closeout_snapshots cs
      where cs.organization_id = public.current_user_org_id()
        and (p_branch_id is null or cs.branch_id = p_branch_id)
      order by cs.snapshot_date desc, cs.created_at desc
      limit greatest(p_limit, 1)
    ) cs
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.finalize_closeout_snapshot(uuid, date) to authenticated;
