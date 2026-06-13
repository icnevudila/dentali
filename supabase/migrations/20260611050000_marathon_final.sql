-- Marathon final: reminders, attention, analytics, BOM, closeout snapshots, webhooks support

-- ---------------------------------------------------------------------------
-- Appointment reminder dispatch log (T-24h / T-2h dedupe)
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('24h', '2h', 'no_show')),
  notification_log_id uuid,
  created_at timestamptz not null default now(),
  unique (appointment_id, reminder_type)
);

create index if not exists idx_appt_reminder_dispatches_branch
  on public.appointment_reminder_dispatches(branch_id, created_at desc);

alter table public.appointment_reminder_dispatches enable row level security;

drop policy if exists appt_reminder_dispatches_select on public.appointment_reminder_dispatches;
create policy appt_reminder_dispatches_select on public.appointment_reminder_dispatches
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.read', branch_id)
  );

-- ---------------------------------------------------------------------------
-- Closeout snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.closeout_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  snapshot_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_closeout_snapshots_branch_date
  on public.closeout_snapshots(branch_id, snapshot_date desc);

alter table public.closeout_snapshots enable row level security;

drop policy if exists closeout_snapshots_select on public.closeout_snapshots;
create policy closeout_snapshots_select on public.closeout_snapshots
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists closeout_snapshots_insert on public.closeout_snapshots;
create policy closeout_snapshots_insert on public.closeout_snapshots
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

-- ---------------------------------------------------------------------------
-- Procedure BOM (inventory deduct on completion)
-- ---------------------------------------------------------------------------
create table if not exists public.procedure_bom_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (procedure_id, inventory_item_id)
);

alter table public.procedure_bom_lines enable row level security;

drop policy if exists procedure_bom_select on public.procedure_bom_lines;
create policy procedure_bom_select on public.procedure_bom_lines
  for select to authenticated using (organization_id = public.current_user_org_id());

drop policy if exists procedure_bom_write on public.procedure_bom_lines;
create policy procedure_bom_write on public.procedure_bom_lines
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (organization_id = public.current_user_org_id());

-- ---------------------------------------------------------------------------
-- Payment reminder queue
-- ---------------------------------------------------------------------------
create table if not exists public.payment_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  balance_amount numeric(12, 2) not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_reminder_pending
  on public.payment_reminder_queue(branch_id, created_at)
  where processed_at is null;

alter table public.payment_reminder_queue enable row level security;

drop policy if exists payment_reminder_queue_select on public.payment_reminder_queue;
create policy payment_reminder_queue_select on public.payment_reminder_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('billing.read', branch_id)
  );

-- ---------------------------------------------------------------------------
-- Dashboard stats: extended KPIs
-- ---------------------------------------------------------------------------
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
    'open_invoices', v_open_invoices,
    'today_collected', v_today_collected,
    'low_stock_items', v_low_stock,
    'missing_clinical_notes', v_missing_notes,
    'hmo_draft_claims', v_hmo_draft,
    'philhealth_pending', v_philhealth_pending
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- PayMongo webhook completion (service role, no user permission)
-- ---------------------------------------------------------------------------
create or replace function public.complete_payment_intent_by_ref(
  p_external_ref text,
  p_provider text default 'paymongo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_payment jsonb;
begin
  select * into v_intent
  from public.payment_gateway_intents
  where external_ref = p_external_ref
    and provider = p_provider
  for update;

  if v_intent.id is null then
    raise exception 'Payment intent not found';
  end if;

  if v_intent.status <> 'pending' then
    return jsonb_build_object('status', v_intent.status, 'intent_id', v_intent.id, 'already_completed', true);
  end if;

  v_payment := public.record_invoice_payment(
    v_intent.invoice_id,
    v_intent.amount,
    v_intent.provider,
    'Webhook payment via ' || v_intent.provider || ' (' || v_intent.external_ref || ')'
  );

  update public.payment_gateway_intents
  set status = 'completed', completed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('webhook_completed', true)
  where id = v_intent.id;

  perform public._sync_ortho_balance_for_invoice(v_intent.invoice_id);

  insert into public.workflow_events (
    organization_id, branch_id, event_type, entity_type, entity_id, payload
  ) values (
    v_intent.organization_id,
    v_intent.branch_id,
    'payment.completed',
    'invoice',
    v_intent.invoice_id::text,
    jsonb_build_object('intent_id', v_intent.id, 'amount', v_intent.amount, 'provider', v_intent.provider)
  );

  return v_payment || jsonb_build_object('intent_id', v_intent.id, 'status', 'completed');
end;
$$;

grant execute on function public.complete_payment_intent_by_ref(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Ortho balance sync after invoice payment
-- ---------------------------------------------------------------------------
create or replace function public._sync_ortho_balance_for_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_case_id uuid;
  v_balance jsonb;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null then return; end if;

  select oc.id into v_case_id
  from public.ortho_cases oc
  where oc.patient_id = v_inv.patient_id
    and oc.branch_id = v_inv.branch_id
    and oc.status = 'active'
  order by oc.created_at desc
  limit 1;

  if v_case_id is null then return; end if;

  v_balance := public.calculate_ortho_balance(v_case_id);

  if public._workflow_enabled(v_inv.branch_id, 'auto_payment_reminder') then
    perform public.emit_workflow_event(
      v_inv.branch_id,
      'ortho.balance_updated',
      'ortho_case',
      v_case_id::text,
      v_balance
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Procedure BOM deduct
-- ---------------------------------------------------------------------------
create or replace function public._deduct_procedure_bom_internal(
  p_procedure_id uuid,
  p_branch_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_deducted int := 0;
begin
  for v_line in
    select bl.*, i.name as item_name
    from public.procedure_bom_lines bl
    join public.inventory_items i on i.id = bl.inventory_item_id
    where bl.procedure_id = p_procedure_id
      and i.branch_id = p_branch_id
      and i.is_active = true
  loop
    perform public.adjust_inventory_stock(
      v_line.inventory_item_id,
      'out',
      v_line.quantity,
      coalesce(p_notes, 'BOM deduct for procedure ' || p_procedure_id::text)
    );
    v_deducted := v_deducted + 1;
  end loop;

  return jsonb_build_object('deducted_lines', v_deducted);
end;
$$;

create or replace function public.deduct_procedure_bom(
  p_procedure_id uuid,
  p_branch_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;
  return public._deduct_procedure_bom_internal(p_procedure_id, p_branch_id, p_notes);
end;
$$;

grant execute on function public.deduct_procedure_bom(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bulk chart findings → plan items (uses tooth_findings when present)
-- ---------------------------------------------------------------------------
create or replace function public.bulk_add_chart_findings_to_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_added int := 0;
  v_finding record;
  v_proc_id uuid;
  v_desc text;
  v_price numeric;
begin
  select * into v_plan from public.treatment_plans where id = p_plan_id;
  if v_plan.id is null then raise exception 'Plan not found'; end if;
  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if to_regclass('public.tooth_findings') is null then
    return jsonb_build_object('added', 0, 'message', 'tooth_findings table not available');
  end if;

  for v_finding in
    select tf.*
    from public.tooth_findings tf
    join public.dental_charts dc on dc.id = tf.chart_id
    where dc.patient_id = v_plan.patient_id
      and dc.branch_id = v_plan.branch_id
      and dc.status = 'active'
      and coalesce(tf.status, 'active') = 'active'
      and tf.condition is not null
      and tf.condition not in ('present', 'missing_other')
  loop
    select p.id, p.name, public.get_procedure_effective_price(p.id, v_plan.branch_id)
    into v_proc_id, v_desc, v_price
    from public.procedures p
    where p.organization_id = v_plan.organization_id
      and p.is_active = true
      and (
        (v_finding.condition in ('decayed', 'missing_caries') and lower(p.name) like '%filling%')
        or (v_finding.condition = 'indicated_extraction' and lower(p.name) like '%extraction%')
        or (v_finding.restoration_type = 'jacket_crown' and lower(p.name) like '%crown%')
      )
    order by p.name
    limit 1;

    if v_proc_id is null then
      v_desc := initcap(replace(v_finding.condition::text, '_', ' ')) || ' — Tooth ' || v_finding.tooth_number;
      v_price := 0;
    end if;

    if not exists (
      select 1 from public.treatment_plan_items tpi
      where tpi.plan_id = p_plan_id
        and tpi.tooth_number = v_finding.tooth_number::text
        and tpi.description = coalesce(v_desc, tpi.description)
    ) then
      insert into public.treatment_plan_items (
        plan_id, procedure_id, description, estimated_price, tooth_number, priority
      ) values (
        p_plan_id,
        v_proc_id,
        coalesce(v_desc, v_finding.condition::text),
        coalesce(v_price, 0),
        v_finding.tooth_number::text,
        'restorative'
      );
      v_added := v_added + 1;
    end if;
  end loop;

  if v_added > 0 then
    perform public.calculate_treatment_estimate(p_plan_id);
  end if;

  return jsonb_build_object('added', v_added);
end;
$$;

grant execute on function public.bulk_add_chart_findings_to_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Closeout snapshot save / history
-- ---------------------------------------------------------------------------
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

  insert into public.closeout_snapshots (organization_id, branch_id, snapshot_date, payload, created_by)
  values (v_org, p_branch_id, p_date, v_payload, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.save_closeout_snapshot(uuid, date) to authenticated;

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
      'created_at', cs.created_at
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

grant execute on function public.get_closeout_history(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Automation run log (workflow_events)
-- ---------------------------------------------------------------------------
create or replace function public.get_automation_run_log(
  p_branch_id uuid default null,
  p_limit int default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.user_is_org_admin() or public.has_permission('audit.read', p_branch_id)) then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', we.id,
      'event_type', we.event_type,
      'entity_type', we.entity_type,
      'entity_id', we.entity_id,
      'branch_id', we.branch_id,
      'payload', we.payload,
      'created_at', we.created_at,
      'processed_at', we.processed_at
    ) order by we.created_at desc)
    from (
      select * from public.workflow_events we
      where we.organization_id = public.current_user_org_id()
        and (p_branch_id is null or we.branch_id = p_branch_id)
      order by we.created_at desc
      limit greatest(p_limit, 1)
    ) we
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_automation_run_log(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Branch benchmark (multi-branch owner)
-- ---------------------------------------------------------------------------
create or replace function public.get_branch_benchmark(p_period_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 30), 90), 1);
  v_start := current_date - (p_period_days - 1);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'branch_id', b.id,
      'label', b.name,
      'appointments', coalesce(a.cnt, 0),
      'collected', coalesce(c.amt, 0),
      'no_show', coalesce(n.cnt, 0),
      'open_ar', coalesce(ar.amt, 0)
    ) order by coalesce(c.amt, 0) desc)
    from public.branches b
    left join (
      select branch_id, count(*)::int as cnt
      from public.appointments
      where organization_id = v_org
        and (scheduled_at at time zone 'Asia/Manila')::date between v_start and current_date
      group by branch_id
    ) a on a.branch_id = b.id
    left join (
      select inv.branch_id, coalesce(sum(ip.amount), 0) as amt
      from public.invoice_payments ip
      join public.invoices inv on inv.id = ip.invoice_id
      where inv.organization_id = v_org
        and ip.created_at::date between v_start and current_date
      group by inv.branch_id
    ) c on c.branch_id = b.id
    left join (
      select branch_id, count(*)::int as cnt
      from public.appointments
      where organization_id = v_org
        and status = 'no_show'
        and (scheduled_at at time zone 'Asia/Manila')::date between v_start and current_date
      group by branch_id
    ) n on n.branch_id = b.id
    left join (
      select branch_id, coalesce(sum(total_amount - paid_amount), 0) as amt
      from public.invoices
      where organization_id = v_org
        and status in ('draft', 'sent', 'partial')
      group by branch_id
    ) ar on ar.branch_id = b.id
    where b.organization_id = v_org and b.is_active = true
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_branch_benchmark(int) to authenticated;

-- ---------------------------------------------------------------------------
-- HMO / PhilHealth / Notification / Kiosk / Inventory movement analytics
-- ---------------------------------------------------------------------------
create or replace function public.get_hmo_pipeline_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('hmo.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'status_funnel', (
      select coalesce(jsonb_agg(jsonb_build_object('label', s.status, 'value', s.cnt) order by
        case s.status
          when 'draft' then 1 when 'submitted' then 2 when 'under_review' then 3
          when 'approved' then 4 when 'paid' then 5 when 'rejected' then 6 else 7 end), '[]'::jsonb)
      from (
        select status, count(*)::int as cnt
        from public.hmo_claims
        where organization_id = v_org and branch_id = p_branch_id
        group by status
      ) s
    ),
    'pending_amount', (
      select coalesce(sum(claimed_amount), 0)
      from public.hmo_claims
      where organization_id = v_org and branch_id = p_branch_id
        and status in ('draft', 'submitted', 'under_review', 'approved')
    )
  );
end;
$$;

grant execute on function public.get_hmo_pipeline_analytics(uuid) to authenticated;

create or replace function public.get_philhealth_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('billing.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'status_breakdown', (
      select coalesce(jsonb_agg(jsonb_build_object('label', s.status, 'value', s.cnt)), '[]'::jsonb)
      from (
        select status, count(*)::int as cnt
        from public.philhealth_claims
        where organization_id = v_org and branch_id = p_branch_id
        group by status
      ) s
    ),
    'readiness_pct', (
      select round(100.0 * count(*) filter (
        where coalesce((checklist->>'complete')::boolean, false)
          or status = 'ready'
      ) / nullif(count(*), 0), 1)
      from public.philhealth_claims
      where organization_id = v_org and branch_id = p_branch_id
        and status in ('draft', 'checklist_incomplete', 'ready')
    )
  );
end;
$$;

grant execute on function public.get_philhealth_analytics(uuid) to authenticated;

create or replace function public.get_notification_analytics(
  p_branch_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start timestamptz;
  v_daily jsonb := '[]'::jsonb;
  d date;
  v_sent int;
  v_failed int;
begin
  if not public.has_permission('notifications.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  v_start := now() - (greatest(coalesce(p_period_days, 30), 1) || ' days')::interval;

  for d in select generate_series((v_start at time zone 'Asia/Manila')::date, current_date, '1 day'::interval)::date
  loop
    select
      count(*) filter (where status in ('sent', 'delivered'))::int,
      count(*) filter (where status = 'failed')::int
    into v_sent, v_failed
    from public.notification_logs nl
    where nl.organization_id = v_org
      and nl.branch_id = p_branch_id
      and nl.created_at::date = d;

    v_daily := v_daily || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_sent,
      'failed', v_failed
    ));
  end loop;

  return jsonb_build_object(
    'daily_delivery', v_daily,
    'delivery_rate_pct', (
      select round(100.0 * count(*) filter (where status in ('sent', 'delivered'))
        / nullif(count(*) filter (where status not in ('dry_run', 'queued')), 0), 1)
      from public.notification_logs
      where organization_id = v_org and branch_id = p_branch_id
        and created_at >= v_start
    ),
    'total_sent', (
      select count(*)::int from public.notification_logs
      where organization_id = v_org and branch_id = p_branch_id
        and created_at >= v_start and status in ('sent', 'delivered')
    )
  );
end;
$$;

grant execute on function public.get_notification_analytics(uuid, int) to authenticated;

create or replace function public.get_kiosk_analytics(
  p_branch_id uuid,
  p_period_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start date;
  v_daily jsonb := '[]'::jsonb;
  d date;
  v_cnt int;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_period_days := greatest(least(coalesce(p_period_days, 7), 90), 1);
  v_start := current_date - (p_period_days - 1);

  for d in select generate_series(v_start, current_date, '1 day'::interval)::date
  loop
    select count(*)::int into v_cnt
    from public.queue_entries qe
    where qe.organization_id = v_org
      and qe.branch_id = p_branch_id
      and qe.notes = 'Kiosk check-in'
      and qe.checked_in_at::date = d;

    v_daily := v_daily || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'value', v_cnt
    ));
  end loop;

  return jsonb_build_object(
    'daily_checkins', v_daily,
    'total_period', (
      select count(*)::int from public.queue_entries
      where organization_id = v_org and branch_id = p_branch_id
        and notes = 'Kiosk check-in'
        and checked_in_at::date between v_start and current_date
    ),
    'intakes_period', (
      select count(*)::int from public.patient_intakes pi
      where pi.organization_id = v_org and pi.branch_id = p_branch_id
        and coalesce(pi.payload->>'source', '') = 'kiosk'
        and pi.created_at::date between v_start and current_date
    )
  );
end;
$$;

grant execute on function public.get_kiosk_analytics(uuid, int) to authenticated;

create or replace function public.get_inventory_movement_analytics(
  p_branch_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_start timestamptz;
  v_trend jsonb := '[]'::jsonb;
  d date;
  v_in numeric;
  v_out numeric;
begin
  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  v_start := now() - (greatest(coalesce(p_period_days, 30), 1) || ' days')::interval;

  for d in select generate_series((v_start at time zone 'Asia/Manila')::date, current_date, '1 day'::interval)::date
  loop
    select
      coalesce(sum(quantity) filter (where movement_type = 'in'), 0),
      coalesce(sum(quantity) filter (where movement_type = 'out'), 0)
    into v_in, v_out
    from public.inventory_movements im
    where im.organization_id = v_org
      and im.branch_id = p_branch_id
      and im.created_at::date = d;

    v_trend := v_trend || jsonb_build_array(jsonb_build_object(
      'date', d::text,
      'label', to_char(d, 'Mon DD'),
      'in', v_in,
      'out', v_out,
      'value', v_in - v_out
    ));
  end loop;

  return jsonb_build_object('movement_trend', v_trend);
end;
$$;

grant execute on function public.get_inventory_movement_analytics(uuid, int) to authenticated;

create or replace function public.get_ortho_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'active_cases', (
      select count(*)::int from public.ortho_cases
      where organization_id = v_org and branch_id = p_branch_id and status = 'active'
    ),
    'balance_distribution', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.bucket, 'value', b.cnt)), '[]'::jsonb)
      from (
        select
          case
            when (public.calculate_ortho_balance(oc.id)->>'balance_due')::numeric <= 0 then 'Paid up'
            when (public.calculate_ortho_balance(oc.id)->>'balance_due')::numeric <= 5000 then 'Under ₱5k'
            else 'Over ₱5k'
          end as bucket,
          count(*)::int as cnt
        from public.ortho_cases oc
        where oc.organization_id = v_org and oc.branch_id = p_branch_id and oc.status = 'active'
        group by 1
      ) b
    )
  );
end;
$$;

grant execute on function public.get_ortho_analytics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Queue served → optional BOM deduct hook
-- ---------------------------------------------------------------------------
create or replace function public._deduct_bom_on_queue_served(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_appt record;
  v_item record;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if v_entry.id is null then return; end if;

  if not public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    return;
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.patient_id = v_entry.patient_id
    and a.branch_id = v_entry.branch_id
    and a.status = 'completed'
    and (a.scheduled_at at time zone 'Asia/Manila')::date = current_date
  order by a.updated_at desc
  limit 1;

  if v_appt.id is null then return; end if;

  for v_item in
    select distinct tpi.procedure_id
    from public.treatment_plan_items tpi
    join public.treatment_plans tp on tp.id = tpi.plan_id
    where tp.patient_id = v_entry.patient_id
      and tp.branch_id = v_entry.branch_id
      and tp.status = 'approved'
      and tpi.procedure_id is not null
    limit 3
  loop
    perform public._deduct_procedure_bom_internal(v_item.procedure_id, v_entry.branch_id, 'Auto BOM on queue served');
  end loop;
end;
$$;

-- Patch update_queue_status to call BOM deduct (re-read existing function tail in 20260611030000)
-- We add a trigger instead to avoid replacing large function:
create or replace function public._queue_served_bom_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'served' and (old.status is distinct from 'served') then
    perform public._deduct_bom_on_queue_served(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_served_bom on public.queue_entries;
create trigger trg_queue_served_bom
  after update of status on public.queue_entries
  for each row
  execute function public._queue_served_bom_trigger_fn();

-- ---------------------------------------------------------------------------
-- Enqueue overdue invoice payment reminders
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_payment_reminders(p_branch_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_inv record;
begin
  if not public._workflow_enabled(p_branch_id, 'auto_payment_reminder') then
    return 0;
  end if;

  for v_inv in
    select inv.id, inv.patient_id, inv.branch_id, inv.organization_id,
           (inv.total_amount - inv.paid_amount) as balance
    from public.invoices inv
    where inv.branch_id = p_branch_id
      and inv.status in ('sent', 'partial')
      and (inv.total_amount - inv.paid_amount) > 0
      and inv.updated_at < now() - interval '7 days'
      and not exists (
        select 1 from public.payment_reminder_queue prq
        where prq.invoice_id = inv.id and prq.processed_at is null
      )
  loop
    insert into public.payment_reminder_queue (
      organization_id, branch_id, invoice_id, patient_id, balance_amount
    ) values (
      v_inv.organization_id, v_inv.branch_id, v_inv.id, v_inv.patient_id, v_inv.balance
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.enqueue_payment_reminders(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Payment reminder batch (cron)
-- ---------------------------------------------------------------------------
create or replace function public.claim_payment_reminder_batch(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', prq.id,
      'branch_id', prq.branch_id,
      'organization_id', prq.organization_id,
      'invoice_id', prq.invoice_id,
      'patient_id', prq.patient_id,
      'balance_amount', prq.balance_amount
    ))
    from (
      select * from public.payment_reminder_queue
      where processed_at is null
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) prq
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_payment_reminder_batch(int) to service_role;

create or replace function public.mark_payment_reminder_processed(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payment_reminder_queue
  set processed_at = now()
  where id = p_id and processed_at is null;
end;
$$;

grant execute on function public.mark_payment_reminder_processed(uuid) to service_role;

-- Service role can insert reminder dispatch rows
drop policy if exists appt_reminder_dispatches_service on public.appointment_reminder_dispatches;
create policy appt_reminder_dispatches_service on public.appointment_reminder_dispatches
  for insert to service_role with check (true);

drop policy if exists payment_reminder_queue_service on public.payment_reminder_queue;
create policy payment_reminder_queue_service on public.payment_reminder_queue
  for all to service_role using (true) with check (true);
