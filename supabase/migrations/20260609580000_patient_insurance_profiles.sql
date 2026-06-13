-- Module 06: Patient insurance profiles (Phase 2 stub)

create table if not exists public.patient_insurance_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  payer_type text not null default 'none'
    check (payer_type in ('none', 'hmo', 'philhealth', 'private')),
  payer_name text,
  member_id text,
  plan_name text,
  is_primary boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (patient_id, payer_type)
);

create index if not exists idx_patient_insurance_patient on public.patient_insurance_profiles(patient_id);

alter table public.patient_insurance_profiles enable row level security;

create policy patient_insurance_org on public.patient_insurance_profiles for all using (
  organization_id = public.current_user_org_id()
);

create or replace function public.get_patient_insurance_profiles(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not exists (
    select 1 from public.patients p
    where p.id = p_patient_id and p.organization_id = public.current_user_org_id()
  ) then
    raise exception 'Patient not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pip.id,
      'payer_type', pip.payer_type,
      'payer_name', pip.payer_name,
      'member_id', pip.member_id,
      'plan_name', pip.plan_name,
      'is_primary', pip.is_primary,
      'notes', pip.notes
    ) order by pip.is_primary desc, pip.payer_type
  ), '[]'::jsonb)
  into v_rows
  from public.patient_insurance_profiles pip
  where pip.patient_id = p_patient_id;

  return jsonb_build_object('patient_id', p_patient_id, 'profiles', v_rows);
end;
$$;

create or replace function public.upsert_patient_insurance_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_payer_type text := coalesce(nullif(p_payload->>'payer_type', ''), 'none');
  v_id uuid;
begin
  if v_patient_id is null or v_org_id is null then
    raise exception 'patient_id and organization_id are required';
  end if;

  if v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_is_org_admin()
    and not exists (
      select 1 from public.patient_branch_links pbl
      where pbl.patient_id = v_patient_id
        and public.has_permission('patients.write', pbl.branch_id)
    ) then
    raise exception 'Permission denied';
  end if;

  insert into public.patient_insurance_profiles (
    organization_id, patient_id, payer_type, payer_name, member_id, plan_name, notes,
    is_primary, created_by, updated_by
  ) values (
    v_org_id, v_patient_id, v_payer_type,
    nullif(trim(p_payload->>'payer_name'), ''),
    nullif(trim(p_payload->>'member_id'), ''),
    nullif(trim(p_payload->>'plan_name'), ''),
    nullif(trim(p_payload->>'notes'), ''),
    coalesce((p_payload->>'is_primary')::boolean, true),
    auth.uid(), auth.uid()
  )
  on conflict (patient_id, payer_type) do update set
    payer_name = excluded.payer_name,
    member_id = excluded.member_id,
    plan_name = excluded.plan_name,
    notes = excluded.notes,
    is_primary = excluded.is_primary,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'payer_type', v_payer_type, 'status', 'saved');
end;
$$;

grant execute on function public.get_patient_insurance_profiles(uuid) to authenticated;
grant execute on function public.upsert_patient_insurance_profile(jsonb) to authenticated;
