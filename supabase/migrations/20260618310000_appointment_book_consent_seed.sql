-- Staff appointment booking: past-time guard + active intake consent seed only.
-- Append to APPLY_INTAKE_CONSENT_SLUG_FIX.sql or run after it.

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
    select 1 from public.patients p
    where p.id = v_patient_id and p.organization_id = v_org_id
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

  perform public._ensure_intake_consents_for_patient(
    v_patient_id,
    v_org_id,
    v_branch_id,
    v_booking_source
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id, v_branch_id, auth.uid(),
    'appointment.create', 'appointment', v_id::text,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'scheduled_at', v_scheduled_at,
      'booking_source', v_booking_source,
      'purpose', v_purpose
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'status', 'scheduled',
    'scheduled_at', v_scheduled_at,
    'booking_source', v_booking_source,
    'consent_seeded', true
  );
end;
$$;

grant execute on function public.create_appointment_validated(jsonb) to authenticated;
