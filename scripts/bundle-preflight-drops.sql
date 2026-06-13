-- =============================================================================
-- PREFLIGHT DROPS — _APPLY_ALL_IDEMPOTENT.sql basinda otomatik eklenir
-- 42P13 (return type / default degisimi) ve 42710 (policy zaten var) onler
-- Ayri calistirmaya gerek yok; tek bundle yeterli.
-- =============================================================================

-- Staff (wave2 eski OUT kolonlari vs staff_phone_digest genisletilmis tablo)
drop function if exists public.get_org_staff();

-- Odontogram / periodontal (parametre default + imza degisiklikleri)
drop function if exists public.get_patient_odontogram(uuid, uuid);
drop function if exists public.upsert_tooth_finding(
  uuid, uuid, uuid, uuid, text, text, text, text[], text, text, text, uuid
);
drop function if exists public.get_patient_periodontal(uuid, uuid);
drop function if exists public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid);

-- Consent signing (2-param -> genisletilmis imzalar)
drop function if exists public.lock_signed_consent(uuid, text);
drop function if exists public.lock_signed_consent(uuid, text, jsonb, text);
drop function if exists public.create_consent_signing_token(uuid, text, int);
drop function if exists public.get_consent_by_signing_token(text);
drop function if exists public.lock_consent_via_signing_token(text, text, jsonb, text);
drop function if exists public.upsert_org_consent_template(jsonb);

-- Dental chart RLS (42710)
drop policy if exists dental_charts_select on public.dental_charts;
drop policy if exists dental_charts_insert on public.dental_charts;
drop policy if exists dental_charts_update on public.dental_charts;
drop policy if exists tooth_findings_select on public.tooth_findings;
drop policy if exists tooth_findings_insert on public.tooth_findings;
drop policy if exists tooth_findings_update on public.tooth_findings;
drop policy if exists dental_chart_audit_select on public.dental_chart_audit_events;
