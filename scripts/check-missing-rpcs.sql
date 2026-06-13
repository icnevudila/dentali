-- Supabase SQL Editor: uygulamanin kullandigi RPC'lerden hangileri eksik?
-- Sonuc: status = MISSING olan satirlar icin migration push gerekir.

with expected(name) as (
  values
    ('validate_intake_completeness'),
    ('finalize_patient_intake'),
    ('get_dashboard_stats'),
    ('search_patients'),
    ('bootstrap_clinic'),
    ('get_my_branches'),
    ('get_my_permissions'),
    ('get_effective_notification_templates'),
    ('get_inventory_low_stock_alerts'),
    ('mark_appointment_no_show'),
    ('create_appointment_validated'),
    ('reset_hmo_claim_to_draft'),
    ('get_patient_insurance_profiles'),
    ('get_org_consent_templates'),
    ('get_unified_audit_trail'),
    ('get_patient_treatment_timeline'),
    ('submit_kiosk_checkin'),
    ('get_public_queue_display'),
    ('get_patient_odontogram'),
    ('upsert_tooth_finding'),
    ('_mask_patient_display_name')
)
select
  e.name,
  case when p.oid is null then 'MISSING' else 'OK' end as status
from expected e
left join pg_proc p
  on p.proname = e.name
  and p.pronamespace = 'public'::regnamespace
order by status desc, e.name;
