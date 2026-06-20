-- =============================================================================
-- ADIM 3 — Tam doğrulama (migration bundle sonrası)
-- =============================================================================
-- Tüm satırlarda status = OK / exists olmalı.
-- Özet satırı: overall = PASS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Kritik tablolar
-- ---------------------------------------------------------------------------
with expected(table_name) as (
  values
    ('organizations'),
    ('branches'),
    ('profiles'),
    ('patients'),
    ('appointments'),
    ('queue_entries'),
    ('invoices'),
    ('dental_charts'),
    ('tooth_findings'),
    ('patient_branch_links'),
    ('branch_workflow_settings'),
    ('notification_templates'),
    ('payment_reminder_queue'),
    ('patient_recall_queue'),
    ('owner_digest_sms_queue'),
    ('closeout_email_queue'),
    ('periodontal_data') -- kolon dental_charts içinde; tablo kontrolü aşağıda
)
select
  e.table_name,
  case
    when t.oid is null then 'MISSING'
    else 'OK'
  end as status
from expected e
left join pg_class t
  on t.relname = e.table_name
  and t.relnamespace = 'public'::regnamespace
where e.table_name <> 'periodontal_data'
union all
select
  'dental_charts.periodontal_data' as table_name,
  case
    when exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'dental_charts'
        and c.column_name = 'periodontal_data'
    ) then 'OK'
    else 'MISSING'
  end as status
order by status desc, table_name;

-- ---------------------------------------------------------------------------
-- B) Go-live RPC'leri
-- ---------------------------------------------------------------------------
with expected(name) as (
  values
    ('bootstrap_clinic'),
    ('get_my_branches'),
    ('get_my_permissions'),
    ('get_dashboard_stats'),
    ('search_patients'),
    ('check_in_patient'),
    ('update_queue_status'),
    ('finalize_patient_intake'),
    ('validate_intake_completeness'),
    ('create_appointment_validated'),
    ('mark_appointment_no_show'),
    ('get_patient_insurance_profiles'),
    ('upsert_patient_insurance_profile'),
    ('get_patient_odontogram'),
    ('upsert_tooth_finding'),
    ('get_patient_periodontal'),
    ('upsert_patient_periodontal'),
    ('bulk_add_chart_findings_to_plan'),
    ('record_invoice_payment'),
    ('void_invoice'),
    ('complete_payment_intent_by_ref'),
    ('enqueue_payment_reminders'),
    ('enqueue_hygiene_recalls'),
    ('enqueue_owner_digest_sms'),
    ('enqueue_closeout_email_digest'),
    ('get_public_queue_display'),
    ('_mask_patient_display_name'),
    ('get_effective_notification_templates'),
    ('get_finance_summary_analytics'),
    ('get_branch_chart_condition_analytics'),
    ('get_appointments_analytics'),
    ('get_display_health_analytics'),
    ('get_display_analytics'),
    ('record_display_heartbeat'),
    ('get_ortho_analytics'),
    ('get_owner_analytics'),
    ('get_branch_benchmark'),
    ('get_daily_closeout'),
    ('_build_daily_closeout_payload'),
    ('emit_workflow_event'),
    ('get_branch_workflow_settings'),
    ('upsert_branch_workflow_settings'),
    ('seed_demo_showcase_data'),
    ('seed_notification_templates'),
    ('get_owner_digest_readiness')
    ,('add_staff_member_directly')
    ,('update_staff_profile_contact')
    ,('remove_staff_branch_assignment')
    ,('set_staff_active_status')
    ,('update_clinic_hour_guarded')
    ,('create_lab_case_guarded')
    ,('update_lab_case_status_guarded')
    ,('set_notification_dry_run_guarded')
    ,('upsert_procedure_bom_line_guarded')
    ,('delete_procedure_bom_line_guarded')
    ,('create_plan_invoice_guarded')
    ,('resync_draft_invoice_from_plan_guarded')
)
select
  e.name,
  case when p.oid is null then 'MISSING' else 'exists' end as status
from expected e
left join pg_proc p
  on p.proname = e.name
  and p.pronamespace = 'public'::regnamespace
order by status desc, e.name;

-- ---------------------------------------------------------------------------
-- C) Özet — PASS / FAIL (tek satır)
-- ---------------------------------------------------------------------------
with rpc_expected(name) as (
  values
    ('get_patient_odontogram'),
    ('upsert_tooth_finding'),
    ('get_patient_periodontal'),
    ('upsert_patient_periodontal'),
    ('get_public_queue_display'),
    ('_mask_patient_display_name'),
    ('enqueue_hygiene_recalls'),
    ('enqueue_owner_digest_sms'),
    ('enqueue_payment_reminders'),
    ('enqueue_closeout_email_digest'),
    ('seed_demo_showcase_data')
),
rpc_missing as (
  select count(*) as n
  from rpc_expected e
  left join pg_proc p
    on p.proname = e.name and p.pronamespace = 'public'::regnamespace
  where p.oid is null
),
table_missing as (
  select count(*) as n
  from (values
    ('dental_charts'),
    ('tooth_findings'),
    ('patient_recall_queue'),
    ('owner_digest_sms_queue')
  ) t(name)
  left join pg_class c
    on c.relname = t.name and c.relnamespace = 'public'::regnamespace
  where c.oid is null
)
select
  case
    when (select n from rpc_missing) = 0 and (select n from table_missing) = 0
    then 'PASS — migration tamam, devam: 03-seed-demo.sql (opsiyonel)'
    else 'FAIL — eksik RPC: ' || (select n from rpc_missing)::text
         || ', eksik tablo: ' || (select n from table_missing)::text
         || ' → _APPLY_ALL_IDEMPOTENT.sql tekrar çalıştırın'
  end as overall;

-- ---------------------------------------------------------------------------
-- D) Go-live security checks. Each result set must return zero rows.
-- ---------------------------------------------------------------------------
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ~ 'auth\.role\(\)'
    or coalesce(with_check, '') ~ 'auth\.role\(\)'
  );

select routine_schema, routine_name
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee = 'PUBLIC'
  and routine_name in (
    'seed_demo_showcase_data',
    'add_staff_member_directly',
    'update_staff_profile_contact',
    'remove_staff_branch_assignment',
    'set_staff_active_status',
    'update_clinic_hour_guarded',
    'create_lab_case_guarded',
    'update_lab_case_status_guarded',
    'set_notification_dry_run_guarded',
    'upsert_procedure_bom_line_guarded',
    'delete_procedure_bom_line_guarded',
    'create_plan_invoice_guarded',
    'resync_draft_invoice_from_plan_guarded'
  );
