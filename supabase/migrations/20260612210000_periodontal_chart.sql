-- Periodontal pocket chart JSON on dental_charts + RPC sync

alter table public.dental_charts
  add column if not exists periodontal_data jsonb not null default '{}'::jsonb;

comment on column public.dental_charts.periodontal_data is
  '6-site pocket depths per tooth (FDI keys). See app periodontal-types.';

-- ---------------------------------------------------------------------------
-- get_patient_periodontal
-- ---------------------------------------------------------------------------
drop function if exists public.get_patient_periodontal(uuid, uuid);

create or replace function public.get_patient_periodontal(p_patient_id uuid, p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_chart record;
begin
  if p_branch_id is not null and not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select id, patient_id, branch_id, periodontal_data
  into v_chart
  from public.dental_charts dc
  where dc.patient_id = p_patient_id
    and dc.organization_id = v_org
    and (p_branch_id is null or dc.branch_id = p_branch_id)
    and dc.status = 'active'
  order by dc.updated_at desc
  limit 1;

  if v_chart.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'chart_id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'data', coalesce(v_chart.periodontal_data, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.get_patient_periodontal(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_patient_periodontal
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid);

create or replace function public.upsert_patient_periodontal(
  p_patient_id uuid,
  p_branch_id uuid,
  p_organization_id uuid,
  p_data jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chart_id uuid;
  v_chart record;
begin
  if not public.has_permission('dental_chart.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  select id into v_chart_id
  from public.dental_charts
  where patient_id = p_patient_id
    and branch_id = p_branch_id
    and organization_id = p_organization_id
    and status = 'active'
  order by updated_at desc
  limit 1;

  if v_chart_id is null then
    insert into public.dental_charts (
      organization_id, branch_id, patient_id, periodontal_data, created_by, updated_by
    ) values (
      p_organization_id, p_branch_id, p_patient_id, coalesce(p_data, '{}'::jsonb),
      p_actor_user_id, p_actor_user_id
    )
    returning id into v_chart_id;
  else
    update public.dental_charts
    set
      periodontal_data = coalesce(p_data, '{}'::jsonb),
      updated_by = p_actor_user_id,
      updated_at = now()
    where id = v_chart_id;
  end if;

  select id, patient_id, branch_id, periodontal_data
  into v_chart
  from public.dental_charts
  where id = v_chart_id;

  return jsonb_build_object(
    'chart_id', v_chart.id,
    'patient_id', v_chart.patient_id,
    'branch_id', v_chart.branch_id,
    'data', coalesce(v_chart.periodontal_data, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid) to authenticated;
