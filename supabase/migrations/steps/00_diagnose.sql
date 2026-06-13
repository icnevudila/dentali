-- ADIM 0: SQL Editor'da calistir — eksikleri gor
-- Her satirin status'u OK olmali (MISSING = once alttaki adimlari uygula)

select 'table:patient_medical_histories' as check_item,
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'patient_medical_histories'
  ) then 'OK' else 'MISSING' end as status
union all
select 'table:consent_templates',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'consent_templates'
  ) then 'OK' else 'MISSING' end
union all
select 'column:consent_templates.fields',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_templates' and column_name = 'fields'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:search_patients(9 params)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_patients'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) like '%p_status%'
  ) then 'OK' else 'MISSING' end
union all
select 'table:organization_audit_logs',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_audit_logs'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:user_is_org_admin()',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_is_org_admin'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:ensure_branch_clinic_hours(uuid)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ensure_branch_clinic_hours'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:create_org_branch(text,text,text)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_org_branch'
  ) then 'OK' else 'MISSING' end
union all
select 'index:consent_templates_global_slug',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_consent_templates_global_slug'
  ) then 'OK' else 'MISSING' end
order by status desc, check_item;
