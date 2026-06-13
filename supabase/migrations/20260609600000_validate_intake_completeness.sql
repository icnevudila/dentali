-- Module 06: Intake completeness validation RPC

create or replace function public.validate_intake_completeness(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_missing text[] := '{}';
  v_warnings text[] := '{}';
  v_phone text := nullif(trim(p_payload->>'phone'), '');
  v_email text := nullif(trim(p_payload->>'email'), '');
begin
  if nullif(trim(p_payload->>'first_name'), '') is null then
    v_missing := array_append(v_missing, 'first_name');
  end if;

  if nullif(trim(p_payload->>'last_name'), '') is null then
    v_missing := array_append(v_missing, 'last_name');
  end if;

  if nullif(p_payload->>'date_of_birth', '') is null then
    v_missing := array_append(v_missing, 'date_of_birth');
  end if;

  if v_phone is null then
    v_missing := array_append(v_missing, 'phone');
  elsif length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then
    v_warnings := array_append(v_warnings, 'phone_format');
  end if;

  if nullif(trim(p_payload->>'address_line1'), '') is null then
    v_missing := array_append(v_missing, 'address_line1');
  end if;

  if nullif(trim(p_payload->>'city'), '') is null then
    v_missing := array_append(v_missing, 'city');
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_warnings := array_append(v_warnings, 'email_format');
  end if;

  if nullif(trim(p_payload->>'emergency_contact_name'), '') is not null
    and nullif(trim(p_payload->>'emergency_contact_phone'), '') is null then
    v_warnings := array_append(v_warnings, 'emergency_phone_missing');
  end if;

  return jsonb_build_object(
    'valid', cardinality(v_missing) = 0,
    'missing_fields', to_jsonb(v_missing),
    'warnings', to_jsonb(v_warnings)
  );
end;
$$;

grant execute on function public.validate_intake_completeness(jsonb) to authenticated;
