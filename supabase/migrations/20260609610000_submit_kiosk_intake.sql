-- Module 06: Kiosk intake draft submission (staff review required before finalize)

create or replace function public.submit_kiosk_intake(
  p_session_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_intake_id uuid;
  v_payload jsonb;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  if nullif(trim(p_payload->>'first_name'), '') is null
    or nullif(trim(p_payload->>'last_name'), '') is null then
    raise exception 'first_name and last_name are required';
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'source', 'kiosk',
    'submitted_at', now()
  );

  insert into public.patient_intakes (
    organization_id, branch_id, status, payload
  ) values (
    v_session.organization_id,
    v_session.branch_id,
    'draft',
    v_payload
  )
  returning id into v_intake_id;

  return jsonb_build_object(
    'intake_id', v_intake_id,
    'status', 'draft',
    'branch_id', v_session.branch_id
  );
end;
$$;

grant execute on function public.submit_kiosk_intake(uuid, jsonb) to anon, authenticated, service_role;
