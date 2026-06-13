-- Dashboard KPI: active waitlist entries awaiting contact

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
  v_waitlist_waiting bigint;
  v_open_invoices bigint;
  v_overdue_invoices bigint;
  v_today_collected numeric;
  v_low_stock bigint;
  v_missing_notes bigint;
  v_hmo_draft bigint;
  v_philhealth_pending bigint;
begin
  select count(*) into v_patients
  from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts
  from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
    and a.status in ('scheduled', 'confirmed', 'checked_in');

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

  select count(*) into v_waitlist_waiting
  from public.waitlist_entries we
  where we.organization_id = v_org
    and (p_branch_id is null or we.branch_id = p_branch_id)
    and we.status in ('waiting', 'contacted');

  select count(*) into v_open_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('draft', 'sent', 'partial');

  select count(*) into v_overdue_invoices
  from public.invoices inv
  where inv.organization_id = v_org
    and (p_branch_id is null or inv.branch_id = p_branch_id)
    and inv.status in ('sent', 'partial')
    and inv.due_date is not null
    and inv.due_date < current_date
    and (inv.total_amount - inv.paid_amount) > 0;

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

    select count(*) into v_missing_notes
    from public.appointments a
    where a.organization_id = v_org
      and a.branch_id = p_branch_id
      and a.status = 'completed'
      and (a.scheduled_at at time zone 'Asia/Manila')::date >= (now() at time zone 'Asia/Manila')::date - 7
      and not exists (
        select 1 from public.clinical_notes cn
        where cn.patient_id = a.patient_id
          and cn.branch_id = a.branch_id
          and cn.status = 'signed'
          and (cn.appointment_id = a.id or cn.signed_at::date = (a.scheduled_at at time zone 'Asia/Manila')::date)
      );
  else
    v_low_stock := 0;
    v_missing_notes := 0;
  end if;

  select count(*) into v_hmo_draft
  from public.hmo_claims hc
  where hc.organization_id = v_org
    and (p_branch_id is null or hc.branch_id = p_branch_id)
    and hc.status = 'draft';

  select count(*) into v_philhealth_pending
  from public.philhealth_claims pc
  where pc.organization_id = v_org
    and (p_branch_id is null or pc.branch_id = p_branch_id)
    and pc.status in ('draft', 'checklist_incomplete', 'ready', 'sync_failed');

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents,
    'queue_waiting', v_queue_waiting,
    'waitlist_waiting', v_waitlist_waiting,
    'open_invoices', v_open_invoices,
    'overdue_invoices', v_overdue_invoices,
    'today_collected', v_today_collected,
    'low_stock_items', v_low_stock,
    'missing_clinical_notes', v_missing_notes,
    'hmo_draft_claims', v_hmo_draft,
    'philhealth_pending', v_philhealth_pending
  );
end;
$$;
