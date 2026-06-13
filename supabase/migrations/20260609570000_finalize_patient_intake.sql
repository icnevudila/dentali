-- Module 06: Patient intake finalize RPC

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

create policy patient_intakes_org on public.patient_intakes for all using (
  organization_id = public.current_user_org_id()
);

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

  insert into public.patients (
    organization_id, first_name, last_name, date_of_birth, gender,
    phone, email, address, created_by, updated_by
  ) values (
    v_org_id,
    trim(p_payload->>'first_name'),
    trim(p_payload->>'last_name'),
    nullif(p_payload->>'date_of_birth', '')::date,
    coalesce(nullif(p_payload->>'gender', ''), 'prefer_not_to_say'),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'email'), ''),
    v_address,
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
    'status', 'finalized'
  );
end;
$$;

grant execute on function public.finalize_patient_intake(jsonb) to authenticated;
