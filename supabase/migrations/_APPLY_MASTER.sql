-- DENTALI MASTER APPLY BUNDLE
-- Generated: 2026-06-11 07:18
-- Icerik: hasta modulu + kagit consent + multi-branch tenant
-- Supabase SQL Editor'da TEK seferde calistir, sonra Settings -> API -> Reload schema
-- Not: /sign/[token] RPC'leri patient bundle icinde (step 04) zaten var.

SET client_min_messages TO WARNING;

-- ######################################################################
-- BEGIN _APPLY_PATIENT_COMPLETE.sql
-- ######################################################################

-- PATIENT MODULE COMPLETE BUNDLE
-- Generated: 2026-06-11 07:18
-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema

-- === step: 01_prerequisites.sql (once, before consent upserts) ===
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


-- === migration: 20260610000000_consent_fields_and_signing_tokens.sql ===
-- Consent fillable fields, patient responses, and public signing tokens

-- Eski imzalar (2 parametre) yeni overload ile cakismasin
drop function if exists public.lock_signed_consent(uuid, text);
drop function if exists public.create_consent_signing_token(uuid, text, int);
drop function if exists public.get_consent_by_signing_token(text);
drop function if exists public.lock_consent_via_signing_token(text, text, jsonb, text);
drop function if exists public.lock_signed_consent(uuid, text, jsonb, text);
drop function if exists public.upsert_org_consent_template(jsonb);

alter table public.consent_templates
  add column if not exists fields jsonb not null default '[]'::jsonb;

alter table public.patient_consents
  add column if not exists field_responses jsonb,
  add column if not exists body_snapshot text;

-- Default fillable fields on global general-treatment template
update public.consent_templates
set fields = '[
  {"id":"emergency_contact","type":"text","label":"Emergency contact name & number","required":true,"placeholder":"Name, phone"},
  {"id":"procedure_acknowledged","type":"yes_no","label":"I understand the proposed treatment and alternatives were explained","required":true},
  {"id":"questions_answered","type":"checkbox","label":"I had the opportunity to ask questions and they were answered","required":true},
  {"id":"patient_initials","type":"initials","label":"Patient initials","required":true,"placeholder":"e.g. MS"}
]'::jsonb
where slug = 'general-treatment'
  and organization_id is null
  and fields = '[]'::jsonb;

create table if not exists public.consent_signing_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_consent_id uuid not null references public.patient_consents(id) on delete cascade,
  token text not null unique,
  channel text not null default 'qr' check (channel in ('kiosk', 'sms', 'email', 'qr')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consent_signing_tokens_consent_idx
  on public.consent_signing_tokens (patient_consent_id);

alter table public.consent_signing_tokens enable row level security;

drop policy if exists consent_signing_tokens_staff on public.consent_signing_tokens;
drop policy if exists consent_signing_tokens_staff on public.consent_signing_tokens;
create policy consent_signing_tokens_staff on public.consent_signing_tokens
  for select to authenticated
  using (
    exists (
      select 1 from public.patient_consents pc
      where pc.id = patient_consent_id
        and pc.organization_id = public.current_user_org_id()
    )
  );

-- Staff: create signing link
create or replace function public.create_consent_signing_token(
  p_consent_id uuid,
  p_channel text default 'qr',
  p_ttl_hours int default 72
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_token text;
begin
  select * into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id();

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status <> 'pending' then
    raise exception 'Consent is not pending';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    p_consent_id,
    v_token,
    coalesce(nullif(trim(p_channel), ''), 'qr'),
    now() + make_interval(hours => greatest(p_ttl_hours, 1)),
    auth.uid()
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', (now() + make_interval(hours => greatest(p_ttl_hours, 1)))::text
  );
end;
$$;

grant execute on function public.create_consent_signing_token(uuid, text, int) to authenticated;

-- Public: load consent for signing (anon)
create or replace function public.get_consent_by_signing_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_template record;
  v_patient record;
  v_org record;
begin
  select t.*, pc.*
  into v_row
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
    and pc.status = 'pending';

  if v_row.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  select slug, name, body, version, fields
  into v_template
  from public.consent_templates
  where slug = v_row.template_slug
    and is_active = true
    and (organization_id = v_row.organization_id or organization_id is null)
  order by organization_id nulls last
  limit 1;

  select first_name, last_name, date_of_birth
  into v_patient
  from public.patients
  where id = v_row.patient_id;

  select name into v_org from public.organizations where id = v_row.organization_id;

  return jsonb_build_object(
    'consent_id', v_row.patient_consent_id,
    'template_slug', v_row.template_slug,
    'template_name', coalesce(v_template.name, v_row.template_name),
    'template_body', coalesce(v_template.body, ''),
    'template_version', coalesce(v_template.version, '1.0'),
    'fields', coalesce(v_template.fields, '[]'::jsonb),
    'patient_first_name', v_patient.first_name,
    'patient_last_name', v_patient.last_name,
    'patient_dob', v_patient.date_of_birth,
    'org_name', coalesce(v_org.name, 'Clinic')
  );
end;
$$;

grant execute on function public.get_consent_by_signing_token(text) to anon, authenticated;

-- Public: sign via token
create or replace function public.lock_consent_via_signing_token(
  p_token text,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
  v_consent record;
  v_parsed jsonb;
  v_image text;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
  end if;

  select t.*, pc.id as cid, pc.status as cstatus, pc.organization_id, pc.branch_id, pc.template_slug
  into v_token
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
  for update of t, pc;

  if v_token.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  if v_token.cstatus <> 'pending' then
    raise exception 'Consent already signed or voided';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = null,
    signature_data = p_signature_data,
    field_responses = p_field_responses,
    body_snapshot = p_body_snapshot
  where id = v_token.patient_consent_id;

  update public.consent_signing_tokens
  set used_at = now()
  where id = v_token.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_token.organization_id,
    v_token.branch_id,
    null,
    'consent.signed_via_token',
    'patient_consent',
    v_token.patient_consent_id::text,
    jsonb_build_object(
      'template_slug', v_token.template_slug,
      'channel', v_token.channel,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient')
    )
  );
end;
$$;

grant execute on function public.lock_consent_via_signing_token(text, text, jsonb, text) to anon, authenticated;

-- Extend staff signing with field responses
create or replace function public.lock_signed_consent(
  p_consent_id uuid,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_parsed jsonb;
  v_image text;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
  end if;

  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status = 'signed' then
    raise exception 'Consent already signed';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is voided';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = auth.uid(),
    signature_data = p_signature_data,
    field_responses = coalesce(p_field_responses, field_responses),
    body_snapshot = coalesce(p_body_snapshot, body_snapshot)
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.signed',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient'),
      'captured_at', coalesce(v_parsed->>'capturedAt', now()::text)
    )
  );
end;
$$;

grant execute on function public.lock_signed_consent(uuid, text, jsonb, text) to authenticated;

-- Org template admin: persist fields
create or replace function public.upsert_org_consent_template(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_slug text := nullif(trim(p_payload->>'slug'), '');
  v_name text := nullif(trim(p_payload->>'name'), '');
  v_body text := nullif(trim(p_payload->>'body'), '');
  v_version text := coalesce(nullif(trim(p_payload->>'version'), ''), '1.0');
  v_is_active boolean := coalesce((p_payload->>'is_active')::boolean, true);
  v_fields jsonb := coalesce(p_payload->'fields', '[]'::jsonb);
  v_id uuid;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if v_slug is null or v_name is null or v_body is null then
    raise exception 'slug, name, and body are required';
  end if;

  if not exists (
    select 1 from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid()
      and public.has_permission('settings.manage', sba.branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  insert into public.consent_templates (
    organization_id, slug, name, body, version, is_active, fields
  ) values (
    v_org, v_slug, v_name, v_body, v_version, v_is_active, v_fields
  )
  on conflict (organization_id, slug) do update
  set
    name = excluded.name,
    body = excluded.body,
    version = excluded.version,
    is_active = excluded.is_active,
    fields = excluded.fields;

  select id into v_id
  from public.consent_templates
  where organization_id = v_org and slug = v_slug;

  insert into public.organization_audit_logs (
    organization_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    auth.uid(),
    'consent_template.upserted',
    'consent_template',
    v_id::text,
    jsonb_build_object('slug', v_slug, 'version', v_version)
  );

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'version', v_version);
end;
$$;

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
        'fields', coalesce(ct.fields, '[]'::jsonb)
      )
      order by ct.slug, ct.organization_id nulls first
    ),
    '[]'::jsonb
  )
  from public.consent_templates ct
  where ct.organization_id is null
     or ct.organization_id = public.current_user_org_id();
$$;


-- === migration: 20260610100000_search_patients_filters.sql ===
-- Patient registry list: status, last-visit date, sort, intake score
create or replace function public.search_patients(
  p_query text,
  p_branch_id uuid default null,
  p_limit int default 20,
  p_offset int default 0,
  p_status text default 'active',
  p_last_visit_from timestamptz default null,
  p_last_visit_to timestamptz default null,
  p_never_visited boolean default false,
  p_sort text default 'name'
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  email text,
  status text,
  last_visit_at timestamptz,
  intake_pct int,
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with base as (
    select
      p.id,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.phone,
      p.email,
      p.status,
      pbl.last_visit_at,
      least(100, (
        (case when coalesce(p.phone, '') <> '' then 25 else 0 end)
        + (case when p.date_of_birth is not null then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_medical_histories pmh
            where pmh.patient_id = p.id
            limit 1
          ) then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_consents pc
            where pc.patient_id = p.id and pc.status = 'signed'
            limit 1
          ) then 25 else 0 end)
      ))::int as intake_pct
    from public.patients p
    left join public.patient_branch_links pbl
      on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
    where p.organization_id = public.current_user_org_id()
      and (
        p_status is null
        or p_status = 'all'
        or p.status = p_status
      )
      and (
        p_query is null
        or p_query = ''
        or p.first_name ilike '%' || p_query || '%'
        or p.last_name ilike '%' || p_query || '%'
        or p.phone ilike '%' || p_query || '%'
      )
      and (
        (not p_never_visited)
        or pbl.last_visit_at is null
      )
      and (
        p_never_visited
        or (
          (p_last_visit_from is null or pbl.last_visit_at >= p_last_visit_from)
          and (p_last_visit_to is null or pbl.last_visit_at <= p_last_visit_to)
        )
      )
  )
  select
    b.id,
    b.first_name,
    b.last_name,
    b.date_of_birth,
    b.phone,
    b.email,
    b.status,
    b.last_visit_at,
    b.intake_pct,
    count(*) over() as total_count
  from base b
  order by
    case when coalesce(p_sort, 'name') = 'last_visit_desc' then b.last_visit_at end desc nulls last,
    case when p_sort = 'last_visit_asc' then b.last_visit_at end asc nulls last,
    b.last_name asc,
    b.first_name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;


-- === migration: 20260610100001_fix_patients_rls_recursion.sql ===
-- Break infinite RLS recursion: patients_select → patient_branch_links → patients

create or replace function public.patient_org_id(p_patient_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id from public.patients where id = p_patient_id;
$$;

grant execute on function public.patient_org_id(uuid) to authenticated;

drop policy if exists patient_branch_links_all on public.patient_branch_links;

drop policy if exists patient_branch_links_all on public.patient_branch_links;
create policy patient_branch_links_all on public.patient_branch_links
  for all to authenticated
  using (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  );

drop policy if exists patient_contacts_all on public.patient_contacts;

drop policy if exists patient_contacts_all on public.patient_contacts;
create policy patient_contacts_all on public.patient_contacts
  for all to authenticated
  using (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  );


-- === migration: 20260610120000_clinic_paper_consent_templates.sql ===
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
create unique index if not exists idx_consent_templates_global_slug
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


-- === step: 02_search_patients.sql ===
-- ADIM 2: Hasta listesi RPC (/patients hatasi)

create or replace function public.search_patients(
  p_query text,
  p_branch_id uuid default null,
  p_limit int default 20,
  p_offset int default 0,
  p_status text default 'active',
  p_last_visit_from timestamptz default null,
  p_last_visit_to timestamptz default null,
  p_never_visited boolean default false,
  p_sort text default 'name'
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  email text,
  status text,
  last_visit_at timestamptz,
  intake_pct int,
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with base as (
    select
      p.id,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.phone,
      p.email,
      p.status,
      pbl.last_visit_at,
      least(100, (
        (case when coalesce(p.phone, '') <> '' then 25 else 0 end)
        + (case when p.date_of_birth is not null then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_medical_histories pmh
            where pmh.patient_id = p.id
            limit 1
          ) then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_consents pc
            where pc.patient_id = p.id and pc.status = 'signed'
            limit 1
          ) then 25 else 0 end)
      ))::int as intake_pct
    from public.patients p
    left join public.patient_branch_links pbl
      on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
    where p.organization_id = public.current_user_org_id()
      and (
        p_status is null
        or p_status = 'all'
        or p.status = p_status
      )
      and (
        p_query is null
        or p_query = ''
        or p.first_name ilike '%' || p_query || '%'
        or p.last_name ilike '%' || p_query || '%'
        or p.phone ilike '%' || p_query || '%'
      )
      and (
        (not p_never_visited)
        or pbl.last_visit_at is null
      )
      and (
        p_never_visited
        or (
          (p_last_visit_from is null or pbl.last_visit_at >= p_last_visit_from)
          and (p_last_visit_to is null or pbl.last_visit_at <= p_last_visit_to)
        )
      )
  )
  select
    b.id,
    b.first_name,
    b.last_name,
    b.date_of_birth,
    b.phone,
    b.email,
    b.status,
    b.last_visit_at,
    b.intake_pct,
    count(*) over() as total_count
  from base b
  order by
    case when coalesce(p_sort, 'name') = 'last_visit_desc' then b.last_visit_at end desc nulls last,
    case when p_sort = 'last_visit_asc' then b.last_visit_at end asc nulls last,
    b.last_name asc,
    b.first_name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

create or replace function public.patient_org_id(p_patient_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id from public.patients where id = p_patient_id;
$$;

grant execute on function public.patient_org_id(uuid) to authenticated;

drop policy if exists patient_branch_links_all on public.patient_branch_links;

create policy patient_branch_links_all on public.patient_branch_links
  for all to authenticated
  using (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  );

drop policy if exists patient_contacts_all on public.patient_contacts;

create policy patient_contacts_all on public.patient_contacts
  for all to authenticated
  using (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  );


-- === step: 03_consent_templates.sql ===
-- ADIM 3: Consent sablonlari (once ADIM 1 calismis olmali)

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
  fields = coalesce(nullif(fields, '[]'::jsonb), '[
    {"id":"data_use_ack","type":"yes_no","label":"I consent to collection and use of my personal and health information per the Data Privacy Act","required":true},
    {"id":"patient_initials","type":"initials","label":"Initials","required":true}
  ]'::jsonb)
where organization_id is null and slug = 'dpa-consent';

update public.consent_templates
set
  description = 'General dental examination and treatment consent',
  source_asset = 'DRG',
  body = 'I consent to dental examination, diagnosis, and treatment as recommended by my dental provider at {{clinic_name}}.

Patient: {{patient_name}}
Date of birth: {{patient_dob}}
Date: {{today_date}}'
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

-- === step: 04_consent_signing_rpcs.sql ===
-- ADIM 4 (opsiyonel): Consent imza linki RPC'leri
-- ADIM 1-2 basarili olduktan sonra. Hata verirse mesaji kaydet, ADIM 3 yeterli olabilir.

drop function if exists public.lock_signed_consent(uuid, text);
drop function if exists public.create_consent_signing_token(uuid, text, int);
drop function if exists public.get_consent_by_signing_token(text);
drop function if exists public.lock_consent_via_signing_token(text, text, jsonb, text);
drop function if exists public.lock_signed_consent(uuid, text, jsonb, text);
drop function if exists public.upsert_org_consent_template(jsonb);
create table if not exists public.consent_signing_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_consent_id uuid not null references public.patient_consents(id) on delete cascade,
  token text not null unique,
  channel text not null default 'qr' check (channel in ('kiosk', 'sms', 'email', 'qr')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consent_signing_tokens_consent_idx
  on public.consent_signing_tokens (patient_consent_id);

alter table public.consent_signing_tokens enable row level security;

drop policy if exists consent_signing_tokens_staff on public.consent_signing_tokens;
create policy consent_signing_tokens_staff on public.consent_signing_tokens
  for select to authenticated
  using (
    exists (
      select 1 from public.patient_consents pc
      where pc.id = patient_consent_id
        and pc.organization_id = public.current_user_org_id()
    )
  );

-- Staff: create signing link
create or replace function public.create_consent_signing_token(
  p_consent_id uuid,
  p_channel text default 'qr',
  p_ttl_hours int default 72
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_token text;
begin
  select * into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id();

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status <> 'pending' then
    raise exception 'Consent is not pending';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    p_consent_id,
    v_token,
    coalesce(nullif(trim(p_channel), ''), 'qr'),
    now() + make_interval(hours => greatest(p_ttl_hours, 1)),
    auth.uid()
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', (now() + make_interval(hours => greatest(p_ttl_hours, 1)))::text
  );
end;
$$;

grant execute on function public.create_consent_signing_token(uuid, text, int) to authenticated;

-- Public: load consent for signing (anon)
create or replace function public.get_consent_by_signing_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_template record;
  v_patient record;
  v_org record;
begin
  select t.*, pc.*
  into v_row
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
    and pc.status = 'pending';

  if v_row.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  select slug, name, body, version, fields
  into v_template
  from public.consent_templates
  where slug = v_row.template_slug
    and is_active = true
    and (organization_id = v_row.organization_id or organization_id is null)
  order by organization_id nulls last
  limit 1;

  select first_name, last_name, date_of_birth
  into v_patient
  from public.patients
  where id = v_row.patient_id;

  select name into v_org from public.organizations where id = v_row.organization_id;

  return jsonb_build_object(
    'consent_id', v_row.patient_consent_id,
    'template_slug', v_row.template_slug,
    'template_name', coalesce(v_template.name, v_row.template_name),
    'template_body', coalesce(v_template.body, ''),
    'template_version', coalesce(v_template.version, '1.0'),
    'fields', coalesce(v_template.fields, '[]'::jsonb),
    'patient_first_name', v_patient.first_name,
    'patient_last_name', v_patient.last_name,
    'patient_dob', v_patient.date_of_birth,
    'org_name', coalesce(v_org.name, 'Clinic')
  );
end;
$$;

grant execute on function public.get_consent_by_signing_token(text) to anon, authenticated;

-- Public: sign via token
create or replace function public.lock_consent_via_signing_token(
  p_token text,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
  v_consent record;
  v_parsed jsonb;
  v_image text;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
  end if;

  select t.*, pc.id as cid, pc.status as cstatus, pc.organization_id, pc.branch_id, pc.template_slug
  into v_token
  from public.consent_signing_tokens t
  join public.patient_consents pc on pc.id = t.patient_consent_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
  for update of t, pc;

  if v_token.id is null then
    raise exception 'Invalid or expired signing link';
  end if;

  if v_token.cstatus <> 'pending' then
    raise exception 'Consent already signed or voided';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = null,
    signature_data = p_signature_data,
    field_responses = p_field_responses,
    body_snapshot = p_body_snapshot
  where id = v_token.patient_consent_id;

  update public.consent_signing_tokens
  set used_at = now()
  where id = v_token.id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_token.organization_id,
    v_token.branch_id,
    null,
    'consent.signed_via_token',
    'patient_consent',
    v_token.patient_consent_id::text,
    jsonb_build_object(
      'template_slug', v_token.template_slug,
      'channel', v_token.channel,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient')
    )
  );
end;
$$;

grant execute on function public.lock_consent_via_signing_token(text, text, jsonb, text) to anon, authenticated;

-- Extend staff signing with field responses
create or replace function public.lock_signed_consent(
  p_consent_id uuid,
  p_signature_data text,
  p_field_responses jsonb default null,
  p_body_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent record;
  v_parsed jsonb;
  v_image text;
begin
  if p_signature_data is null or length(trim(p_signature_data)) = 0 then
    raise exception 'Signature required';
  end if;

  begin
    v_parsed := p_signature_data::jsonb;
  exception when others then
    raise exception 'Invalid signature payload';
  end;

  v_image := nullif(trim(v_parsed->>'image'), '');
  if v_image is null or length(v_image) < 100 then
    raise exception 'Drawn signature image required';
  end if;

  if nullif(trim(v_parsed->>'name'), '') is null then
    raise exception 'Signer printed name required';
  end if;

  select *
  into v_consent
  from public.patient_consents
  where id = p_consent_id
    and organization_id = public.current_user_org_id()
  for update;

  if v_consent.id is null then
    raise exception 'Consent not found';
  end if;

  if v_consent.status = 'signed' then
    raise exception 'Consent already signed';
  end if;

  if v_consent.status = 'voided' then
    raise exception 'Consent is voided';
  end if;

  if not public.has_permission('consents.manage', coalesce(v_consent.branch_id, (
    select sba.branch_id from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid() limit 1
  ))) then
    raise exception 'Permission denied';
  end if;

  update public.patient_consents
  set
    status = 'signed',
    signed_at = now(),
    signed_by = auth.uid(),
    signature_data = p_signature_data,
    field_responses = coalesce(p_field_responses, field_responses),
    body_snapshot = coalesce(p_body_snapshot, body_snapshot)
  where id = p_consent_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_consent.organization_id,
    v_consent.branch_id,
    auth.uid(),
    'consent.signed',
    'patient_consent',
    p_consent_id::text,
    jsonb_build_object(
      'template_slug', v_consent.template_slug,
      'signer_role', coalesce(v_parsed->>'signerRole', 'patient'),
      'captured_at', coalesce(v_parsed->>'capturedAt', now()::text)
    )
  );
end;
$$;

grant execute on function public.lock_signed_consent(uuid, text, jsonb, text) to authenticated;

-- Org template admin: persist fields
create or replace function public.upsert_org_consent_template(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_slug text := nullif(trim(p_payload->>'slug'), '');
  v_name text := nullif(trim(p_payload->>'name'), '');
  v_body text := nullif(trim(p_payload->>'body'), '');
  v_version text := coalesce(nullif(trim(p_payload->>'version'), ''), '1.0');
  v_is_active boolean := coalesce((p_payload->>'is_active')::boolean, true);
  v_fields jsonb := coalesce(p_payload->'fields', '[]'::jsonb);
  v_id uuid;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if v_slug is null or v_name is null or v_body is null then
    raise exception 'slug, name, and body are required';
  end if;

  if not exists (
    select 1 from public.staff_branch_assignments sba
    where sba.profile_id = auth.uid()
      and public.has_permission('settings.manage', sba.branch_id)
  ) then
    raise exception 'Permission denied';
  end if;

  insert into public.consent_templates (
    organization_id, slug, name, body, version, is_active, fields
  ) values (
    v_org, v_slug, v_name, v_body, v_version, v_is_active, v_fields
  )
  on conflict (organization_id, slug) do update
  set
    name = excluded.name,
    body = excluded.body,
    version = excluded.version,
    is_active = excluded.is_active,
    fields = excluded.fields;

  select id into v_id
  from public.consent_templates
  where organization_id = v_org and slug = v_slug;

  insert into public.organization_audit_logs (
    organization_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org,
    auth.uid(),
    'consent_template.upserted',
    'consent_template',
    v_id::text,
    jsonb_build_object('slug', v_slug, 'version', v_version)
  );

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'version', v_version);
end;
$$;

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
        'fields', coalesce(ct.fields, '[]'::jsonb)
      )
      order by ct.slug, ct.organization_id nulls first
    ),
    '[]'::jsonb
  )
  from public.consent_templates ct
  where ct.organization_id is null
     or ct.organization_id = public.current_user_org_id();
$$;

-- === step: 05_dedupe_consent_templates.sql ===
-- ADIM 5 (opsiyonel): Ayni slug icin cift global sablonlari temizle
-- "multiple rows returned" hatasi aldiysaniz once bunu calistirin

delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

delete from public.consent_templates ct
where ct.id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by organization_id, slug
        order by version desc nulls last, id desc
      ) as rn
    from public.consent_templates
  ) ranked
  where ranked.rn > 1
);

-- dpa-consent govdesi bos kaldiysa doldur
update public.consent_templates
set
  body = 'I consent to the collection, use, and processing of my personal and health information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).',
  name = 'Data Privacy Act (DPA) Consent',
  is_active = true
where organization_id is null
  and slug = 'dpa-consent'
  and coalesce(trim(body), '') = '';


-- === step: 06_full_paper_consent_forms.sql ===
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


-- === diagnose (read-only) - check results ===
-- Hasta modulu diagnose (multi-branch RPC'leri DAHIL DEGIL)
-- Multi-branch sonrasi tam kontrol: 00_diagnose.sql

select 'table:patient_medical_histories' as check_item,
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'patient_medical_histories'
  ) then 'OK' else 'MISSING' end as status
union all
select 'table:consent_templates',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'consent_templates'
  ) then 'OK' else 'MISSING' end
union all
select 'column:consent_templates.fields',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_templates' and column_name = 'fields'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:search_patients(9 params)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_patients'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) like '%p_status%'
  ) then 'OK' else 'MISSING' end
union all
select 'index:consent_templates_global_slug',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_consent_templates_global_slug'
  ) then 'OK' else 'MISSING' end
order by status desc, check_item;



-- ######################################################################
-- BEGIN _APPLY_MULTI_BRANCH.sql
-- ######################################################################

-- MULTI-BRANCH TENANT BUNDLE
-- Generated: 2026-06-11 07:18
-- Each clinic = one organization. Branches = locations under that org.
-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema

-- === migration: 20260610140000_multi_branch_tenant.sql ===
-- Multi-branch tenant model: org isolation + secure branch creation

-- ========== ONKOSUL (tekrar calistirilabilir) ==========
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

create table if not exists public.clinic_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean default false,
  unique(branch_id, day_of_week)
);

create or replace function public.user_is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_branch_assignments sba
    join public.roles r on r.id = sba.role_id
    where sba.profile_id = auth.uid()
      and r.name in ('owner', 'admin')
  );
$$;

create or replace function public.ensure_branch_clinic_hours(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d integer;
begin
  for d in 0..6 loop
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values (
      p_branch_id,
      d,
      case when d in (0, 6) then null else '09:00'::time end,
      case when d in (0, 6) then null else '18:00'::time end,
      d in (0, 6)
    )
    on conflict (branch_id, day_of_week) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenant metadata (each rented clinic = one organization)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists slug text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'trial')),
  add column if not exists plan_tier text not null default 'standard'
    check (plan_tier in ('trial', 'standard', 'enterprise'));

create unique index if not exists idx_organizations_slug
  on public.organizations (lower(slug))
  where slug is not null;

-- ---------------------------------------------------------------------------
-- RLS: use user_is_org_admin() (auth.role() is always 'authenticated' in Supabase)
-- ---------------------------------------------------------------------------
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update using (
    id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (
    id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists branch_insert on public.branches;
create policy branch_insert on public.branches
  for insert with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists branch_update on public.branches;
create policy branch_update on public.branches
  for update using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists branch_select on public.branches;
create policy branch_select on public.branches
  for select using (
    organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or public.user_has_branch_access(id)
    )
  );

-- ---------------------------------------------------------------------------
-- Slug helper
-- ---------------------------------------------------------------------------
create or replace function public.slugify_org_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

-- Backfill slug for existing organizations
update public.organizations o
set slug = coalesce(
  public.slugify_org_name(o.name),
  'clinic'
) || '-' || left(replace(o.id::text, '-', ''), 8)
where o.slug is null;

-- ---------------------------------------------------------------------------
-- Create branch (admin RPC): hours seed + optional staff assignment
-- ---------------------------------------------------------------------------
create or replace function public.create_org_branch(
  p_name text,
  p_address text default null,
  p_contact_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.current_user_org_id();
  v_branch_id uuid;
  v_role_id uuid;
begin
  if v_org_id is null then
    raise exception 'No organization context';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Branch name is required (min 2 characters)';
  end if;

  insert into public.branches (organization_id, name, address, contact_number, is_active)
  values (v_org_id, trim(p_name), nullif(trim(p_address), ''), nullif(trim(p_contact_number), ''), true)
  returning id into v_branch_id;

  perform public.ensure_branch_clinic_hours(v_branch_id);

  -- Assign creator to the new branch (same role they hold on another branch, else admin)
  select sba.role_id into v_role_id
  from public.staff_branch_assignments sba
  join public.roles r on r.id = sba.role_id
  where sba.profile_id = auth.uid()
  order by case r.name when 'owner' then 0 when 'admin' then 1 else 2 end
  limit 1;

  if v_role_id is null then
    select id into v_role_id from public.roles where name = 'admin' limit 1;
  end if;

  if v_role_id is not null then
    insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
    values (auth.uid(), v_branch_id, v_role_id)
    on conflict (profile_id, branch_id) do update set role_id = excluded.role_id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org_id,
    v_branch_id,
    auth.uid(),
    'branch.create',
    'branch',
    v_branch_id::text,
    jsonb_build_object('name', trim(p_name))
  );

  return jsonb_build_object(
    'status', 'created',
    'branch_id', v_branch_id,
    'organization_id', v_org_id
  );
end;
$$;

grant execute on function public.create_org_branch(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap: set org slug on first signup
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_clinic(
  p_org_name text,
  p_branch_name text default 'Main Clinic'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_owner_role_id uuid;
  v_user_id uuid := auth.uid();
  v_email text;
  v_slug text;
  v_slug_base text;
  v_suffix int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    return jsonb_build_object('status', 'already_bootstrapped');
  end if;

  select email into v_email from auth.users where id = v_user_id;

  v_slug_base := public.slugify_org_name(p_org_name);
  if v_slug_base is null then
    v_slug_base := 'clinic';
  end if;
  v_slug := v_slug_base;
  while exists (select 1 from public.organizations where lower(slug) = lower(v_slug)) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (name, slug, status, plan_tier)
  values (p_org_name, v_slug, 'trial', 'trial')
  returning id into v_org_id;

  insert into public.branches (organization_id, name) values (v_org_id, p_branch_name) returning id into v_branch_id;
  insert into public.organization_settings (organization_id) values (v_org_id);
  insert into public.profiles (id, organization_id, email, full_name)
    values (v_user_id, v_org_id, coalesce(v_email, ''), split_part(coalesce(v_email, 'Owner'), '@', 1));
  insert into public.staff_profiles (profile_id) values (v_user_id);

  select id into v_owner_role_id from public.roles where name = 'owner' limit 1;
  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
    values (v_user_id, v_branch_id, v_owner_role_id);

  perform public.ensure_branch_clinic_hours(v_branch_id);

  return jsonb_build_object(
    'status', 'created',
    'organization_id', v_org_id,
    'branch_id', v_branch_id,
    'slug', v_slug
  );
end;
$$;



-- ######################################################################
-- END: full diagnose (all modules)
-- ######################################################################

-- ADIM 0: SQL Editor'da calistir — eksikleri gor
-- Her satirin status'u OK olmali (MISSING = once alttaki adimlari uygula)

select 'table:patient_medical_histories' as check_item,
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'patient_medical_histories'
  ) then 'OK' else 'MISSING' end as status
union all
select 'table:consent_templates',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'consent_templates'
  ) then 'OK' else 'MISSING' end
union all
select 'column:consent_templates.fields',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'consent_templates' and column_name = 'fields'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:search_patients(9 params)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_patients'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) like '%p_status%'
  ) then 'OK' else 'MISSING' end
union all
select 'table:organization_audit_logs',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_audit_logs'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:user_is_org_admin()',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_is_org_admin'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:ensure_branch_clinic_hours(uuid)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ensure_branch_clinic_hours'
  ) then 'OK' else 'MISSING' end
union all
select 'rpc:create_org_branch(text,text,text)',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_org_branch'
  ) then 'OK' else 'MISSING' end
union all
select 'index:consent_templates_global_slug',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_consent_templates_global_slug'
  ) then 'OK' else 'MISSING' end
order by status desc, check_item;


