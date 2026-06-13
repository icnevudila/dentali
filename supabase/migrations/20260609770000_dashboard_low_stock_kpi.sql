-- Dashboard KPI: low-stock inventory count

create or replace function public.get_dashboard_stats(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_patients bigint;
  v_today_appts bigint;
  v_pending_consents bigint;
  v_queue_waiting bigint;
  v_open_invoices bigint;
  v_today_collected numeric;
  v_low_stock bigint;
begin
  select count(*) into v_patients
  from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts
  from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and a.scheduled_at::date = current_date
    and a.status in ('scheduled', 'confirmed');

  select count(*) into v_pending_consents
  from public.patient_consents pc
  where pc.organization_id = v_org
    and pc.status = 'pending'
    and (p_branch_id is null or pc.branch_id = p_branch_id);

  select count(*) into v_queue_waiting
  from public.queue_entries qe
  where qe.organization_id = v_org
    and (p_branch_id is null or qe.branch_id = p_branch_id)
    and qe.status in ('waiting', 'ready');

  select count(*) into v_open_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('draft', 'sent', 'partial');

  select coalesce(sum(ip.amount), 0) into v_today_collected
  from public.invoice_payments ip
  join public.invoices inv on inv.id = ip.invoice_id
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and ip.created_at::date = current_date;

  if p_branch_id is not null then
    select count(*) into v_low_stock
    from public.inventory_items i
    where i.branch_id = p_branch_id
      and i.organization_id = v_org
      and i.is_active = true
      and (
        i.quantity_on_hand <= i.min_stock_level
        or (i.expiry_date is not null and i.expiry_date < current_date)
      );
  else
    v_low_stock := 0;
  end if;

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents,
    'queue_waiting', v_queue_waiting,
    'open_invoices', v_open_invoices,
    'today_collected', v_today_collected,
    'low_stock_items', v_low_stock
  );
end;
$$;

-- Realtime refresh when inventory changes
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;
end;
$$;
