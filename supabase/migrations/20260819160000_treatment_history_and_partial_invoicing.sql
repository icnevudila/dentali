-- Treatment history includes completed items; branch worklist JSON + history alias;
-- item/phase invoices as new drafts; approve auto-invoice gated by workflow flag.

alter table public.treatment_plan_items
  add column if not exists status_changed_at timestamptz;

comment on column public.treatment_plan_items.status_changed_at is
  'When item clinical status last changed (planned / in progress / completed). Not a money field.';

-- ---------------------------------------------------------------------------
-- Timeline: include completed/cancelled so History → Completed can filter.
-- ---------------------------------------------------------------------------
create or replace function public.get_patient_treatment_timeline(
  p_patient_id uuid,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_patient_id is null then
    raise exception 'Patient is required';
  end if;
  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.organization_id = v_org
  ) then
    raise exception 'Patient not found';
  end if;
  if p_branch_id is not null and not (
    public.has_permission('patients.read', p_branch_id)
    or public.has_permission('dental_chart.read', p_branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'plan_id', tp.id,
          'plan_title', tp.title,
          'plan_status', tp.status,
          'plan_created_at', tp.created_at,
          'plan_approved_at', tp.approved_at,
          'item_id', i.id,
          'description', i.description,
          'tooth_number', i.tooth_number,
          'priority', i.priority,
          'item_status', i.status,
          'estimated_price', i.estimated_price,
          'item_created_at', i.created_at,
          'item_status_changed_at', i.status_changed_at
        )
        order by
          coalesce(i.status_changed_at, i.created_at) desc,
          i.created_at desc
      ),
      '[]'::jsonb
    )
    from public.treatment_plans tp
    join public.treatment_plan_items i on i.plan_id = tp.id
    where tp.patient_id = p_patient_id
      and tp.organization_id = v_org
      and (p_branch_id is null or tp.branch_id = p_branch_id)
  );
end;
$$;

revoke all on function public.get_patient_treatment_timeline(uuid, uuid) from public;
revoke all on function public.get_patient_treatment_timeline(uuid, uuid) from anon;
grant execute on function public.get_patient_treatment_timeline(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Branch worklist: drop TABLE overload, JSON {counts, rows}, history=completed
-- ---------------------------------------------------------------------------
drop function if exists public.list_branch_treatment_plans(uuid, integer, text);
drop function if exists public.list_branch_treatment_plans(uuid, text, integer);

create or replace function public.list_branch_treatment_plans(
  p_branch_id uuid,
  p_status_group text default 'all',
  p_limit int default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_limit int := least(greatest(coalesce(p_limit, 80), 1), 150);
  v_group text := coalesce(nullif(trim(p_status_group), ''), 'all');
  v_rows jsonb;
  v_counts jsonb;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if v_group = 'completed' then
    v_group := 'history';
  end if;
  if v_group not in ('all', 'unapproved', 'approved', 'ongoing', 'history') then
    raise exception 'Invalid status group';
  end if;
  if not (
    public.has_permission('patients.read', p_branch_id)
    or public.has_permission('dental_chart.read', p_branch_id)
  ) then
    raise exception 'Permission denied';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = v_org
      and b.is_active
  ) then
    raise exception 'Branch not found';
  end if;

  with item_agg as (
    select
      i.plan_id,
      count(*)::int as item_count,
      count(*) filter (where i.status = 'planned')::int as items_planned,
      count(*) filter (where i.status in ('in_progress', 'started'))::int as items_in_progress,
      count(*) filter (where i.status in ('completed', 'done', 'finished'))::int as items_completed,
      count(*) filter (where i.status = 'cancelled')::int as items_cancelled
    from public.treatment_plan_items i
    group by i.plan_id
  ),
  classified as (
    select
      tp.id as plan_id,
      tp.patient_id,
      p.first_name,
      p.last_name,
      tp.title,
      tp.status,
      tp.total_estimated,
      tp.created_at,
      tp.approved_at,
      coalesce(a.item_count, 0) as item_count,
      coalesce(a.items_planned, 0) as items_planned,
      coalesce(a.items_in_progress, 0) as items_in_progress,
      coalesce(a.items_completed, 0) as items_completed,
      case
        when tp.status in ('draft', 'proposed') then 'unapproved'
        when tp.status in ('completed', 'cancelled') then 'history'
        when coalesce(a.item_count, 0) > 0
          and coalesce(a.items_completed, 0) + coalesce(a.items_cancelled, 0) = coalesce(a.item_count, 0)
          and coalesce(a.items_completed, 0) > 0 then 'history'
        when tp.status in ('approved', 'in_progress')
          and (
            coalesce(a.items_in_progress, 0) > 0
            or (
              coalesce(a.items_completed, 0) > 0
              and coalesce(a.items_completed, 0) < coalesce(a.item_count, 0)
            )
          ) then 'ongoing'
        when tp.status in ('approved', 'in_progress') then 'approved'
        else 'unapproved'
      end as status_group
    from public.treatment_plans tp
    join public.patients p on p.id = tp.patient_id
    left join item_agg a on a.plan_id = tp.id
    where tp.branch_id = p_branch_id
      and tp.organization_id = v_org
      and p.organization_id = v_org
  )
  select jsonb_build_object(
    'all', count(*)::int,
    'unapproved', count(*) filter (where status_group = 'unapproved')::int,
    'approved', count(*) filter (where status_group = 'approved')::int,
    'ongoing', count(*) filter (where status_group = 'ongoing')::int,
    'history', count(*) filter (where status_group = 'history')::int
  )
  into v_counts
  from classified;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'plan_id', t.plan_id,
        'patient_id', t.patient_id,
        'first_name', t.first_name,
        'last_name', t.last_name,
        'title', t.title,
        'status', t.status,
        'status_group', t.status_group,
        'total_estimated', t.total_estimated,
        'created_at', t.created_at,
        'approved_at', t.approved_at,
        'item_count', t.item_count,
        'items_planned', t.items_planned,
        'items_in_progress', t.items_in_progress,
        'items_completed', t.items_completed
      )
      order by t.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select *
    from classified c
    where v_group = 'all' or c.status_group = v_group
    order by c.created_at desc
    limit v_limit
  ) t;

  return jsonb_build_object(
    'status_group', v_group,
    'counts', coalesce(v_counts, jsonb_build_object(
      'all', 0, 'unapproved', 0, 'approved', 0, 'ongoing', 0, 'history', 0
    )),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_branch_treatment_plans(uuid, text, int) from public;
revoke all on function public.list_branch_treatment_plans(uuid, text, int) from anon;
grant execute on function public.list_branch_treatment_plans(uuid, text, int) to authenticated;

comment on function public.list_branch_treatment_plans(uuid, text, int) is
  'Branch treatment-plan worklist. history and completed aliases. JSON counts+rows.';

-- ---------------------------------------------------------------------------
-- Prevent double-billing a plan item on a non-void invoice
-- ---------------------------------------------------------------------------
create or replace function public.guard_invoice_line_item_not_double_billed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.treatment_plan_item_id is null then
    return NEW;
  end if;
  if exists (
    select 1
    from public.invoice_line_items ili
    join public.invoices inv on inv.id = ili.invoice_id
    where ili.treatment_plan_item_id = NEW.treatment_plan_item_id
      and inv.status <> 'void'
      and ili.id is distinct from NEW.id
  ) then
    raise exception 'This procedure is already invoiced on an active invoice';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_invoice_line_item_not_double_billed on public.invoice_line_items;
create trigger trg_invoice_line_item_not_double_billed
  before insert or update of treatment_plan_item_id on public.invoice_line_items
  for each row
  execute function public.guard_invoice_line_item_not_double_billed();

-- ---------------------------------------------------------------------------
-- Core: new draft invoice for selected plan items (never appends to paid)
-- ---------------------------------------------------------------------------
create or replace function public._create_invoice_from_plan_item_ids(
  p_plan_id uuid,
  p_item_ids uuid[],
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_plan public.treatment_plans%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_label text := nullif(trim(coalesce(p_label, '')), '');
  v_item record;
  v_ids uuid[];
  v_count int := 0;
  v_desc text;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_plan_id is null then
    raise exception 'Treatment plan is required';
  end if;

  select * into v_plan
  from public.treatment_plans
  where id = p_plan_id
  for update;
  if not found or v_plan.organization_id is distinct from v_org then
    raise exception 'Treatment plan not found';
  end if;
  if v_plan.status not in ('approved', 'in_progress', 'completed') then
    raise exception 'Approve the plan before invoicing procedures';
  end if;

  select coalesce(array_agg(x.id), '{}')
  into v_ids
  from (
    select distinct unnest(coalesce(p_item_ids, '{}'::uuid[])) as id
  ) x;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'No items selected for invoicing';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as iid(id)
    where not exists (
      select 1
      from public.treatment_plan_items i
      where i.id = iid.id
        and i.plan_id = p_plan_id
    )
  ) then
    raise exception 'One or more procedures are not on this plan';
  end if;

  if exists (
    select 1
    from public.treatment_plan_items i
    where i.id = any (v_ids)
      and i.status = 'cancelled'
  ) then
    raise exception 'Cancelled procedures cannot be invoiced';
  end if;

  if exists (
    select 1
    from public.treatment_plan_items i
    join public.invoice_line_items ili on ili.treatment_plan_item_id = i.id
    join public.invoices inv on inv.id = ili.invoice_id
    where i.id = any (v_ids)
      and inv.status <> 'void'
  ) then
    raise exception 'One or more procedures are already invoiced';
  end if;

  v_number := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.invoices (
    organization_id, branch_id, patient_id, treatment_plan_id,
    invoice_number, series, total_amount, subtotal_amount, discount_amount,
    paid_amount, status, created_by
  ) values (
    v_plan.organization_id, v_plan.branch_id, v_plan.patient_id, p_plan_id,
    v_number, 'INV', 0, 0, 0,
    0, 'draft', auth.uid()
  )
  returning id into v_invoice_id;

  for v_item in
    select *
    from public.treatment_plan_items
    where id = any (v_ids)
    order by created_at
  loop
    v_desc := coalesce(v_item.description, 'Treatment item');
    if v_label is not null then
      v_desc := '[' || v_label || '] ' || v_desc;
    end if;
    perform public.add_invoice_line_item(
      v_invoice_id,
      v_desc,
      coalesce(v_item.estimated_price, 0),
      1::numeric,
      v_item.tooth_number,
      v_item.procedure_id,
      v_item.id,
      0::numeric
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'No items selected for invoicing';
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'invoice.create_from_plan_items',
    'invoice',
    v_invoice_id::text,
    jsonb_build_object(
      'treatment_plan_id', p_plan_id,
      'item_count', v_count,
      'label', v_label,
      'item_ids', to_jsonb(v_ids)
    )
  );

  return jsonb_build_object(
    'id', v_invoice_id,
    'invoice_number', v_number,
    'existing', false,
    'item_count', v_count
  );
end;
$$;

revoke all on function public._create_invoice_from_plan_item_ids(uuid, uuid[], text) from public;
revoke all on function public._create_invoice_from_plan_item_ids(uuid, uuid[], text) from anon;
revoke all on function public._create_invoice_from_plan_item_ids(uuid, uuid[], text) from authenticated;
grant execute on function public._create_invoice_from_plan_item_ids(uuid, uuid[], text) to service_role;

create or replace function public.create_invoice_from_plan_items_guarded(
  p_plan_id uuid,
  p_item_ids uuid[],
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
begin
  select * into v_plan from public.treatment_plans where id = p_plan_id;
  if not found then
    raise exception 'Treatment plan not found';
  end if;
  if not public.has_permission('billing.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;
  return public._create_invoice_from_plan_item_ids(p_plan_id, p_item_ids, p_label);
end;
$$;

revoke all on function public.create_invoice_from_plan_items_guarded(uuid, uuid[], text) from public;
revoke all on function public.create_invoice_from_plan_items_guarded(uuid, uuid[], text) from anon;
grant execute on function public.create_invoice_from_plan_items_guarded(uuid, uuid[], text) to authenticated;

comment on function public.create_invoice_from_plan_items_guarded(uuid, uuid[], text) is
  'Creates a new draft invoice for selected treatment-plan items. Never appends to an existing paid/draft invoice.';

create or replace function public.create_plan_invoice_guarded(p_plan_id uuid, p_series text default 'INV')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_ids uuid[];
  v_existing uuid;
  v_number text;
begin
  select * into v_plan from public.treatment_plans where id = p_plan_id for update;
  if not found then raise exception 'Treatment plan not found'; end if;
  if not public.has_permission('billing.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(array_agg(i.id order by i.created_at), '{}')
  into v_ids
  from public.treatment_plan_items i
  where i.plan_id = p_plan_id
    and i.status <> 'cancelled'
    and not exists (
      select 1
      from public.invoice_line_items ili
      join public.invoices inv on inv.id = ili.invoice_id
      where ili.treatment_plan_item_id = i.id
        and inv.status <> 'void'
    );

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    select id, invoice_number into v_existing, v_number
    from public.invoices
    where treatment_plan_id = p_plan_id
      and status <> 'void'
    order by created_at desc
    limit 1;
    if v_existing is not null then
      return jsonb_build_object(
        'id', v_existing,
        'invoice_number', v_number,
        'existing', true,
        'item_count', 0
      );
    end if;
    raise exception 'No uninvoiced procedures on this plan';
  end if;

  return public._create_invoice_from_plan_item_ids(p_plan_id, v_ids, null);
end;
$$;

revoke all on function public.create_plan_invoice_guarded(uuid, text) from public;
revoke all on function public.create_plan_invoice_guarded(uuid, text) from anon;
grant execute on function public.create_plan_invoice_guarded(uuid, text) to authenticated;

create or replace function public._create_invoice_draft_from_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_ids uuid[];
  v_result jsonb;
  v_existing uuid;
begin
  select * into v_plan from public.treatment_plans where id = p_plan_id for update;
  if not found then
    raise exception 'Treatment plan not found';
  end if;

  select coalesce(array_agg(i.id order by i.created_at), '{}')
  into v_ids
  from public.treatment_plan_items i
  where i.plan_id = p_plan_id
    and i.status <> 'cancelled'
    and not exists (
      select 1
      from public.invoice_line_items ili
      join public.invoices inv on inv.id = ili.invoice_id
      where ili.treatment_plan_item_id = i.id
        and inv.status <> 'void'
    );

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    select id into v_existing
    from public.invoices
    where treatment_plan_id = p_plan_id
      and status <> 'void'
    order by created_at desc
    limit 1;
    return v_existing;
  end if;

  v_result := public._create_invoice_from_plan_item_ids(p_plan_id, v_ids, null);
  return (v_result->>'id')::uuid;
end;
$$;

-- Approve: full-plan invoice only when auto_approve_creates_invoice is on
create or replace function public.approve_treatment_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_estimate jsonb;
  v_count bigint;
  v_invoice_id uuid := null;
  v_claim_id uuid := null;
begin
  select *
  into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status not in ('draft', 'proposed') then
    raise exception 'Plan cannot be approved from status %', v_plan.status;
  end if;

  select count(*) into v_count
  from public.treatment_plan_items
  where plan_id = p_plan_id;

  if v_count = 0 then
    raise exception 'Add at least one procedure before approving';
  end if;

  v_estimate := public.calculate_treatment_estimate(p_plan_id);

  update public.treatment_plans
  set status = 'approved', approved_at = now(), updated_at = now()
  where id = p_plan_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'treatment_plan.approved',
    'treatment_plan',
    p_plan_id::text,
    jsonb_build_object(
      'total_estimated', v_estimate->'total_estimated',
      'item_count', v_estimate->'item_count'
    )
  );

  if public._workflow_enabled(v_plan.branch_id, 'auto_approve_creates_invoice') then
    v_invoice_id := public._create_invoice_draft_from_plan(p_plan_id);

    if public._workflow_enabled(v_plan.branch_id, 'auto_hmo_claim_on_invoice') and v_invoice_id is not null then
      v_claim_id := public._auto_hmo_claim_for_invoice(v_invoice_id);
    end if;

    perform public.emit_workflow_event(
      v_plan.branch_id,
      'treatment_plan.approved',
      'treatment_plan',
      p_plan_id::text,
      jsonb_build_object('invoice_id', v_invoice_id, 'hmo_claim_id', v_claim_id)
    );
  end if;

  return v_estimate || jsonb_build_object(
    'status', 'approved',
    'approved_at', now(),
    'invoice_id', v_invoice_id,
    'hmo_claim_id', v_claim_id
  );
end;
$$;

revoke all on function public.approve_treatment_plan(uuid) from public;
revoke all on function public.approve_treatment_plan(uuid) from anon;
grant execute on function public.approve_treatment_plan(uuid) to authenticated;

revoke all on function public._create_invoice_draft_from_plan(uuid) from public;
revoke all on function public._create_invoice_draft_from_plan(uuid) from anon;
revoke all on function public._create_invoice_draft_from_plan(uuid) from authenticated;
grant execute on function public._create_invoice_draft_from_plan(uuid) to service_role;
