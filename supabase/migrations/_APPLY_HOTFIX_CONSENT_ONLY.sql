-- Sadece consent kismi (fields hatasi aldiysaniz once bunu calistirin)
-- Tam hotfix: _APPLY_HOTFIX_20260610.sql

alter table public.consent_templates
  add column if not exists fields jsonb not null default '[]'::jsonb;

alter table public.patient_consents
  add column if not exists field_responses jsonb,
  add column if not exists body_snapshot text;

alter table public.consent_templates
  add column if not exists form_category text not null default 'consent',
  add column if not exists is_default boolean not null default false,
  add column if not exists source_asset text,
  add column if not exists description text;
