-- Make same-day appointment arrivals visible in Queue before check-in.
-- Prevent accidental past-time booking and stop auto no-show from immediately
-- hiding appointments that were just created for today.

update public.appointments a
set status = 'scheduled',
    updated_at = now()
where a.status = 'no_show'
  and a.created_at >= now() - interval '2 hours'
  and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  and not exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = a.id
      and qe.status <> 'cancelled'
  );

create or replace function public.create_appointment_validated(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_provider_id uuid := nullif(p_payload->>'provider_id', '')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_scheduled_at timestamptz := (p_payload->>'scheduled_at')::timestamptz;
  v_purpose text := nullif(trim(p_payload->>'purpose'), '');
  v_duration integer := coalesce((p_payload->>'duration_minutes')::integer, 30);
  v_booking_source text := coalesce(nullif(p_payload->>'booking_source', ''), 'staff');
  v_force_billing boolean := coalesce((p_payload->>'force_billing_override')::boolean, false);
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null or v_org_id is null or v_scheduled_at is null then
    raise exception 'branch_id, patient_id, organization_id, and scheduled_at are required';
  end if;

  if v_scheduled_at < now() - interval '1 minute' then
    raise exception 'Cannot book an appointment in the past. Use Patient arrival for patients already in clinic.';
  end if;

  if v_booking_source not in ('staff', 'portal', 'kiosk', 'phone', 'walk_in') then
    raise exception 'Invalid booking_source';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('appointments.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public._assert_patient_billing_clear(v_patient_id, v_branch_id, v_force_billing, 'appointment_book');

  if not exists (
    select 1
    from public.patients p
    where p.id = v_patient_id
      and p.organization_id = v_org_id
  ) then
    raise exception 'Patient not found';
  end if;

  perform public._assert_provider_slot_available(v_branch_id, v_provider_id, v_scheduled_at);

  insert into public.appointments (
    organization_id, branch_id, patient_id, provider_id,
    scheduled_at, duration_minutes, purpose, status, booking_source, created_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, v_provider_id,
    v_scheduled_at, v_duration, v_purpose, 'scheduled', v_booking_source, auth.uid()
  )
  returning id into v_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'appointment.create', 'appointment', v_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'scheduled_at', v_scheduled_at,
      'booking_source', v_booking_source
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'status', 'scheduled',
    'scheduled_at', v_scheduled_at,
    'booking_source', v_booking_source
  );
end;
$$;

create or replace function public.auto_no_show_for_branch(
  p_branch_id uuid,
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_marked int := 0;
  v_skipped int := 0;
  v_cutoff timestamptz := now() - make_interval(mins => greatest(p_grace_minutes, 5));
  v_org uuid := public.current_user_org_id();
begin
  if p_branch_id is null then
    raise exception 'branch_id is required';
  end if;

  if not public._user_can_check_in(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if not public._workflow_enabled(p_branch_id, 'auto_no_show_after_grace') then
    return jsonb_build_object('marked', 0, 'skipped', 0, 'grace_minutes', p_grace_minutes);
  end if;

  for v_appt in
    select a.id
    from public.appointments a
    where a.branch_id = p_branch_id
      and a.organization_id = v_org
      and a.status in ('scheduled', 'confirmed')
      and a.scheduled_at < v_cutoff
      and a.created_at < v_cutoff
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and not exists (
        select 1
        from public.queue_entries qe
        where qe.appointment_id = a.id
          and qe.status not in ('cancelled')
      )
  loop
    begin
      perform public.mark_appointment_no_show(v_appt.id);
      v_marked := v_marked + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('marked', v_marked, 'skipped', v_skipped, 'grace_minutes', p_grace_minutes);
end;
$$;

create or replace function public.auto_mark_overdue_appointments_no_show(
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_marked int := 0;
  v_skipped int := 0;
  v_cutoff timestamptz := now() - make_interval(mins => greatest(p_grace_minutes, 5));
begin
  for v_appt in
    select a.id, a.branch_id
    from public.appointments a
    where a.status in ('scheduled', 'confirmed')
      and a.scheduled_at < v_cutoff
      and a.created_at < v_cutoff
      and (a.scheduled_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and public._workflow_enabled(a.branch_id, 'auto_no_show_after_grace')
      and not exists (
        select 1
        from public.queue_entries qe
        where qe.appointment_id = a.id
          and qe.status not in ('cancelled')
      )
  loop
    begin
      perform public.mark_appointment_no_show(v_appt.id);
      v_marked := v_marked + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('marked', v_marked, 'skipped', v_skipped, 'grace_minutes', p_grace_minutes);
end;
$$;

grant execute on function public.create_appointment_validated(jsonb) to authenticated;
grant execute on function public.auto_no_show_for_branch(uuid, int) to authenticated;
grant execute on function public.auto_mark_overdue_appointments_no_show(int) to service_role;
