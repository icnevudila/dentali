-- Wave 5: Clinical notes & patient timeline (MVP)

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null default 'Clinical Note',
  subjective text,
  objective text,
  assessment text,
  plan text,
  body text,
  status text not null default 'draft' check (status in ('draft', 'signed')),
  version integer not null default 1,
  signed_at timestamptz,
  signed_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clinical_notes_patient on public.clinical_notes(patient_id, created_at desc);

create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.clinical_notes(id) on delete cascade,
  version integer not null,
  content jsonb not null default '{}'::jsonb,
  signed_by uuid references public.profiles(id),
  signed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.clinical_notes enable row level security;
alter table public.note_versions enable row level security;

create policy clinical_notes_select on public.clinical_notes for select using (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.read', branch_id)
);

create policy clinical_notes_insert on public.clinical_notes for insert with check (
  organization_id = public.current_user_org_id()
  and public.has_permission('dental_chart.write', branch_id)
);

create policy clinical_notes_update on public.clinical_notes for update using (
  organization_id = public.current_user_org_id()
  and status = 'draft'
  and public.has_permission('dental_chart.write', branch_id)
);

create policy note_versions_select on public.note_versions for select using (
  exists (
    select 1 from public.clinical_notes cn
    where cn.id = note_id
      and cn.organization_id = public.current_user_org_id()
      and public.has_permission('dental_chart.read', cn.branch_id)
  )
);

create policy note_versions_insert on public.note_versions for insert with check (
  exists (
    select 1 from public.clinical_notes cn
    where cn.id = note_id
      and cn.organization_id = public.current_user_org_id()
      and public.has_permission('dental_chart.write', cn.branch_id)
  )
);

-- Sign note: snapshot version + lock
create or replace function public.sign_clinical_note(p_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.clinical_notes%rowtype;
begin
  select * into v_note
  from public.clinical_notes
  where id = p_note_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Note not found';
  end if;

  if v_note.status = 'signed' then
    return jsonb_build_object('status', 'already_signed');
  end if;

  if not public.has_permission('dental_chart.write', v_note.branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.note_versions (note_id, version, content, signed_by, signed_at)
  values (
    v_note.id,
    v_note.version,
    jsonb_build_object(
      'title', v_note.title,
      'subjective', v_note.subjective,
      'objective', v_note.objective,
      'assessment', v_note.assessment,
      'plan', v_note.plan,
      'body', v_note.body
    ),
    auth.uid(),
    now()
  );

  update public.clinical_notes
  set status = 'signed',
      signed_at = now(),
      signed_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_note_id;

  return jsonb_build_object('status', 'signed', 'note_id', p_note_id);
end;
$$;

-- Patient timeline: notes + appointments
create or replace function public.get_patient_timeline(p_patient_id uuid)
returns table (
  event_type text,
  event_id uuid,
  occurred_at timestamptz,
  title text,
  subtitle text,
  status text,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select
      'clinical_note'::text as event_type,
      cn.id as event_id,
      coalesce(cn.signed_at, cn.created_at) as occurred_at,
      cn.title,
      coalesce(
        nullif(trim(concat_ws(' — ', cn.assessment, cn.plan)), ''),
        left(coalesce(cn.body, cn.subjective, ''), 120)
      ) as subtitle,
      cn.status,
      jsonb_build_object(
        'branch_id', cn.branch_id,
        'version', cn.version,
        'signed', cn.status = 'signed'
      ) as metadata
    from public.clinical_notes cn
    where cn.patient_id = p_patient_id
      and cn.organization_id = public.current_user_org_id()

    union all

    select
      'appointment'::text,
      a.id,
      a.scheduled_at,
      coalesce(a.purpose, 'Appointment'),
      a.notes,
      a.status,
      jsonb_build_object('branch_id', a.branch_id, 'duration_minutes', a.duration_minutes)
    from public.appointments a
    where a.patient_id = p_patient_id
      and a.organization_id = public.current_user_org_id()
  ) timeline
  order by timeline.occurred_at desc nulls last;
$$;
