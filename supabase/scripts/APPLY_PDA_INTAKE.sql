-- PDA Dental Chart digital intake records + patient signing tokens

create table if not exists public.patient_pda_intake_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'patient_pending', 'completed')),
  responses jsonb not null default '{}'::jsonb,
  version int not null default 1,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  patient_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, branch_id)
);

create index if not exists idx_patient_pda_intake_org
  on public.patient_pda_intake_records (organization_id, updated_at desc);

create index if not exists idx_patient_pda_intake_patient
  on public.patient_pda_intake_records (patient_id);

alter table public.patient_pda_intake_records enable row level security;

drop policy if exists patient_pda_intake_org on public.patient_pda_intake_records;
create policy patient_pda_intake_org on public.patient_pda_intake_records
  for all using (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.read', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('dental_chart.write', branch_id)
  );

create table if not exists public.pda_intake_signing_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_pda_intake_id uuid not null references public.patient_pda_intake_records(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  channel text not null default 'link',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists pda_intake_signing_tokens_record_idx
  on public.pda_intake_signing_tokens (patient_pda_intake_id);

alter table public.pda_intake_signing_tokens enable row level security;

drop policy if exists pda_intake_signing_tokens_staff on public.pda_intake_signing_tokens;
create policy pda_intake_signing_tokens_staff on public.pda_intake_signing_tokens
  for all using (
    exists (
      select 1 from public.patient_pda_intake_records r
      where r.id = patient_pda_intake_id
        and r.organization_id = public.current_user_org_id()
        and public.has_permission('dental_chart.write', r.branch_id)
    )
  );

create or replace function public.get_patient_pda_intake(
  p_patient_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_row public.patient_pda_intake_records%rowtype;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_permission('dental_chart.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select * into v_row
  from public.patient_pda_intake_records
  where patient_id = p_patient_id
    and branch_id = p_branch_id
    and organization_id = v_org;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'responses', v_row.responses,
    'version', v_row.version,
    'completed_at', v_row.completed_at,
    'patient_submitted_at', v_row.patient_submitted_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.get_patient_pda_intake(uuid, uuid) to authenticated;

create or replace function public._sync_pda_intake_to_patient(p_record_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.patient_pda_intake_records%rowtype;
  v_p jsonb;
  v_m jsonb;
  v_allergies jsonb := '[]'::jsonb;
  v_conditions jsonb := '[]'::jsonb;
  v_medications jsonb := '[]'::jsonb;
  v_notes text;
begin
  select * into v_row from public.patient_pda_intake_records where id = p_record_id;
  if not found then return; end if;

  v_p := coalesce(v_row.responses->'patient', '{}'::jsonb);
  v_m := coalesce(v_row.responses->'medical', '{}'::jsonb);

  update public.patients set
    phone = coalesce(nullif(trim(phone), ''), nullif(trim(v_p->>'mobile'), '')),
    email = coalesce(nullif(trim(email), ''), nullif(trim(v_p->>'email'), '')),
    address = coalesce(nullif(trim(address), ''), nullif(trim(v_p->>'address'), '')),
    date_of_birth = coalesce(date_of_birth, nullif(v_p->>'dateOfBirth', '')::date),
    gender = coalesce(nullif(trim(gender), ''), nullif(trim(v_p->>'sex'), '')),
    updated_by = auth.uid(),
    updated_at = now()
  where id = v_row.patient_id;

  if coalesce(v_m->'allergies'->>'lidocaine', '') = 'yes' then
    v_allergies := v_allergies || '"local anesthetic"'::jsonb;
  end if;
  if coalesce(v_m->'allergies'->>'penicillin', '') = 'yes' then
    v_allergies := v_allergies || '"penicillin"'::jsonb;
  end if;
  if coalesce(v_m->'allergies'->>'sulfa', '') = 'yes' then
    v_allergies := v_allergies || '"sulfa"'::jsonb;
  end if;
  if coalesce(v_m->'allergies'->>'aspirin', '') = 'yes' then
    v_allergies := v_allergies || '"aspirin"'::jsonb;
  end if;
  if coalesce(v_m->'allergies'->>'latex', '') = 'yes' then
    v_allergies := v_allergies || '"latex"'::jsonb;
  end if;
  if nullif(trim(v_m->>'allergyOther'), '') is not null then
    v_allergies := v_allergies || to_jsonb(trim(v_m->>'allergyOther'));
  end if;

  if coalesce(v_m->'questions'->>'hypertension', '') = 'yes' then
    v_conditions := v_conditions || '"hypertension"'::jsonb;
  end if;
  if coalesce(v_m->'questions'->>'heart_disease', '') = 'yes' then
    v_conditions := v_conditions || '"heart disease"'::jsonb;
  end if;
  if coalesce(v_m->'questions'->>'diabetes', '') = 'yes' then
    v_conditions := v_conditions || '"diabetes"'::jsonb;
  end if;
  if coalesce(v_m->'questions'->>'asthma', '') = 'yes' then
    v_conditions := v_conditions || '"asthma"'::jsonb;
  end if;
  if coalesce(v_m->'questions'->>'epilepsy', '') = 'yes' then
    v_conditions := v_conditions || '"epilepsy"'::jsonb;
  end if;
  if coalesce(v_m->'questions'->>'hepatitis', '') = 'yes' then
    v_conditions := v_conditions || '"hepatitis"'::jsonb;
  end if;
  if coalesce(v_m->'questions'->>'cancer', '') = 'yes' then
    v_conditions := v_conditions || '"cancer"'::jsonb;
  end if;

  if nullif(trim(v_m->>'medications'), '') is not null then
    v_medications := to_jsonb(string_to_array(trim(v_m->>'medications'), ','));
  end if;

  v_notes := nullif(trim(v_m->>'notes'), '');

  if jsonb_array_length(v_allergies) > 0
    or jsonb_array_length(v_conditions) > 0
    or jsonb_array_length(v_medications) > 0
    or v_notes is not null then
    insert into public.patient_medical_histories (
      patient_id, organization_id, version,
      allergies, medications, conditions, notes, created_by
    )
    select
      v_row.patient_id,
      v_row.organization_id,
      coalesce((select max(version) from public.patient_medical_histories where patient_id = v_row.patient_id), 0) + 1,
      coalesce((
        select jsonb_agg(distinct elem)
        from jsonb_array_elements_text(v_allergies) elem
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(distinct trim(elem))
        from jsonb_array_elements_text(v_medications) elem
        where trim(elem) <> ''
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(distinct elem)
        from jsonb_array_elements_text(v_conditions) elem
      ), '[]'::jsonb),
      v_notes,
      auth.uid();
  end if;
end;
$$;

create or replace function public.upsert_patient_pda_intake(
  p_patient_id uuid,
  p_branch_id uuid,
  p_responses jsonb,
  p_status text default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_id uuid;
  v_version int;
  v_status text := coalesce(nullif(trim(p_status), ''), 'draft');
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  if v_status not in ('draft', 'patient_pending', 'completed') then
    raise exception 'Invalid status';
  end if;

  if not public.has_permission('dental_chart.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.organization_id = v_org
  ) then
    raise exception 'Patient not found';
  end if;

  insert into public.patient_pda_intake_records (
    organization_id, branch_id, patient_id, status, responses, version,
    completed_at, completed_by, updated_at
  ) values (
    v_org, p_branch_id, p_patient_id, v_status, coalesce(p_responses, '{}'::jsonb), 1,
    case when v_status = 'completed' then now() else null end,
    case when v_status = 'completed' then auth.uid() else null end,
    now()
  )
  on conflict (patient_id, branch_id) do update set
    status = excluded.status,
    responses = excluded.responses,
    version = public.patient_pda_intake_records.version + 1,
    completed_at = case
      when excluded.status = 'completed' then now()
      else public.patient_pda_intake_records.completed_at
    end,
    completed_by = case
      when excluded.status = 'completed' then auth.uid()
      else public.patient_pda_intake_records.completed_by
    end,
    updated_at = now()
  returning id, version into v_id, v_version;

  if v_status = 'completed' then
    perform public._sync_pda_intake_to_patient(v_id);
  end if;

  return jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status);
end;
$$;

grant execute on function public.upsert_patient_pda_intake(uuid, uuid, jsonb, text) to authenticated;

create or replace function public.create_pda_intake_signing_token(
  p_record_id uuid,
  p_channel text default 'link',
  p_ttl_hours int default 72
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.patient_pda_intake_records%rowtype;
  v_token text;
begin
  select * into v_row
  from public.patient_pda_intake_records
  where id = p_record_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'PDA intake record not found';
  end if;

  if not public.has_permission('dental_chart.write', v_row.branch_id) then
    raise exception 'Permission denied';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.pda_intake_signing_tokens (
    patient_pda_intake_id, token, channel, expires_at, created_by
  ) values (
    p_record_id,
    v_token,
    coalesce(nullif(trim(p_channel), ''), 'link'),
    now() + make_interval(hours => greatest(p_ttl_hours, 1)),
    auth.uid()
  );

  update public.patient_pda_intake_records
  set status = 'patient_pending', updated_at = now()
  where id = p_record_id and status = 'draft';

  return jsonb_build_object(
    'token', v_token,
    'expires_at', (now() + make_interval(hours => greatest(p_ttl_hours, 1)))::text
  );
end;
$$;

grant execute on function public.create_pda_intake_signing_token(uuid, text, int) to authenticated;

create or replace function public.get_pda_intake_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tok record;
  v_patient record;
  v_org record;
begin
  select t.*, r.responses, r.status as record_status, r.patient_id, r.branch_id, r.organization_id
  into v_tok
  from public.pda_intake_signing_tokens t
  join public.patient_pda_intake_records r on r.id = t.patient_pda_intake_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
    and r.status in ('draft', 'patient_pending');

  if v_tok.id is null then
    raise exception 'Invalid or expired link';
  end if;

  select first_name, last_name into v_patient
  from public.patients where id = v_tok.patient_id;

  select name into v_org from public.organizations where id = v_tok.organization_id;

  return jsonb_build_object(
    'record_id', v_tok.patient_pda_intake_id,
    'status', v_tok.record_status,
    'responses', coalesce(v_tok.responses, '{}'::jsonb),
    'patient_first_name', v_patient.first_name,
    'patient_last_name', v_patient.last_name,
    'org_name', coalesce(v_org.name, 'Clinic')
  );
end;
$$;

grant execute on function public.get_pda_intake_by_token(text) to anon, authenticated;

create or replace function public.submit_pda_intake_via_token(
  p_token text,
  p_responses jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tok record;
begin
  select t.*, r.id as rid
  into v_tok
  from public.pda_intake_signing_tokens t
  join public.patient_pda_intake_records r on r.id = t.patient_pda_intake_id
  where t.token = nullif(trim(p_token), '')
    and t.used_at is null
    and t.expires_at > now()
  for update of t, r;

  if v_tok.id is null then
    raise exception 'Invalid or expired link';
  end if;

  update public.patient_pda_intake_records
  set
    responses = coalesce(p_responses, '{}'::jsonb),
    status = 'patient_pending',
    patient_submitted_at = now(),
    version = version + 1,
    updated_at = now()
  where id = v_tok.rid;

  update public.pda_intake_signing_tokens
  set used_at = now()
  where id = v_tok.id;
end;
$$;

grant execute on function public.submit_pda_intake_via_token(text, jsonb) to anon, authenticated;

-- Reload PostgREST schema cache so RPCs are available immediately
notify pgrst, 'reload schema';
