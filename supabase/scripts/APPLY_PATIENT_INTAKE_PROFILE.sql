-- Run in Supabase SQL editor if migration not applied via CLI
alter table public.patients
  add column if not exists intake_profile jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
