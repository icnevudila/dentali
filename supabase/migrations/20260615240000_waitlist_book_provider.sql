-- Waitlist booking: optional provider + billing override on validated appointment creation
create or replace function public.book_waitlist_entry(
  p_entry_id uuid,
  p_scheduled_at timestamptz,
  p_purpose text default null,
  p_provider_id uuid default null,
  p_force_billing_override boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_appt_result jsonb;
  v_appt_id uuid;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be booked in status %', v_entry.status;
  end if;

  v_appt_result := public.create_appointment_validated(jsonb_build_object(
    'organization_id', v_entry.organization_id,
    'branch_id', v_entry.branch_id,
    'patient_id', v_entry.patient_id,
    'provider_id', coalesce(p_provider_id::text, ''),
    'scheduled_at', p_scheduled_at,
    'purpose', coalesce(p_purpose, v_entry.notes),
    'booking_source', 'staff',
    'force_billing_override', coalesce(p_force_billing_override, false)
  ));

  v_appt_id := (v_appt_result->>'id')::uuid;

  update public.waitlist_entries
  set status = 'booked',
      appointment_id = v_appt_id,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('entry_id', p_entry_id, 'appointment_id', v_appt_id);
end;
$$;

grant execute on function public.book_waitlist_entry(uuid, timestamptz, text, uuid, boolean) to authenticated;
