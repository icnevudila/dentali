-- Visit lifecycle controls: reopen closed visit (undo discharge) and cancel mistaken open visit.
-- Staff copy uses "visit"; DB action keys stay encounter.* for audit continuity.

create or replace function public.reopen_patient_encounter(p_encounter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
  v_other uuid;
begin
  select * into v_enc
  from public.patient_encounters
  where id = p_encounter_id;

  if v_enc.id is null then
    raise exception 'Visit not found';
  end if;

  if v_enc.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_has_branch_access(v_enc.branch_id) then
    raise exception 'Branch access denied';
  end if;

  if not (
    public.has_permission('queue.manage', v_enc.branch_id)
    or public.has_permission('dental_chart.write', v_enc.branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  if v_enc.status = 'open' then
    return jsonb_build_object('id', v_enc.id, 'status', 'open', 'already_open', true);
  end if;

  if v_enc.status <> 'closed' then
    raise exception 'Only a closed visit can be reopened';
  end if;

  select pe.id into v_other
  from public.patient_encounters pe
  where pe.patient_id = v_enc.patient_id
    and pe.branch_id = v_enc.branch_id
    and pe.organization_id = v_enc.organization_id
    and pe.status = 'open'
    and pe.id <> p_encounter_id
  limit 1;

  if v_other is not null then
    raise exception 'Patient already has an open visit. Close or cancel it before reopening this one.';
  end if;

  update public.patient_encounters
  set status = 'open',
      closed_at = null,
      closed_by = null,
      updated_at = now()
  where id = p_encounter_id;

  perform public.emit_workflow_event(
    v_enc.branch_id, 'encounter.reopened', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_enc.patient_id)
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_enc.organization_id, v_enc.branch_id, auth.uid(),
    'encounter.reopen', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object(
      'patient_id', v_enc.patient_id,
      'previously_closed_at', v_enc.closed_at
    )
  );

  return jsonb_build_object(
    'id', p_encounter_id,
    'status', 'open',
    'patient_id', v_enc.patient_id,
    'reopened', true
  );
end;
$$;

create or replace function public.cancel_patient_encounter(
  p_encounter_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc public.patient_encounters%rowtype;
  v_paid_count int := 0;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_enc
  from public.patient_encounters
  where id = p_encounter_id;

  if v_enc.id is null then
    raise exception 'Visit not found';
  end if;

  if v_enc.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_has_branch_access(v_enc.branch_id) then
    raise exception 'Branch access denied';
  end if;

  if not public.has_permission('queue.manage', v_enc.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_enc.status <> 'open' then
    return jsonb_build_object('id', v_enc.id, 'status', v_enc.status, 'already_inactive', true);
  end if;

  select count(*)::int into v_paid_count
  from public.invoices inv
  where inv.encounter_id = p_encounter_id
    and (
      inv.status = 'paid'
      or coalesce(inv.paid_amount, 0) > 0
    );

  if v_paid_count > 0 then
    raise exception 'This visit has recorded payments. Reopen/discharge controls stay on the visit; it cannot be cancelled.';
  end if;

  update public.patient_encounters
  set status = 'cancelled',
      closed_at = now(),
      closed_by = auth.uid(),
      updated_at = now()
  where id = p_encounter_id;

  -- Pull patient out of live queue columns if still active
  if v_enc.queue_entry_id is not null then
    update public.queue_entries qe
    set status = 'cancelled',
        completed_at = coalesce(qe.completed_at, now()),
        updated_at = now()
    where qe.id = v_enc.queue_entry_id
      and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair');
  end if;

  perform public.emit_workflow_event(
    v_enc.branch_id, 'encounter.cancelled', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_enc.patient_id, 'reason', v_reason)
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_enc.organization_id, v_enc.branch_id, auth.uid(),
    'encounter.cancel', 'patient_encounter', p_encounter_id::text,
    jsonb_build_object(
      'patient_id', v_enc.patient_id,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'id', p_encounter_id,
    'status', 'cancelled',
    'patient_id', v_enc.patient_id,
    'cancelled', true
  );
end;
$$;

revoke all on function public.reopen_patient_encounter(uuid) from public;
revoke all on function public.cancel_patient_encounter(uuid, text) from public;
grant execute on function public.reopen_patient_encounter(uuid) to authenticated;
grant execute on function public.cancel_patient_encounter(uuid, text) to authenticated;
