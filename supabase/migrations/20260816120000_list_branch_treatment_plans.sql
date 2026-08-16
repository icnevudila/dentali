-- Clinic-wide treatment plan worklist + item status marking (no money mutation).
-- Plan statuses: draft, proposed, approved, in_progress, completed, cancelled
-- Item statuses: planned, in_progress, completed, cancelled

alter table public.treatment_plan_items
  add column if not exists status_changed_at timestamptz;

comment on column public.treatment_plan_items.status_changed_at is
  'When item clinical status last changed (planned / in progress / completed). Not a money field.';

-- Patient timeline: include completed/cancelled so Treatment history can use this RPC.
-- Chart UI filters to active items client-side.
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
      count(*) filter (where i.status = 'in_progress')::int as items_in_progress,
      count(*) filter (where i.status = 'completed')::int as items_completed,
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
  'Branch treatment-plan worklist for patients.read or dental_chart.read. Status groups derived from plan + item statuses. No extra PHI.';

-- Clinical item progress only — never mutates price or creates invoices.
create or replace function public.mark_treatment_plan_item_status(
  p_item_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_plan record;
  v_item record;
  v_next text := lower(trim(coalesce(p_status, '')));
  v_open int;
  v_active int;
  v_plan_status text;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_item_id is null then
    raise exception 'Item is required';
  end if;
  if v_next not in ('planned', 'in_progress', 'completed') then
    raise exception 'Invalid item status';
  end if;

  select tp.*, i.status as item_status, i.estimated_price as item_price
  into v_plan
  from public.treatment_plan_items i
  join public.treatment_plans tp on tp.id = i.plan_id
  where i.id = p_item_id
  for update of tp;

  if v_plan.id is null then
    raise exception 'Plan item not found';
  end if;
  if v_plan.organization_id <> v_org then
    raise exception 'Plan item not found';
  end if;
  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;
  if v_plan.status not in ('approved', 'in_progress', 'completed') then
    raise exception 'Accept the plan before marking treatment progress';
  end if;

  select * into v_item from public.treatment_plan_items where id = p_item_id;
  if v_item.status = 'cancelled' then
    raise exception 'Cancelled procedures cannot change status';
  end if;
  if v_item.status = v_next then
    return jsonb_build_object(
      'item_id', p_item_id,
      'status', v_next,
      'plan_id', v_plan.id,
      'plan_status', v_plan.status
    );
  end if;

  update public.treatment_plan_items
  set status = v_next, status_changed_at = now()
  where id = p_item_id;

  select
    count(*) filter (where status not in ('cancelled')),
    count(*) filter (where status in ('planned', 'in_progress'))
  into v_active, v_open
  from public.treatment_plan_items
  where plan_id = v_plan.id;

  v_plan_status := v_plan.status;
  if v_active > 0 and v_open = 0 then
    v_plan_status := 'completed';
  elsif v_next = 'in_progress' or v_open > 0 then
    v_plan_status := 'in_progress';
  elsif v_plan.status = 'completed' and v_open > 0 then
    v_plan_status := 'in_progress';
  end if;

  if v_plan_status is distinct from v_plan.status then
    update public.treatment_plans
    set status = v_plan_status, updated_at = now()
    where id = v_plan.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'treatment_plan.item_status',
    'treatment_plan_item',
    p_item_id::text,
    jsonb_build_object(
      'plan_id', v_plan.id,
      'from_status', v_item.status,
      'to_status', v_next,
      'plan_status', v_plan_status
    )
  );

  return jsonb_build_object(
    'item_id', p_item_id,
    'status', v_next,
    'plan_id', v_plan.id,
    'plan_status', v_plan_status
  );
end;
$$;

revoke all on function public.mark_treatment_plan_item_status(uuid, text) from public;
revoke all on function public.mark_treatment_plan_item_status(uuid, text) from anon;
grant execute on function public.mark_treatment_plan_item_status(uuid, text) to authenticated;

comment on function public.mark_treatment_plan_item_status(uuid, text) is
  'Marks a treatment-plan item planned/in_progress/completed with audit. Does not change prices or invoices.';
