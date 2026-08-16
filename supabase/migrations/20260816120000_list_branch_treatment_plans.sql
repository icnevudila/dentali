-- Branch treatment-plan worklist. Read-only; names needed to open the case.
-- Status groups: all | unapproved | approved | ongoing | completed

create index if not exists idx_treatment_plans_branch_created
  on public.treatment_plans (branch_id, created_at desc);

drop function if exists public.list_branch_treatment_plans(uuid, integer, text);

create or replace function public.list_branch_treatment_plans(
  p_branch_id uuid,
  p_limit integer default 100,
  p_status_group text default 'all'
)
returns table (
  plan_id uuid,
  patient_id uuid,
  patient_first_name text,
  patient_last_name text,
  title text,
  status text,
  status_group text,
  total_estimated numeric,
  item_count bigint,
  completed_item_count bigint,
  created_at timestamptz,
  approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_group text := coalesce(nullif(trim(p_status_group), ''), 'all');
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;
  if not exists (
    select 1
    from public.branches b
    where b.id = p_branch_id
      and b.organization_id = v_org
      and b.is_active
  ) then
    raise exception 'Branch not found';
  end if;

  return query
  select
    x.plan_id,
    x.patient_id,
    x.patient_first_name,
    x.patient_last_name,
    x.title,
    x.status,
    x.status_group,
    x.total_estimated,
    x.item_count,
    x.completed_item_count,
    x.created_at,
    x.approved_at
  from (
    select
      tp.id as plan_id,
      tp.patient_id,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      tp.title,
      tp.status,
      case
        when tp.status in ('draft', 'proposed') then 'unapproved'
        when tp.status in ('completed', 'cancelled') then 'completed'
        when tp.status = 'in_progress' then 'ongoing'
        when tp.status = 'approved'
          and coalesce(c.completed_item_count, 0) > 0
          and coalesce(c.completed_item_count, 0) < coalesce(c.item_count, 0) then 'ongoing'
        when tp.status = 'approved' then 'approved'
        else 'unapproved'
      end as status_group,
      tp.total_estimated,
      coalesce(c.item_count, 0) as item_count,
      coalesce(c.completed_item_count, 0) as completed_item_count,
      tp.created_at,
      tp.approved_at
    from public.treatment_plans tp
    join public.patients p on p.id = tp.patient_id
    left join lateral (
      select
        count(*)::bigint as item_count,
        count(*) filter (where i.status = 'completed')::bigint as completed_item_count
      from public.treatment_plan_items i
      where i.plan_id = tp.id
    ) c on true
    where tp.branch_id = p_branch_id
      and tp.organization_id = v_org
      and p.organization_id = v_org
  ) x
  where v_group = 'all' or x.status_group = v_group
  order by x.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_branch_treatment_plans(uuid, integer, text) from public;
revoke all on function public.list_branch_treatment_plans(uuid, integer, text) from anon;
grant execute on function public.list_branch_treatment_plans(uuid, integer, text) to authenticated;
