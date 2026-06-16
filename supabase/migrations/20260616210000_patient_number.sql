-- Permanent patient file number (org-scoped, e.g. P-00001)

alter table public.patients
  add column if not exists patient_number text;

create unique index if not exists idx_patients_org_number
  on public.patients (organization_id, patient_number)
  where patient_number is not null;

create or replace function public._next_patient_number(p_org_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  select count(*) + 1 into v_num
  from public.patients
  where organization_id = p_org_id
    and patient_number is not null;

  return 'P-' || lpad(v_num::text, 5, '0');
end;
$$;

-- Backfill existing patients per org (creation order)
with numbered as (
  select
    id,
    'P-' || lpad(
      row_number() over (partition by organization_id order by created_at, id)::text,
      5,
      '0'
    ) as num
  from public.patients
  where patient_number is null
)
update public.patients p
set patient_number = numbered.num
from numbered
where p.id = numbered.id;

create or replace function public.finalize_patient_intake(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid;
  v_intake_id uuid;
  v_address text;
  v_patient_number text;
  v_medical_alerts text := nullif(trim(p_payload->>'medical_alerts'), '');
begin
  if v_org_id is null or v_branch_id is null then
    raise exception 'organization_id and branch_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('patients.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if nullif(trim(p_payload->>'first_name'), '') is null
    or nullif(trim(p_payload->>'last_name'), '') is null then
    raise exception 'first_name and last_name are required';
  end if;

  v_address := nullif(trim(concat_ws(', ',
    nullif(trim(p_payload->>'address_line1'), ''),
    nullif(trim(p_payload->>'city'), '')
  )), '');

  v_patient_number := public._next_patient_number(v_org_id);

  insert into public.patients (
    organization_id, first_name, last_name, date_of_birth, gender,
    phone, email, address, patient_number, created_by, updated_by
  ) values (
    v_org_id,
    trim(p_payload->>'first_name'),
    trim(p_payload->>'last_name'),
    nullif(p_payload->>'date_of_birth', '')::date,
    coalesce(nullif(p_payload->>'gender', ''), 'prefer_not_to_say'),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'email'), ''),
    v_address,
    v_patient_number,
    auth.uid(),
    auth.uid()
  )
  returning id into v_patient_id;

  insert into public.patient_branch_links (
    patient_id, branch_id, first_visit_at, last_visit_at
  ) values (
    v_patient_id, v_branch_id, now(), now()
  );

  if nullif(trim(p_payload->>'emergency_contact_name'), '') is not null then
    insert into public.patient_contacts (
      patient_id, contact_type, name, phone
    ) values (
      v_patient_id,
      'emergency',
      trim(p_payload->>'emergency_contact_name'),
      nullif(trim(p_payload->>'emergency_contact_phone'), '')
    );
  end if;

  if v_medical_alerts is not null then
    insert into public.patient_medical_histories (
      patient_id, organization_id, version,
      allergies, medications, conditions, notes, created_by
    ) values (
      v_patient_id, v_org_id, 1,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, v_medical_alerts, auth.uid()
    );
  end if;

  insert into public.patient_intakes (
    organization_id, branch_id, patient_id, status, payload, finalized_at, finalized_by
  ) values (
    v_org_id, v_branch_id, v_patient_id, 'finalized', p_payload, now(), auth.uid()
  )
  returning id into v_intake_id;

  return jsonb_build_object(
    'patient_id', v_patient_id,
    'intake_id', v_intake_id,
    'patient_number', v_patient_number,
    'status', 'finalized'
  );
end;
$$;

grant execute on function public.finalize_patient_intake(jsonb) to authenticated;

-- Return type adds patient_number — must drop before recreate
drop function if exists public.search_patients(text, uuid);
drop function if exists public.search_patients(
  text,
  uuid,
  integer,
  integer,
  text,
  timestamptz,
  timestamptz,
  boolean,
  text
);

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
  patient_number text,
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
      p.patient_number,
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
        or p.patient_number ilike '%' || p_query || '%'
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
    b.patient_number,
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

grant execute on function public.search_patients(
  text,
  uuid,
  integer,
  integer,
  text,
  timestamptz,
  timestamptz,
  boolean,
  text
) to authenticated;
