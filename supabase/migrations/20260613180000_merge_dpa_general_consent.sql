-- Disable the separate dpa-consent template
update public.consent_templates
set is_active = false, is_default = false
where organization_id is null and slug = 'dpa-consent';

-- Merge DPA into general-treatment template
update public.consent_templates
set
  name = 'Data Privacy & General Treatment Consent',
  description = 'Combined consent for data processing (DPA) and general dental treatment',
  source_asset = 'PDA',
  body = 'DATA PRIVACY CONSENT (Republic Act No. 10173):
I consent to the collection, use, and processing of my personal and health information in accordance with the Data Privacy Act of 2012.

GENERAL TREATMENT CONSENT:
I consent to dental examination, diagnosis, and treatment as recommended by my dental provider at {{clinic_name}}.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}',
  fields = '[
    {"id":"data_use_ack","type":"yes_no","label":"I consent to collection and use of my personal and health information per the Data Privacy Act","required":true},
    {"id":"procedure_acknowledged","type":"yes_no","label":"I understand the proposed treatment and alternatives were explained","required":true},
    {"id":"questions_answered","type":"checkbox","label":"I had the opportunity to ask questions and they were answered","required":true},
    {"id":"patient_initials","type":"initials","label":"Patient initials","required":true}
  ]'::jsonb
where organization_id is null and slug = 'general-treatment';