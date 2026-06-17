-- Hotfix: check_in_patient calls this helper; required if 20260617180000 was not applied.

create or replace function public._pending_intake_consent_count(
  p_patient_id uuid,
  p_org uuid
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.patient_consents pc
  where pc.patient_id = p_patient_id
    and pc.organization_id = p_org
    and pc.status = 'pending'
    and pc.template_slug in ('general-treatment', 'dpa-consent');
$$;
