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