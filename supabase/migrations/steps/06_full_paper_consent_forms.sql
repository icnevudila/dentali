-- ADIM 6: Kagit formlar (DRG/PDA) — uzun metin + secimli alanlar
-- SQL Editor'da calistir, sonra Reload schema
-- Eski tek cumlelik sablonlari ZORLA gunceller + tum form katalogunu ekler
-- (Adim 1 atlandiysa asagidaki ONKOSUL blogu eksik kolonlari ekler)

-- ========== ONKOSUL (Adim 1 — tekrar calistirilabilir) ==========
create extension if not exists pgcrypto;

alter table public.consent_templates
  add column if not exists fields jsonb not null default '[]'::jsonb;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'consent_templates'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%organization_id%slug%'
  ) then
    alter table public.consent_templates
      add constraint consent_templates_organization_id_slug_key unique (organization_id, slug);
  end if;
exception
  when duplicate_object then null;
end $$;

drop index if exists public.idx_consent_templates_global_slug;
create unique index idx_consent_templates_global_slug
  on public.consent_templates (slug)
  where organization_id is null;

-- ========== DPA (PDA) ==========
update public.consent_templates
set
  name = 'Data Privacy Act (DPA) Consent',
  version = '2.2',
  form_category = 'consent',
  is_default = true,
  source_asset = 'PDA',
  description = 'Republic Act No. 10173 — collection, use, and sharing of personal health data',
  body = 'DATA PRIVACY ACT CONSENT (Republic Act No. 10173)

Clinic: {{clinic_name}}
Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}

I understand that this clinic collects personal information and sensitive personal information (including health and dental records) to provide dental care, maintain my chart, process payments, and comply with applicable laws.

Please complete each section below. Your selections are part of this signed record.',
  fields = $json$[
    {"id":"pda_intro","type":"paragraph","label":"Purpose of collection: dental diagnosis, treatment, billing, appointment coordination, insurance/HMO claims (when applicable), and clinic quality records."},
    {"id":"purpose_scope","type":"select","label":"Which purposes apply to you today?","required":true,"options":["Dental treatment and chart only","Treatment + HMO/insurance claims","Treatment + reminders (SMS/email/phone)","All of the above"]},
    {"id":"data_use_ack","type":"yes_no","label":"I consent to the collection, use, and processing of my personal and health information for my dental care","required":true},
    {"id":"share_hmo_ack","type":"yes_no","label":"I consent to sharing necessary information with my HMO/insurance provider for claims (if applicable)","required":false},
    {"id":"contact_ack","type":"checkbox","label":"I agree to be contacted for appointments, recalls, and clinic updates via phone/SMS/email","required":true},
    {"id":"rights_ack","type":"yes_no","label":"I understand I may request access, correction, or withdrawal of consent under RA 10173","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true,"placeholder":"e.g. MS"}
  ]$json$::jsonb
where organization_id is null and slug = 'dpa-consent';

-- ========== General treatment (DRG CONFORME master) ==========
update public.consent_templates
set
  name = 'Informed Consent — General Treatment (DRG)',
  version = '2.0',
  form_category = 'consent',
  is_default = true,
  source_asset = 'DRG',
  description = 'Master informed consent — treatment, medications, procedures (DRG dental record)',
  body = 'INFORMED CONSENT — GENERAL DENTAL TREATMENT

Clinic: {{clinic_name}}
Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}

I hereby authorize the dentist and staff to perform upon me dental treatment deemed necessary or advisable, including the use of local anesthesia and medications when indicated.

I understand that dentistry is not an exact science. I authorize my dentist to make changes in the course of treatment based on clinical findings. I agree to be responsible for fees for services rendered and associated laboratory costs.

Read each section below and answer Yes/No or complete the fields as indicated.',
  fields = $json$[
    {"id":"sec_general","type":"paragraph","label":"GENERAL UNDERSTANDING — No guarantee is made regarding the outcome of any dental procedure. Alternative treatments and risks have been explained when applicable."},
    {"id":"ack_general","type":"yes_no","label":"I understand the above and consent to examination and treatment at this clinic","required":true},
    {"id":"sec_treatment","type":"paragraph","label":"TREATMENT TO BE DONE — Planned treatment will be recorded in my dental chart."},
    {"id":"treatment_today","type":"text","label":"Treatment / procedure discussed today","required":true,"placeholder":"e.g. prophylaxis, filling #26, consultation"},
    {"id":"ack_treatment","type":"yes_no","label":"I consent to the treatment described","required":true},
    {"id":"sec_meds","type":"paragraph","label":"DRUGS AND MEDICATIONS — Antibiotics, pain relievers, anesthetics, or other drugs may be prescribed or administered."},
    {"id":"ack_meds","type":"yes_no","label":"I understand medications may be used; I have disclosed allergies and current medicines","required":true},
    {"id":"sec_plan_change","type":"paragraph","label":"CHANGES IN TREATMENT PLAN — Additional or different treatment may be required after examination."},
    {"id":"ack_plan_change","type":"yes_no","label":"I agree to discuss and consent to material changes before they are performed when possible","required":true},
    {"id":"sec_xray","type":"paragraph","label":"RADIOGRAPHS (X-RAYS) — May be required for diagnosis. Low radiation; precautions taken."},
    {"id":"ack_xray","type":"yes_no","label":"I consent to dental radiographs when recommended","required":true},
    {"id":"sec_extraction","type":"paragraph","label":"REMOVAL OF TEETH — Risks include pain, swelling, bleeding, infection, nerve injury, dry socket."},
    {"id":"ack_extraction","type":"yes_no","label":"I understand extraction risks (applies if extraction is part of my care)","required":false},
    {"id":"sec_cost","type":"paragraph","label":"FEES — I am responsible for professional fees and laboratory charges as discussed."},
    {"id":"ack_cost","type":"yes_no","label":"I agree to pay applicable clinic and laboratory fees","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]$json$::jsonb
where organization_id is null and slug = 'general-treatment';

-- ========== Ortho ==========
update public.consent_templates
set
  form_category = 'consent',
  source_asset = 'DRG',
  description = 'Orthodontic treatment agreement, risks, and retainer compliance',
  body = 'ORTHODONTIC TREATMENT AGREEMENT

Clinic: {{clinic_name}}
Patient: {{patient_name}}
Date: {{today_date}}

I request and authorize orthodontic treatment. I understand duration varies, cooperation is required, and retainers are mandatory after active treatment to reduce relapse.',
  fields = $json$[
    {"id":"ortho_duration_ack","type":"yes_no","label":"I understand treatment duration varies and cooperation is required","required":true},
    {"id":"hygiene_ack","type":"yes_no","label":"I understand good oral hygiene is essential during orthodontic treatment","required":true},
    {"id":"retainer_ack","type":"yes_no","label":"I understand retainers are required after active treatment to prevent relapse","required":true},
    {"id":"appliance_type","type":"select","label":"Appliance type discussed","required":true,"options":["Fixed braces","Clear aligners","Removable appliance","Other / combination"]},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]$json$::jsonb
where organization_id is null and slug = 'ortho-agreement';

-- ========== Procedure-specific forms (katalog) ==========
insert into public.consent_templates (
  organization_id, slug, name, body, version, is_active,
  form_category, is_default, source_asset, description, fields
) values
(
  null, 'drg-conforme', 'CONFORME — Informed Consent (DRG)',
  'CONFORME (Informed Consent)

Clinic: {{clinic_name}} · Patient: {{patient_name}} · {{today_date}}

I authorize dental treatment including anesthesia when indicated. I understand dentistry is not an exact science and agree to applicable fees.',
  '1.1', true, 'consent', false, 'DRG', 'Standard CONFORME block from DRG record',
  $json$[
    {"id":"anesthesia_ack","type":"yes_no","label":"I understand anesthesia/sedation may be used","required":true},
    {"id":"changes_ack","type":"yes_no","label":"I authorize necessary changes during treatment","required":true},
    {"id":"cost_ack","type":"yes_no","label":"I agree to clinic and laboratory fees","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'radiograph-consent', 'Radiograph / X-Ray Consent',
  'RADIOGRAPH CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Diagnostic imaging consent',
  $json$[
    {"id":"pregnancy_status","type":"yes_no","label":"Are you pregnant or could you be pregnant?","required":true},
    {"id":"reason","type":"text","label":"Reason for X-rays today","required":true,"placeholder":"e.g. new patient exam, pre-extraction"},
    {"id":"risks_explained","type":"yes_no","label":"Risks and purpose were explained","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'extraction-consent', 'Extraction / Removal Consent',
  'EXTRACTION CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Tooth extraction consent',
  $json$[
    {"id":"tooth_site","type":"text","label":"Tooth number / site","required":true,"placeholder":"e.g. #16"},
    {"id":"alternatives_ack","type":"yes_no","label":"Alternatives to extraction were discussed","required":true},
    {"id":"risks_ack","type":"yes_no","label":"Risks (pain, swelling, nerve injury, dry socket, etc.) were explained","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'crown-bridge-consent', 'Crown / Bridge Consent',
  'CROWN / BRIDGE CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Fixed prosthodontics',
  $json$[
    {"id":"tooth_site","type":"text","label":"Tooth/teeth involved","required":true},
    {"id":"material","type":"select","label":"Material discussed","required":true,"options":["Porcelain fused to metal","Full ceramic","Zirconia","Other"]},
    {"id":"procedure_explained","type":"yes_no","label":"Procedure, risks, and alternatives explained","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'root-canal-consent', 'Endodontic / Root Canal Consent',
  'ROOT CANAL CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Endodontic therapy',
  $json$[
    {"id":"tooth_site","type":"text","label":"Tooth number","required":true},
    {"id":"success_ack","type":"yes_no","label":"I understand success is not guaranteed; retreatment or extraction may be needed","required":true},
    {"id":"risks_ack","type":"yes_no","label":"Risks and alternatives were explained","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'periodontal-consent', 'Periodontal Treatment Consent',
  'PERIODONTAL CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Periodontal therapy',
  $json$[
    {"id":"treatment_desc","type":"text","label":"Treatment described","required":true,"placeholder":"e.g. scaling & root planing, maintenance"},
    {"id":"maintenance_ack","type":"yes_no","label":"I understand maintenance visits are required","required":true},
    {"id":"risks_ack","type":"yes_no","label":"Risks and home care instructions explained","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'filling-consent', 'Filling / Restoration Consent',
  'FILLING CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Restorative treatment',
  $json$[
    {"id":"tooth_site","type":"text","label":"Tooth number / surface","required":true},
    {"id":"material","type":"select","label":"Restorative material","required":true,"options":["Composite","Amalgam","Glass ionomer","Other"]},
    {"id":"material_ack","type":"yes_no","label":"Material options and longevity were discussed","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'denture-consent', 'Denture Consent',
  'DENTURE CONSENT — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Removable prosthodontics',
  $json$[
    {"id":"denture_type","type":"select","label":"Type of denture","required":true,"options":["Complete upper","Complete lower","Partial removable","Immediate denture"]},
    {"id":"expectations_ack","type":"yes_no","label":"Adaptation time and adjustment visits were explained","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'medication-risk-consent', 'Medication Risk Consent',
  'MEDICATION RISK — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'PDA', 'Medication risks acknowledgment',
  $json$[
    {"id":"med_list","type":"text","label":"Current medications / supplements (list or N/A)","required":true},
    {"id":"allergy_list","type":"text","label":"Known drug allergies (list or N/A)","required":true},
    {"id":"med_list_reviewed","type":"yes_no","label":"Medications were reviewed with the dentist","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
),
(
  null, 'treatment-plan-change-consent', 'Change in Treatment Plan Consent',
  'TREATMENT PLAN CHANGE — {{clinic_name}} · {{patient_name}} · {{today_date}}',
  '1.1', true, 'consent', false, 'DRG', 'Mid-treatment plan change',
  $json$[
    {"id":"change_summary","type":"text","label":"Summary of change","required":true},
    {"id":"reason","type":"select","label":"Reason for change","required":true,"options":["New clinical finding","Patient request","Complication during treatment","Insurance / cost","Other"]},
    {"id":"fees_discussed","type":"yes_no","label":"Fee and appointment impact discussed","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]$json$::jsonb
)
on conflict (slug) where (organization_id is null) do update set
  name = excluded.name,
  body = excluded.body,
  version = excluded.version,
  form_category = excluded.form_category,
  source_asset = excluded.source_asset,
  description = excluded.description,
  fields = excluded.fields,
  is_active = true;
