-- Fix: column "source" of relation "patient_consents" does not exist
-- Run in Supabase SQL Editor after APPLY_CONSENT_E2E_MASTER.sql

alter table public.patient_consents
  add column if not exists source text;

comment on column public.patient_consents.source is
  'Origin of the consent request: portal, appointment, kiosk, staff, etc.';
