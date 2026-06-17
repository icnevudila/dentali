-- =============================================================================
-- dentQL — Check-in consent helper (tek fonksiyon, hızlı düzeltme)
-- =============================================================================
-- Hata: function public._pending_intake_consent_count(uuid, uuid) does not exist
-- NEREYE: Supabase Dashboard → SQL Editor → yapıştır → Run
-- =============================================================================

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
