-- Wave 2: Audit logs, medical history, consents, appointments (MVP)

-- General audit log (separate from session login/logout)
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

alter table public.organization_audit_logs enable row level security;

create policy org_audit_select on public.organization_audit_logs for select using (
  organization_id = public.current_user_org_id() and public.user_is_org_admin()
);

create policy org_audit_insert on public.organization_audit_logs for insert with check (
  organization_id = public.current_user_org_id() and profile_id = auth.uid()
);

-- Medical history (versioned snapshot MVP)
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

create index if not exists idx_medical_history_patient on public.patient_medical_histories(patient_id, version desc);

alter table public.patient_medical_histories enable row level security;

create policy medical_history_select on public.patient_medical_histories for select using (
  organization_id = public.current_user_org_id()
);

create policy medical_history_insert on public.patient_medical_histories for insert with check (
  organization_id = public.current_user_org_id()
);

-- Consent forms
create table if not exists public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  body text not null,
  version text not null default '1.0',
  is_active boolean default true,
  unique(organization_id, slug)
);

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  template_slug text not null,
  template_name text not null,
  status text not null default 'pending' check (status in ('pending', 'signed', 'voided')),
  signed_at timestamptz,
  signed_by uuid references public.profiles(id),
  signature_data text,
  created_at timestamptz default now(),
  unique(patient_id, template_slug)
);

alter table public.consent_templates enable row level security;
alter table public.patient_consents enable row level security;

create policy consent_templates_select on public.consent_templates for select using (
  organization_id is null or organization_id = public.current_user_org_id()
);

create policy patient_consents_all on public.patient_consents for all using (
  organization_id = public.current_user_org_id()
);

-- Appointments MVP
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  provider_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer default 30,
  purpose text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_appointments_branch_date on public.appointments(branch_id, scheduled_at);

alter table public.appointments enable row level security;

create policy appointments_select on public.appointments for select using (
  organization_id = public.current_user_org_id()
);

create policy appointments_insert on public.appointments for insert with check (
  organization_id = public.current_user_org_id()
);

create policy appointments_update on public.appointments for update using (
  organization_id = public.current_user_org_id()
);

-- Dashboard stats RPC
create or replace function public.get_dashboard_stats(p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public.current_user_org_id();
declare v_patients bigint; v_today_appts bigint; v_pending_consents bigint;
begin
  select count(*) into v_patients from public.patients p
  where p.organization_id = v_org and p.status = 'active';

  select count(*) into v_today_appts from public.appointments a
  where a.organization_id = v_org
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and a.scheduled_at::date = current_date
    and a.status in ('scheduled', 'confirmed');

  select count(*) into v_pending_consents from public.patient_consents pc
  where pc.organization_id = v_org and pc.status = 'pending'
    and (p_branch_id is null or pc.branch_id = p_branch_id);

  return jsonb_build_object(
    'active_patients', v_patients,
    'today_appointments', v_today_appts,
    'pending_consents', v_pending_consents
  );
end; $$;

-- get_org_staff: 20260612230000_staff_phone_digest.sql (phone + is_owner_or_admin)

-- Seed global consent templates
insert into public.consent_templates (organization_id, slug, name, body, version) values
(null, 'dpa-consent', 'Data Privacy Act (DPA) Consent',
 'I consent to the collection, use, and processing of my personal and health information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).', '2.1'),
(null, 'general-treatment', 'General Treatment Consent',
 'I consent to dental examination, diagnosis, and treatment as recommended by my dental provider.', '1.0'),
(null, 'ortho-agreement', 'Orthodontic Agreement',
 'I understand that orthodontic treatment involves braces or aligners. Risks include decay, root resorption, and relapse if retainers are not worn.', '1.2')
on conflict do nothing;

-- Default clinic hours for branches without hours
create or replace function public.ensure_branch_clinic_hours(p_branch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d integer;
begin
  for d in 0..6 loop
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values (p_branch_id, d,
      case when d in (0, 6) then null else '09:00'::time end,
      case when d in (0, 6) then null else '18:00'::time end,
      d in (0, 6))
    on conflict (branch_id, day_of_week) do nothing;
  end loop;
end; $$;
