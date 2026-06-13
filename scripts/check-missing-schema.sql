-- Supabase SQL Editor: eksik tablo/kolon kontrolu (schema bundle sonrasi)
-- status = MISSING olan satirlar icin _APPLY_SCHEMA_ONLY.sql calistir

with expected(table_name, column_name) as (
  values
    ('patient_intakes', null),
    ('waitlist_entries', 'slot_alert_sent_at'),
    ('waitlist_contact_attempts', null),
    ('queue_entries', null),
    ('hmo_claims', null),
    ('philhealth_claims', null),
    ('inventory_items', null),
    ('notification_templates', null),
    ('staff_invitations', null),
    ('patient_documents', null),
    ('clinical_notes', null),
    ('ortho_cases', null),
    ('ortho_adjustments', null),
    ('patient_insurance_profiles', null),
    ('provider_availability', null),
    ('invoice_line_items', null)
)
select
  e.table_name,
  e.column_name,
  case
    when t.oid is null then 'MISSING_TABLE'
    when e.column_name is not null and c.attnum is null then 'MISSING_COLUMN'
    else 'OK'
  end as status
from expected e
left join pg_class t
  on t.relname = e.table_name
  and t.relnamespace = 'public'::regnamespace
left join pg_attribute c
  on c.attrelid = t.oid
  and c.attname = e.column_name
  and not c.attisdropped
order by status desc, e.table_name, e.column_name;
