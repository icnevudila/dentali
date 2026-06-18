-- Run in Supabase SQL Editor if portal/kiosk registration errors after adding PDA intake fields.
-- Safe to run more than once.

alter table public.patients
  add column if not exists intake_profile jsonb not null default '{}'::jsonb;

create index if not exists idx_patients_intake_profile
  on public.patients using gin (intake_profile);

create or replace function public.submit_kiosk_intake(
  p_session_id uuid,
  p_payload jsonb
)
returns jsonb
as $fn$
declare
  v_session public.kiosk_sessions%rowtype;
  v_intake_id uuid;
  v_payload jsonb;
  v_token_type text;
  v_source text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  if nullif(trim(p_payload->>'first_name'), '') is null
    or nullif(trim(p_payload->>'last_name'), '') is null then
    raise exception 'first_name and last_name are required';
  end if;

  select token_type into v_token_type
  from public.branch_public_tokens
  where id = v_session.token_id;

  v_source := case when v_token_type = 'portal' then 'portal' else 'kiosk' end;

  v_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'source', v_source,
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
    'branch_id', v_session.branch_id,
    'source', v_source
  );
end;
$fn$
language plpgsql
security definer
set search_path = public;

grant execute on function public.submit_kiosk_intake(uuid, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
