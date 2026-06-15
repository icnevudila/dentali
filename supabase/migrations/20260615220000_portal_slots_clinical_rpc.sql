-- Portal anon slot access, consent ensure RPC, treatment plan CRUD with audit

drop function if exists public.get_available_appointment_slots(uuid, uuid, date);

create or replace function public.get_available_appointment_slots(
  p_branch_id uuid,
  p_provider_id uuid,
  p_date date,
  p_exclude_appointment_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_dow smallint;
  v_avail record;
  v_clinic record;
  v_slots jsonb := '[]'::jsonb;
  v_cursor time;
  v_end time;
  v_slot_mins int;
  v_slot interval;
  v_ts timestamptz;
  v_taken boolean;
begin
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id;

  if v_org_id is null then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  v_dow := extract(dow from p_date)::smallint;

  select pa.start_time, pa.end_time, pa.slot_minutes, pa.is_available
  into v_avail
  from public.provider_availability pa
  where pa.branch_id = p_branch_id
    and pa.provider_id = p_provider_id
    and pa.day_of_week = v_dow
    and pa.organization_id = v_org_id;

  if v_avail is null then
    select ch.open_time, ch.close_time, ch.is_closed
    into v_clinic
    from public.clinic_hours ch
    where ch.branch_id = p_branch_id
      and ch.day_of_week = v_dow;

    if v_clinic is null or coalesce(v_clinic.is_closed, false) then
      return jsonb_build_object('date', p_date, 'slots', v_slots);
    end if;

    v_cursor := coalesce(v_clinic.open_time, '09:00'::time);
    v_end := coalesce(v_clinic.close_time, '17:00'::time);
    v_slot_mins := 30;
  elsif not v_avail.is_available then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  else
    v_cursor := v_avail.start_time;
    v_end := v_avail.end_time;
    v_slot_mins := coalesce(v_avail.slot_minutes, 30);
  end if;

  v_slot := make_interval(mins => v_slot_mins);

  while v_cursor < v_end loop
    v_ts := (p_date + v_cursor) at time zone 'Asia/Manila';
    select exists (
      select 1 from public.appointments a
      where a.branch_id = p_branch_id
        and coalesce(a.provider_id, p_provider_id) = p_provider_id
        and a.scheduled_at = v_ts
        and a.status not in ('cancelled', 'no_show')
        and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
    ) into v_taken;

    v_slots := v_slots || jsonb_build_array(jsonb_build_object(
      'time', to_char(v_cursor, 'HH24:MI'),
      'available', not v_taken
    ));

    v_cursor := v_cursor + v_slot;
  end loop;

  return jsonb_build_object(
    'date', p_date,
    'provider_id', p_provider_id,
    'slots', v_slots
  );
end;
$$;

-- Consent: ensure pending record exists (staff)
create or replace function public.ensure_patient_consent(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_branch_id uuid := nullif(p_payload->>'branch_id', '')::uuid;
  v_slug text := nullif(trim(p_payload->>'template_slug'), '');
  v_name text := nullif(trim(p_payload->>'template_name'), '');
  v_existing record;
  v_id uuid;
begin
  if v_patient_id is null or v_org_id is null or v_slug is null or v_name is null then
    raise exception 'patient_id, organization_id, template_slug, and template_name are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if v_branch_id is not null and not public.has_permission('consents.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_branch_id is null then
    select pbl.branch_id into v_branch_id
    from public.patient_branch_links pbl
    where pbl.patient_id = v_patient_id
    limit 1;
  end if;

  if v_branch_id is not null and not public.has_permission('consents.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  select pc.id, pc.status into v_existing
  from public.patient_consents pc
  where pc.patient_id = v_patient_id
    and pc.template_slug = v_slug
    and pc.organization_id = v_org_id
  order by pc.created_at desc
  limit 1;

  if v_existing.id is not null and v_existing.status <> 'voided' then
    return jsonb_build_object('id', v_existing.id, 'created', false);
  end if;

  if v_existing.id is not null and v_existing.status = 'voided' then
    update public.patient_consents
    set status = 'pending',
        signature_data = null,
        signed_at = null,
        signed_by = null,
        signed_pdf_path = null,
        template_name = v_name,
        updated_at = now()
    where id = v_existing.id;

    insert into public.organization_audit_logs (
      organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
    ) values (
      v_org_id, v_branch_id, auth.uid(),
      'consent.reopen', 'patient_consent', v_existing.id::text,
      jsonb_build_object('patient_id', v_patient_id, 'template_slug', v_slug)
    );

    return jsonb_build_object('id', v_existing.id, 'created', false, 'reopened', true);
  end if;

  insert into public.patient_consents (
    patient_id, organization_id, branch_id, template_slug, template_name, status
  ) values (
    v_patient_id, v_org_id, v_branch_id, v_slug, v_name, 'pending'
  )
  returning id into v_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'consent.ensure', 'patient_consent', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'template_slug', v_slug)
  );

  return jsonb_build_object('id', v_id, 'created', true);
end;
$$;

-- Treatment plan create
create or replace function public.create_treatment_plan(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := coalesce((p_payload->>'organization_id')::uuid, public.current_user_org_id());
  v_title text := nullif(trim(p_payload->>'title'), '');
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null or v_title is null then
    raise exception 'branch_id, patient_id, and title are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('dental_chart.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.treatment_plans (
    organization_id, branch_id, patient_id, title, status, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_title, 'proposed', auth.uid()
  )
  returning id into v_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'treatment_plan.create', 'treatment_plan', v_id::text,
    jsonb_build_object('patient_id', v_patient_id, 'title', v_title)
  );

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.add_treatment_plan_item(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid := (p_payload->>'plan_id')::uuid;
  v_plan record;
  v_item_id uuid;
  v_price numeric(12,2) := coalesce((p_payload->>'estimated_price')::numeric, 0);
begin
  if v_plan_id is null then
    raise exception 'plan_id is required';
  end if;

  select tp.* into v_plan from public.treatment_plans tp where tp.id = v_plan_id;
  if not found then
    raise exception 'Treatment plan not found';
  end if;

  if v_plan.organization_id <> public.current_user_org_id() then
    raise exception 'Treatment plan not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status in ('approved', 'in_progress', 'completed') then
    raise exception 'Cannot modify items on an approved plan. Unapprove the plan to edit procedures.';
  end if;

  insert into public.treatment_plan_items (
    plan_id, procedure_id, description, estimated_price, tooth_number, priority
  ) values (
    v_plan_id,
    nullif(p_payload->>'procedure_id', '')::uuid,
    coalesce(nullif(trim(p_payload->>'description'), ''), 'Procedure'),
    v_price,
    nullif(trim(p_payload->>'tooth_number'), ''),
    coalesce(nullif(trim(p_payload->>'priority'), ''), 'restorative')
  )
  returning id into v_item_id;

  perform public.calculate_treatment_estimate(v_plan_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id, v_plan.branch_id, auth.uid(),
    'treatment_plan.item_add', 'treatment_plan_item', v_item_id::text,
    jsonb_build_object('plan_id', v_plan_id, 'description', p_payload->>'description')
  );

  return jsonb_build_object('id', v_item_id);
end;
$$;

create or replace function public.update_treatment_plan_item(
  p_item_id uuid,
  p_plan_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
begin
  select tp.* into v_plan
  from public.treatment_plans tp
  join public.treatment_plan_items tpi on tpi.plan_id = tp.id
  where tpi.id = p_item_id and tp.id = p_plan_id;

  if not found then
    raise exception 'Plan item not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status in ('approved', 'in_progress', 'completed') then
    raise exception 'Cannot modify items on an approved plan. Unapprove the plan to edit procedures.';
  end if;

  update public.treatment_plan_items
  set
    description = case when p_payload ? 'description' then nullif(trim(p_payload->>'description'), '') else description end,
    estimated_price = case when p_payload ? 'estimated_price' then (p_payload->>'estimated_price')::numeric else estimated_price end,
    tooth_number = case when p_payload ? 'tooth_number' then nullif(trim(p_payload->>'tooth_number'), '') else tooth_number end,
    priority = case when p_payload ? 'priority' then coalesce(nullif(trim(p_payload->>'priority'), ''), priority) else priority end
  where id = p_item_id and plan_id = p_plan_id;

  perform public.calculate_treatment_estimate(p_plan_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id, v_plan.branch_id, auth.uid(),
    'treatment_plan.item_update', 'treatment_plan_item', p_item_id::text,
    jsonb_build_object('plan_id', p_plan_id)
  );

  return jsonb_build_object('id', p_item_id);
end;
$$;

create or replace function public.delete_treatment_plan_item(
  p_item_id uuid,
  p_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
begin
  select tp.* into v_plan
  from public.treatment_plans tp
  join public.treatment_plan_items tpi on tpi.plan_id = tp.id
  where tpi.id = p_item_id and tp.id = p_plan_id;

  if not found then
    raise exception 'Plan item not found';
  end if;

  if not public.has_permission('dental_chart.write', v_plan.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_plan.status in ('approved', 'in_progress', 'completed') then
    raise exception 'Cannot modify items on an approved plan. Unapprove the plan to edit procedures.';
  end if;

  delete from public.treatment_plan_items where id = p_item_id and plan_id = p_plan_id;

  perform public.calculate_treatment_estimate(p_plan_id);

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_plan.organization_id, v_plan.branch_id, auth.uid(),
    'treatment_plan.item_delete', 'treatment_plan_item', p_item_id::text,
    jsonb_build_object('plan_id', p_plan_id)
  );

  return jsonb_build_object('id', p_item_id, 'deleted', true);
end;
$$;

grant execute on function public.get_available_appointment_slots(uuid, uuid, date, uuid) to authenticated, anon;
grant execute on function public.get_branch_provider_availability(uuid) to authenticated, anon;
grant execute on function public.ensure_patient_consent(jsonb) to authenticated;
grant execute on function public.create_treatment_plan(jsonb) to authenticated;
grant execute on function public.add_treatment_plan_item(jsonb) to authenticated;
grant execute on function public.update_treatment_plan_item(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_treatment_plan_item(uuid, uuid) to authenticated;
