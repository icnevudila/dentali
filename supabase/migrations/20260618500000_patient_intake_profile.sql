-- Extended patient fields for PDA dental chart prefill (stored on patient record)

alter table public.patients
  add column if not exists intake_profile jsonb not null default '{}'::jsonb;

comment on column public.patients.intake_profile is
  'Demographics, dental history, physician, and structured medical answers for PDA form prefill.';

create index if not exists idx_patients_intake_profile
  on public.patients using gin (intake_profile);

notify pgrst, 'reload schema';
