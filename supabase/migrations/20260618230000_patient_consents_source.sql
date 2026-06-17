-- Track where a pending consent row was created (portal, appointment, kiosk, staff).

alter table public.patient_consents
  add column if not exists source text;

comment on column public.patient_consents.source is
  'Origin of the consent request: portal, appointment, kiosk, staff, etc.';
