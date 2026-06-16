-- Treatment plan items use patient-specific prices; chart bulk-add no longer copies catalog prices.

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
    select p.id, p.name
    into v_proc_id, v_desc
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
        0,
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
