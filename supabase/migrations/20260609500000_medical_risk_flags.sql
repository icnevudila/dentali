-- Module 07: Medical risk flags RPC stub

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

  v_allergies := lower(coalesce(array_to_string(v_history.allergies, ' '), ''));
  v_medications := lower(coalesce(array_to_string(v_history.medications, ' '), ''));
  v_conditions := lower(coalesce(array_to_string(v_history.conditions, ' '), ''));

  if v_allergies ~ '(latex|rubber)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'latex_allergy', 'severity', 'high', 'label', 'Latex allergy'));
  end if;

  if v_allergies ~ '(penicillin|amoxicillin|cephalosporin)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'antibiotic_allergy', 'severity', 'high', 'label', 'Antibiotic allergy'));
  end if;

  if v_medications ~ '(warfarin|aspirin|clopidogrel|heparin|apixaban)' then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'bleeding_risk', 'severity', 'medium', 'label', 'Anticoagulant / bleeding risk'));
  end if;

  if v_conditions ~ '(diabetes|hypertension|heart|asthma|pregnancy)' then
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

grant execute on function public.calculate_medical_risk_flags(uuid) to authenticated;
