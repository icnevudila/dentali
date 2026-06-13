-- Idempotent RPC existence check for go-live smoke.
-- Run in Supabase SQL Editor after applying migrations.

WITH expected(name) AS (
  VALUES
    ('get_owner_analytics'),
    ('get_branch_benchmark'),
    ('check_in_patient'),
    ('update_queue_status'),
    ('finalize_patient_intake'),
    ('validate_intake_completeness'),
    ('upsert_patient_insurance_profile'),
    ('bulk_add_chart_findings_to_plan'),
    ('record_invoice_payment'),
    ('void_invoice'),
    ('complete_payment_intent_by_ref'),
    ('enqueue_payment_reminders'),
    ('enqueue_hygiene_recalls'),
    ('enqueue_owner_digest_sms'),
    ('enqueue_closeout_email_digest'),
    ('get_owner_digest_readiness'),
    ('get_org_staff'),
    ('get_finance_summary_analytics'),
    ('get_branch_chart_condition_analytics'),
    ('get_appointments_analytics'),
    ('get_display_health_analytics'),
    ('get_display_analytics'),
    ('record_display_heartbeat'),
    ('get_ortho_analytics'),
    ('emit_workflow_event'),
    ('get_dashboard_stats'),
    ('get_patient_odontogram'),
    ('upsert_tooth_finding'),
    ('get_patient_periodontal'),
    ('upsert_patient_periodontal'),
    ('get_public_queue_display'),
    ('_mask_patient_display_name')
)
SELECT
  e.name,
  CASE WHEN p.proname IS NOT NULL THEN 'exists' ELSE 'MISSING' END AS status
FROM expected e
LEFT JOIN pg_proc p ON p.proname = e.name
ORDER BY e.name;
