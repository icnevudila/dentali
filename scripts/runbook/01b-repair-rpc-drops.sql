-- =============================================================================
-- ADIM 1b — RPC imza onarımı (42P13: cannot remove parameter defaults)
-- =============================================================================
-- Ne zaman: _APPLY_ALL_IDEMPOTENT.sql çalışırken get_patient_odontogram hatası
-- Supabase SQL Editor → Run → ardından ADIM 2 bundle'ı tekrar çalıştırın.
-- =============================================================================

drop function if exists public.get_org_staff();

drop function if exists public.get_patient_odontogram(uuid, uuid);
drop function if exists public.upsert_tooth_finding(
  uuid, uuid, uuid, uuid, text, text, text, text[], text, text, text, uuid
);
drop function if exists public.get_patient_periodontal(uuid, uuid);
drop function if exists public.upsert_patient_periodontal(uuid, uuid, uuid, jsonb, uuid);

-- Odontogram RLS policies (42710: policy already exists)
drop policy if exists dental_charts_select on public.dental_charts;
drop policy if exists dental_charts_insert on public.dental_charts;
drop policy if exists dental_charts_update on public.dental_charts;
drop policy if exists tooth_findings_select on public.tooth_findings;
drop policy if exists tooth_findings_insert on public.tooth_findings;
drop policy if exists tooth_findings_update on public.tooth_findings;
drop policy if exists dental_chart_audit_select on public.dental_chart_audit_events;

select 'RPC + policy drops OK — şimdi _APPLY_ALL_IDEMPOTENT.sql veya odontogram migration tekrar çalıştırın' as next_step;
