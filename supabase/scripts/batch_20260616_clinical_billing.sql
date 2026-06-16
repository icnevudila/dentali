-- =============================================================================
-- dentQL — toplu SQL (16 Haz 2026 paketi)
-- Supabase Dashboard → SQL Editor → yapıştır → Run
-- Güvenli tekrar çalıştırma: CREATE OR REPLACE / DROP IF EXISTS kullanır.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Orto ayarlama satır düzenleme
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2) Fatura satırı RPC çakışması (Approve Plan)
-- -----------------------------------------------------------------------------
drop function if exists public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid);

create or replace function public.add_invoice_line_item(
  p_invoice_id uuid,
  p_description text,
  p_unit_price numeric,
  p_quantity numeric default 1,
  p_tooth_number text default null,
  p_procedure_id uuid default null,
  p_treatment_plan_item_id uuid default null,
  p_discount_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_line_total numeric(12,2);
  v_sort int;
  v_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status in ('void', 'paid') then raise exception 'Cannot edit % invoice', v_inv.status; end if;
  if not public.has_permission('billing.write', v_inv.branch_id) then raise exception 'Permission denied'; end if;
  perform public.assert_invoice_closeout_editable(p_invoice_id);

  v_line_total := greatest(
    round(coalesce(p_quantity, 1) * coalesce(p_unit_price, 0) - coalesce(p_discount_amount, 0), 2),
    0
  );

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.invoice_line_items where invoice_id = p_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, organization_id, procedure_id, treatment_plan_item_id,
    description, tooth_number, quantity, unit_price, discount_amount, line_total, sort_order
  ) values (
    p_invoice_id, v_inv.organization_id, p_procedure_id, p_treatment_plan_item_id,
    p_description, p_tooth_number, coalesce(p_quantity, 1), coalesce(p_unit_price, 0),
    coalesce(p_discount_amount, 0), v_line_total, v_sort
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_invoice_line_item(uuid, text, numeric, numeric, text, uuid, uuid, numeric) to authenticated;

create or replace function public._create_invoice_draft_from_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_existing uuid;
  v_invoice_id uuid;
  v_item record;
  v_inv_num text;
begin
  select * into v_plan
  from public.treatment_plans
  where id = p_plan_id
    and organization_id = public.current_user_org_id();

  if v_plan.id is null then
    raise exception 'Plan not found';
  end if;

  select id into v_existing
  from public.invoices
  where treatment_plan_id = p_plan_id
    and status <> 'void'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_inv_num := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.invoices (
    organization_id, branch_id, patient_id, treatment_plan_id,
    invoice_number, total_amount, paid_amount, status, created_by
  ) values (
    v_plan.organization_id, v_plan.branch_id, v_plan.patient_id, p_plan_id,
    v_inv_num, 0, 0, 'draft', auth.uid()
  )
  returning id into v_invoice_id;

  for v_item in
    select * from public.treatment_plan_items where plan_id = p_plan_id order by created_at
  loop
    perform public.add_invoice_line_item(
      v_invoice_id,
      coalesce(v_item.description, 'Treatment item'),
      coalesce(v_item.estimated_price, 0),
      1::numeric,
      v_item.tooth_number,
      v_item.procedure_id,
      v_item.id,
      0::numeric
    );
  end loop;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id,
    v_plan.branch_id,
    auth.uid(),
    'invoice.auto_draft_from_plan',
    'invoice',
    v_invoice_id::text,
    jsonb_build_object('treatment_plan_id', p_plan_id)
  );

  return v_invoice_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Tedavi planı — şemadan ekleme fiyatı 0 (hasta bazlı fiyat)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4) Tıbbi geçmiş kaydı — jsonb risk bayrakları
-- -----------------------------------------------------------------------------
create or replace function public._jsonb_text_join(p_arr jsonb, p_sep text default ' ')
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(elem, p_sep), '')
  from jsonb_array_elements_text(coalesce(p_arr, '[]'::jsonb)) as elem;
$$;

create or replace function public.calculate_medical_risk_flags(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_history record;
  v_allergies text;
  v_medications text;
  v_conditions text;
  v_flags jsonb := '[]'::jsonb;
begin
  select pmh.allergies, pmh.medications, pmh.conditions
  into v_history
  from public.patient_medical_histories pmh
  where pmh.patient_id = p_patient_id
    and pmh.organization_id = public.current_user_org_id()
  order by pmh.version desc
  limit 1;

  if v_history is null then
    return jsonb_build_object('patient_id', p_patient_id, 'flags', v_flags, 'risk_level', 'none');
  end if;

  v_allergies := lower(public._jsonb_text_join(v_history.allergies));
  v_medications := lower(public._jsonb_text_join(v_history.medications));
  v_conditions := lower(public._jsonb_text_join(v_history.conditions));

  if v_allergies ~ '(latex|rubber)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'latex_allergy', 'severity', 'high', 'label', 'Latex allergy'));
  end if;

  if v_allergies ~ '(penicillin|amoxicillin|cephalosporin|penicilin)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'antibiotic_allergy', 'severity', 'high', 'label', 'Antibiotic allergy'));
  end if;

  if v_medications ~ '(warfarin|aspirin|clopidogrel|heparin|apixaban|metformin)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'bleeding_risk', 'severity', 'medium', 'label', 'Anticoagulant / bleeding risk'));
  end if;

  if v_conditions ~ '(diabetes|diabet|hypertension|heart|asthma|pregnancy)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'chronic_condition', 'severity', 'medium', 'label', 'Chronic medical condition'));
  end if;

  return jsonb_build_object(
    'patient_id', p_patient_id,
    'flags', v_flags,
    'risk_level', case
      when jsonb_array_length(v_flags) = 0 then 'none'
      when exists (select 1 from jsonb_array_elements(v_flags) f where f->>'severity' = 'high') then 'high'
      else 'medium'
    end
  );
end;
$$;

grant execute on function public._jsonb_text_join(jsonb, text) to authenticated;
grant execute on function public.calculate_medical_risk_flags(uuid) to authenticated;

-- =============================================================================
-- Bitti. Kontrol:
--   select proname from pg_proc where proname in (
--     'update_ortho_adjustment',
--     'add_invoice_line_item',
--     '_create_invoice_draft_from_plan',
--     'bulk_add_chart_findings_to_plan',
--     '_jsonb_text_join',
--     'calculate_medical_risk_flags'
--   );
-- =============================================================================
