-- Clinic paper/PDF consent templates (DRG, PDA) — selectable on demand, not all auto-seeded

alter table public.consent_templates
  add column if not exists form_category text not null default 'consent',
  add column if not exists is_default boolean not null default false,
  add column if not exists source_asset text,
  add column if not exists description text;

delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

drop index if exists public.idx_consent_templates_global_slug;
create unique index idx_consent_templates_global_slug
  on public.consent_templates (slug)
  where organization_id is null;

-- Only core intake consents auto-created for new patients
update public.consent_templates
set is_default = true,
    form_category = 'consent',
    source_asset = 'PDA'
where organization_id is null
  and slug in ('dpa-consent', 'general-treatment');

update public.consent_templates
set form_category = 'consent',
    source_asset = 'DRG',
    description = 'Orthodontic treatment agreement and risks'
where organization_id is null
  and slug = 'ortho-agreement';

-- DRG CONFORME (from dental record paper)
insert into public.consent_templates (
  organization_id, slug, name, body, version, is_active,
  form_category, is_default, source_asset, description, fields
) values (
  null,
  'drg-conforme',
  'CONFORME — Informed Consent (DRG)',
  'CONFORME (Informed Consent)

I hereby authorize the dentist to perform upon me dental treatment deemed necessary or advisable, including the use of anesthesia.

I understand that dentistry is not an exact science and authorize my dentist to make whatever changes deemed necessary during treatment.

I agree to be responsible for all costs of dental treatment rendered on my behalf, including clinic fees and associated laboratory costs.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}
Clinic: {{clinic_name}}',
  '1.0',
  true,
  'consent',
  false,
  'DRG',
  'Standard informed consent block from DRG dental record',
  '[
    {"id":"anesthesia_ack","type":"yes_no","label":"I understand that anesthesia may be used as part of my treatment","required":true},
    {"id":"cost_ack","type":"yes_no","label":"I agree to be responsible for applicable treatment and laboratory fees","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]'::jsonb
) on conflict (slug) where (organization_id is null) do update set
  name = excluded.name,
  body = excluded.body,
  version = excluded.version,
  form_category = excluded.form_category,
  source_asset = excluded.source_asset,
  description = excluded.description,
  fields = excluded.fields;

-- Procedure-specific consents (docs/04 + clinic paper set)
insert into public.consent_templates (
  organization_id, slug, name, body, version, is_active,
  form_category, is_default, source_asset, description, fields
) values
(
  null, 'radiograph-consent', 'Radiograph / X-Ray Consent',
  'I consent to dental radiographs (X-rays) as recommended by my dentist for diagnosis and treatment planning.

I understand that radiographs involve low levels of radiation and that reasonable precautions will be taken.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Consent for diagnostic imaging',
  '[{"id":"pregnancy_status","type":"yes_no","label":"Are you pregnant or could you be pregnant?","required":true},{"id":"risks_explained","type":"yes_no","label":"Risks and purpose of X-rays were explained to me","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'extraction-consent', 'Extraction / Removal Consent',
  'I consent to the extraction (removal) of the tooth/teeth discussed with my dentist.

I understand risks may include pain, swelling, bleeding, infection, nerve injury, sinus involvement, and dry socket.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Tooth extraction consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth number / site","required":true,"placeholder":"e.g. #16"},{"id":"risks_ack","type":"yes_no","label":"Risks, benefits, and alternatives were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'crown-bridge-consent', 'Crown / Bridge Consent',
  'I consent to crown or bridge treatment as discussed with my dentist.

I understand risks may include sensitivity, need for root canal, fracture, or replacement over time.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Fixed prosthodontics consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth/teeth involved","required":true},{"id":"procedure_explained","type":"yes_no","label":"Procedure, risks, and alternatives were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'root-canal-consent', 'Endodontic / Root Canal Consent',
  'I consent to endodontic (root canal) treatment on the tooth discussed with my dentist.

I understand success is not guaranteed and retreatment, surgery, or extraction may be needed.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Root canal therapy consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth number","required":true},{"id":"risks_ack","type":"yes_no","label":"Risks and alternatives were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'periodontal-consent', 'Periodontal Treatment Consent',
  'I consent to periodontal (gum) treatment as recommended.

I understand that periodontal disease may progress without treatment and that maintenance visits are important.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Periodontal therapy consent',
  '[{"id":"treatment_desc","type":"text","label":"Treatment described","required":true,"placeholder":"e.g. scaling & root planing"},{"id":"risks_ack","type":"yes_no","label":"Risks and home care instructions were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'filling-consent', 'Filling / Restoration Consent',
  'I consent to restorative (filling) treatment on the tooth/teeth discussed.

I understand sensitivity or need for further treatment may occur.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Restorative treatment consent',
  '[{"id":"tooth_site","type":"text","label":"Tooth number / surface","required":true},{"id":"material_ack","type":"yes_no","label":"Material options were discussed","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'denture-consent', 'Denture Consent',
  'I consent to removable denture treatment as discussed.

I understand adaptation time is required and adjustments may be needed.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'Removable prosthodontics consent',
  '[{"id":"denture_type","type":"text","label":"Type (partial / complete)","required":true},{"id":"expectations_ack","type":"yes_no","label":"Expectations and care instructions were explained","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'medication-risk-consent', 'Medication Risk Consent',
  'I understand the medications prescribed or administered for my dental treatment, including possible side effects and interactions.

I will inform the clinic of all medications and supplements I take.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'PDA', 'Medication risks acknowledgment',
  '[{"id":"med_list_reviewed","type":"yes_no","label":"My current medications were reviewed with the dentist","required":true},{"id":"allergy_disclosed","type":"yes_no","label":"I disclosed known drug allergies","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
),
(
  null, 'treatment-plan-change-consent', 'Change in Treatment Plan Consent',
  'I consent to changes in my treatment plan as discussed during treatment.

I understand the reason for the change and any impact on fees or appointments.

Patient: {{patient_name}} · {{today_date}} · {{clinic_name}}',
  '1.0', true, 'consent', false, 'DRG', 'When planned treatment changes mid-course',
  '[{"id":"change_summary","type":"text","label":"Summary of change","required":true},{"id":"fees_discussed","type":"yes_no","label":"Fee impact was discussed","required":true},{"id":"patient_initials","type":"initials","label":"Initials","required":true}]'::jsonb
)
on conflict (slug) where (organization_id is null) do update set
  name = excluded.name,
  body = excluded.body,
  version = excluded.version,
  form_category = excluded.form_category,
  source_asset = excluded.source_asset,
  description = excluded.description,
  fields = excluded.fields;

-- Enrich existing global templates
update public.consent_templates
set
  description = 'Republic Act No. 10173 — health data processing consent',
  source_asset = 'PDA',
  fields = '[
    {"id":"data_use_ack","type":"yes_no","label":"I consent to collection and use of my personal and health information per the Data Privacy Act","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]'::jsonb
where organization_id is null and slug = 'dpa-consent';

update public.consent_templates
set
  description = 'General dental examination and treatment consent',
  source_asset = 'DRG',
  body = 'I consent to dental examination, diagnosis, and treatment as recommended by my dental provider at {{clinic_name}}.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}',
  fields = '[
    {"id":"emergency_contact","type":"text","label":"Emergency contact name & number","required":true,"placeholder":"Name, phone"},
    {"id":"procedure_acknowledged","type":"yes_no","label":"I understand the proposed treatment and alternatives were explained","required":true},
    {"id":"questions_answered","type":"checkbox","label":"I had the opportunity to ask questions and they were answered","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]'::jsonb
where organization_id is null and slug = 'general-treatment';

update public.consent_templates
set fields = '[
  {"id":"ortho_duration_ack","type":"yes_no","label":"I understand treatment duration varies and cooperation is required","required":true},
  {"id":"hygiene_ack","type":"yes_no","label":"I understand good oral hygiene is essential during orthodontic treatment","required":true},
  {"id":"retainer_ack","type":"yes_no","label":"I understand retainers are required after active treatment to prevent relapse","required":true},
  {"id":"patient_initials","type":"initials","label":"Initials","required":true}
]'::jsonb
where organization_id is null and slug = 'ortho-agreement';

create or replace function public.get_org_consent_templates()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ct.id,
        'slug', ct.slug,
        'name', ct.name,
        'body', ct.body,
        'version', ct.version,
        'is_active', ct.is_active,
        'is_global', ct.organization_id is null,
        'organization_id', ct.organization_id,
        'fields', coalesce(ct.fields, '[]'::jsonb),
        'form_category', coalesce(ct.form_category, 'consent'),
        'is_default', coalesce(ct.is_default, false),
        'source_asset', ct.source_asset,
        'description', ct.description
      )
      order by ct.name, ct.organization_id nulls first
    ),
    '[]'::jsonb
  )
  from public.consent_templates ct
  where ct.is_active = true
    and (ct.organization_id is null or ct.organization_id = public.current_user_org_id());
$$;
