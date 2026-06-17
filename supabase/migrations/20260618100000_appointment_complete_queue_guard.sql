-- Block direct appointment completion unless Queue has a served entry for that appointment.

create or replace function public.update_appointment_status(
  p_appointment_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  if p_appointment_id is null then
    raise exception 'appointment_id is required';
  end if;

  if p_status not in ('completed', 'cancelled', 'confirmed') then
    raise exception 'Unsupported status transition: %', p_status;
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Appointment not found';
  end if;

  if not public.has_permission('appointments.write', v_appt.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status = 'completed' and v_appt.status not in ('scheduled', 'confirmed', 'checked_in') then
    raise exception 'Cannot mark appointment as completed from status %', v_appt.status;
  end if;

  if p_status = 'completed' and not exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = p_appointment_id
      and qe.status = 'served'
  ) then
    raise exception 'Mark the patient as Served on the Queue board before completing this appointment.';
  end if;

  if p_status = 'cancelled' and v_appt.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Appointment cannot be cancelled';
  end if;

  if p_status = 'confirmed' and v_appt.status not in ('scheduled') then
    raise exception 'Only scheduled appointments can be confirmed';
  end if;

  update public.appointments
  set status = p_status, updated_at = now()
  where id = p_appointment_id;

  if p_status = 'cancelled' and public._workflow_enabled(v_appt.branch_id, 'auto_waitlist_on_slot_open') then
    insert into public.slot_notification_queue (
      organization_id, branch_id, slot_at, source_appointment_id
    ) values (
      v_appt.organization_id, v_appt.branch_id, v_appt.scheduled_at, p_appointment_id
    );
    perform public.emit_workflow_event(
      v_appt.branch_id, 'slot.opened', 'appointment', p_appointment_id::text,
      jsonb_build_object('slot_at', v_appt.scheduled_at, 'reason', 'cancelled')
    );
  end if;

  if p_status = 'completed' then
    perform public.emit_workflow_event(
      v_appt.branch_id, 'appointment.completed', 'appointment', p_appointment_id::text,
      jsonb_build_object('patient_id', v_appt.patient_id, 'scheduled_at', v_appt.scheduled_at)
    );
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_appt.organization_id, v_appt.branch_id, auth.uid(),
    'appointment.status_change', 'appointment', p_appointment_id::text,
    jsonb_build_object(
      'previous_status', v_appt.status,
      'new_status', p_status,
      'patient_id', v_appt.patient_id,
      'scheduled_at', v_appt.scheduled_at
    )
  );

  return jsonb_build_object('id', p_appointment_id, 'status', p_status);
end;
$$;

grant execute on function public.update_appointment_status(uuid, text) to authenticated;
