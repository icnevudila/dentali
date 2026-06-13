-- Marathon phase 2: void sync, finance summary, chart conditions, closeout email queue

-- ---------------------------------------------------------------------------
-- void_invoice: sync draft HMO claims + workflow event
-- ---------------------------------------------------------------------------
create or replace function public.void_invoice(
  p_invoice_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_voided_claims int := 0;
begin
  select *
  into v_inv
  from public.invoices
  where id = p_invoice_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_inv.id is null then
    raise exception 'Invoice not found';
  end if;

  if not public.has_permission('billing.write', v_inv.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_inv.status = 'void' then
    raise exception 'Invoice is already void';
  end if;

  if coalesce(v_inv.paid_amount, 0) > 0 then
    raise exception 'Cannot void invoice with recorded payments';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Void reason is required';
  end if;

  update public.invoices
  set status = 'void', updated_at = now()
  where id = p_invoice_id;

  update public.hmo_claims
  set status = 'rejected',
      rejection_reason = 'Invoice voided: ' || left(trim(p_reason), 200),
      updated_at = now()
  where invoice_id = p_invoice_id
    and status in ('draft', 'submitted', 'under_review');

  get diagnostics v_voided_claims = row_count;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_inv.organization_id,
    v_inv.branch_id,
    auth.uid(),
    'invoice.voided',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'reason', trim(p_reason),
      'invoice_number', v_inv.invoice_number,
      'total_amount', v_inv.total_amount,
      'hmo_claims_voided', v_voided_claims
    )
  );

  perform public.emit_workflow_event(
    v_inv.branch_id,
    'invoice.voided',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object('reason', trim(p_reason), 'hmo_claims_voided', v_voided_claims)
  );

  return jsonb_build_object(
    'id', p_invoice_id,
    'status', 'void',
    'reason', trim(p_reason),
    'hmo_claims_voided', v_voided_claims
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Finance summary for Reports Hub (HMO pending + open AR)
-- ---------------------------------------------------------------------------
create or replace function public.get_finance_summary_analytics(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not (public.user_is_org_admin() or public.has_permission('billing.read', p_branch_id)) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'open_ar', (
      select coalesce(sum(total_amount - paid_amount), 0)
      from public.invoices
      where organization_id = v_org
        and (p_branch_id is null or branch_id = p_branch_id)
        and status in ('draft', 'sent', 'partial')
    ),
    'open_invoice_count', (
      select count(*)::int
      from public.invoices
      where organization_id = v_org
        and (p_branch_id is null or branch_id = p_branch_id)
        and status in ('draft', 'sent', 'partial')
    ),
    'hmo_pending_amount', (
      select coalesce(sum(claimed_amount), 0)
      from public.hmo_claims
      where organization_id = v_org
        and (p_branch_id is null or branch_id = p_branch_id)
        and status in ('draft', 'submitted', 'under_review', 'approved')
    ),
    'hmo_draft_count', (
      select count(*)::int
      from public.hmo_claims
      where organization_id = v_org
        and (p_branch_id is null or branch_id = p_branch_id)
        and status = 'draft'
    ),
    'ar_aging', public.get_ar_aging(coalesce(p_branch_id, (
      select b.id from public.branches b
      where b.organization_id = v_org and b.is_active = true
      order by b.created_at limit 1
    )))
  );
end;
$$;

grant execute on function public.get_finance_summary_analytics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Branch chart condition summary (when tooth_findings exists)
-- ---------------------------------------------------------------------------
create or replace function public.get_branch_chart_condition_analytics(p_branch_id uuid)
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

  if to_regclass('public.tooth_findings') is null then
    return jsonb_build_object('conditions', '[]'::jsonb, 'total_findings', 0);
  end if;

  return jsonb_build_object(
    'total_findings', (
      select count(*)::int
      from public.tooth_findings tf
      join public.dental_charts dc on dc.id = tf.chart_id
      where dc.organization_id = v_org
        and dc.branch_id = p_branch_id
        and dc.status = 'active'
        and coalesce(tf.status, 'active') = 'active'
    ),
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object('label', c.condition, 'value', c.cnt) order by c.cnt desc)
      from (
        select coalesce(tf.condition::text, 'unknown') as condition, count(*)::int as cnt
        from public.tooth_findings tf
        join public.dental_charts dc on dc.id = tf.chart_id
        where dc.organization_id = v_org
          and dc.branch_id = p_branch_id
          and dc.status = 'active'
          and coalesce(tf.status, 'active') = 'active'
        group by 1
      ) c
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_branch_chart_condition_analytics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Closeout email queue
-- ---------------------------------------------------------------------------
create table if not exists public.closeout_email_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  recipient_email text not null,
  snapshot_date date not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'dry_run')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_closeout_email_pending
  on public.closeout_email_queue(status, created_at)
  where status = 'pending';

alter table public.closeout_email_queue enable row level security;

drop policy if exists closeout_email_queue_admin on public.closeout_email_queue;
create policy closeout_email_queue_admin on public.closeout_email_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists closeout_email_queue_service on public.closeout_email_queue;
create policy closeout_email_queue_service on public.closeout_email_queue
  for all to service_role using (true) with check (true);

create or replace function public.enqueue_closeout_email_digest(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_admin record;
  v_payload jsonb;
  v_count int := 0;
begin
  for v_org in
    select distinct o.id as organization_id
    from public.organizations o
  loop
    for v_admin in
      select distinct p.email
      from public.profiles p
      join public.staff_branch_assignments sba on sba.profile_id = p.id
      join public.roles r on r.id = sba.role_id
      where p.organization_id = v_org.organization_id
        and r.name in ('owner', 'admin')
        and p.email is not null
        and length(trim(p.email)) > 0
    loop
      v_payload := public.get_daily_closeout(null, p_date);

      if not exists (
        select 1 from public.closeout_email_queue
        where organization_id = v_org.organization_id
          and recipient_email = v_admin.email
          and snapshot_date = p_date
          and status in ('pending', 'sent', 'dry_run')
      ) then
        insert into public.closeout_email_queue (
          organization_id, branch_id, recipient_email, snapshot_date, payload
        ) values (
          v_org.organization_id, null, v_admin.email, p_date, v_payload
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.enqueue_closeout_email_digest(date) to service_role;

create or replace function public.claim_closeout_email_batch(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'organization_id', q.organization_id,
      'recipient_email', q.recipient_email,
      'snapshot_date', q.snapshot_date,
      'payload', q.payload
    ))
    from (
      select * from public.closeout_email_queue
      where status = 'pending'
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_closeout_email_batch(int) to service_role;

create or replace function public.mark_closeout_email_sent(
  p_id uuid,
  p_status text default 'sent',
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.closeout_email_queue
  set status = coalesce(p_status, 'sent'),
      error_message = p_error,
      sent_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.mark_closeout_email_sent(uuid, text, text) to service_role;
