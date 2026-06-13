-- Module 08: Void signed consent (admin only)

create or replace function public.void_patient_consent(
  p_consent_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
begin
  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Only org admins can void consents';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is already voided';
  end if;

  if v_consent.status <> 'signed' then
    raise exception 'Only signed consents can be voided';
  end if;

  update public.patient_consents
  set status = 'voided'
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.voided',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Admin void')
    )
  );

  return jsonb_build_object(
    'consent_id', p_consent_id,
    'status', 'voided'
  );
end;
$$;

grant execute on function public.void_patient_consent(uuid, text) to authenticated;
