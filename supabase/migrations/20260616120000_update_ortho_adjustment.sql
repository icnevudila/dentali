-- Edit existing ortho adjustment row (recalculates balance)
create or replace function public.update_ortho_adjustment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj_id uuid := (p_payload->>'adjustment_id')::uuid;
  v_adj public.ortho_adjustments%rowtype;
  v_case public.ortho_cases%rowtype;
  v_procedure text := nullif(trim(p_payload->>'procedure'), '');
begin
  if v_adj_id is null then
    raise exception 'adjustment_id is required';
  end if;

  select * into v_adj from public.ortho_adjustments where id = v_adj_id;
  if not found then
    raise exception 'Adjustment not found';
  end if;

  select * into v_case from public.ortho_cases where id = v_adj.case_id;
  if v_case.status <> 'active' then
    raise exception 'Case is closed';
  end if;

  if not public.has_permission('dental_chart.write', v_case.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_procedure is null then
    raise exception 'Procedure is required';
  end if;

  update public.ortho_adjustments
  set
    adjustment_date = coalesce((p_payload->>'adjustment_date')::date, v_adj.adjustment_date),
    procedure = v_procedure,
    next_procedure = nullif(p_payload->>'next_procedure', ''),
    next_visit_date = nullif(p_payload->>'next_visit_date', '')::date,
    payment_amount = coalesce((p_payload->>'payment_amount')::numeric, v_adj.payment_amount),
    notes = nullif(p_payload->>'notes', '')
  where id = v_adj_id;

  update public.ortho_cases
  set updated_at = now(), updated_by = auth.uid()
  where id = v_case.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_case.organization_id, v_case.branch_id, auth.uid(),
    'ortho.adjustment_update', 'ortho_case', v_case.id::text,
    jsonb_build_object('adjustment_id', v_adj_id, 'procedure', v_procedure)
  );

  return public.calculate_ortho_balance(v_case.id) || jsonb_build_object('adjustment_id', v_adj_id);
end;
$$;

grant execute on function public.update_ortho_adjustment(jsonb) to authenticated;
