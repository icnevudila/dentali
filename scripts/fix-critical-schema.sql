-- Hizli fix: sadece bildirilen 2 blocker (functions-only sonrasi)
-- waitlist_entries tablosu yoksa once npm run db:bundle:schema veya tam schema bundle gerekir.

create table if not exists public.patient_intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  payload jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_patient_intakes_branch on public.patient_intakes(branch_id, created_at desc);

alter table public.patient_intakes enable row level security;

drop policy if exists patient_intakes_org on public.patient_intakes;
create policy patient_intakes_org on public.patient_intakes for all using (
  organization_id = public.current_user_org_id()
);

alter table public.waitlist_entries
  add column if not exists slot_alert_sent_at timestamptz;
