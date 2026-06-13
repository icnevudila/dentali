-- ADIM 1: Eksik tablo/kolon/extension (hata vermez, tekrar calistirilabilir)

create extension if not exists pgcrypto;

create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.patient_medical_histories (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null default 1,
  allergies jsonb default '[]'::jsonb,
  medications jsonb default '[]'::jsonb,
  conditions jsonb default '[]'::jsonb,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_medical_history_patient
  on public.patient_medical_histories(patient_id, version desc);

alter table public.consent_templates
  add column if not exists fields jsonb not null default '[]'::jsonb;

alter table public.consent_templates
  add column if not exists form_category text not null default 'consent',
  add column if not exists is_default boolean not null default false,
  add column if not exists source_asset text,
  add column if not exists description text;

alter table public.patient_consents
  add column if not exists field_responses jsonb,
  add column if not exists body_snapshot text;

-- Global consent upsert (partial unique index — 42P10 onlemek icin)
delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
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
