-- Kiosk satisfaction feedback + public medical history preview for update flow.

create table if not exists public.patient_satisfaction_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  queue_entry_id uuid references public.queue_entries(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  feedback_text text,
  source text not null default 'kiosk' check (source in ('kiosk', 'portal')),
  created_at timestamptz not null default now()
);

create index if not exists patient_satisfaction_feedback_branch_created_idx
  on public.patient_satisfaction_feedback (branch_id, created_at desc);

alter table public.patient_satisfaction_feedback enable row level security;

drop policy if exists patient_satisfaction_feedback_select on public.patient_satisfaction_feedback;
create policy patient_satisfaction_feedback_select on public.patient_satisfaction_feedback
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.has_permission('reports.read', branch_id)
  );

grant select on public.patient_satisfaction_feedback to authenticated;

-- Inserts only via security definer RPC (no direct insert policy).

create or replace function public.submit_kiosk_satisfaction(
  p_session_id uuid,
  p_entry_id uuid,
  p_rating integer,
  p_feedback_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_entry public.queue_entries%rowtype;
  v_id uuid;
  v_feedback text;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Please choose a rating from 1 to 5.';
  end if;

  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_feedback := nullif(trim(coalesce(p_feedback_text, '')), '');
  if v_feedback is not null and char_length(v_feedback) > 500 then
    raise exception 'Feedback must be 500 characters or fewer.';
  end if;

  if p_entry_id is not null then
    select * into v_entry from public.queue_entries where id = p_entry_id;
    if not found or v_entry.branch_id <> v_session.branch_id then
      raise exception 'Queue entry not found for this kiosk.';
    end if;
  end if;

  insert into public.patient_satisfaction_feedback (
    organization_id,
    branch_id,
    patient_id,
    queue_entry_id,
    rating,
    feedback_text,
    source
  ) values (
    v_session.organization_id,
    v_session.branch_id,
    v_entry.patient_id,
    v_entry.id,
    p_rating,
    v_feedback,
    'kiosk'
  )
  returning id into v_id;

  return jsonb_build_object('feedback_id', v_id, 'rating', p_rating);
end;
$$;

grant execute on function public.submit_kiosk_satisfaction(uuid, uuid, integer, text) to anon, authenticated;

-- Identity-verified medical history snapshot for kiosk update flow (no direct table reads).
create or replace function public.get_kiosk_medical_history_preview(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient public.patients%rowtype;
  v_phone_norm text;
  v_history record;
  v_allergies text;
  v_meds text;
  v_conds text;
  v_alerts text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_phone_norm := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.* into v_patient
  from public.patients p
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone_norm
  limit 1;

  if not found then
    raise exception 'We could not find your record. Please check your details or see the front desk.';
  end if;

  insert into public.patient_branch_links (patient_id, branch_id)
  values (v_patient.id, v_session.branch_id)
  on conflict (patient_id, branch_id) do nothing;

  select
    pmh.allergies,
    pmh.medications,
    pmh.conditions,
    pmh.notes
  into v_history
  from public.patient_medical_histories pmh
  where pmh.patient_id = v_patient.id
  order by pmh.version desc nulls last, pmh.created_at desc nulls last
  limit 1;

  if found then
    select string_agg(x, ', ' order by x)
    into v_allergies
    from jsonb_array_elements_text(coalesce(v_history.allergies, '[]'::jsonb)) as t(x)
    where trim(x) <> '';

    select string_agg(x, ', ' order by x)
    into v_meds
    from jsonb_array_elements_text(coalesce(v_history.medications, '[]'::jsonb)) as t(x)
    where trim(x) <> '';

    select string_agg(x, ', ' order by x)
    into v_conds
    from jsonb_array_elements_text(coalesce(v_history.conditions, '[]'::jsonb)) as t(x)
    where trim(x) <> '';

    v_alerts := nullif(trim(concat_ws(
      E'\n',
      case when coalesce(v_allergies, '') <> '' then 'Allergies: ' || v_allergies end,
      case when coalesce(v_meds, '') <> '' then 'Medications: ' || v_meds end,
      case when coalesce(v_conds, '') <> '' then 'Conditions: ' || v_conds end,
      case when coalesce(trim(v_history.notes), '') <> '' then 'Notes: ' || trim(v_history.notes) end
    )), '');
  end if;

  return jsonb_build_object(
    'patient_id', v_patient.id,
    'first_name', v_patient.first_name,
    'last_name', v_patient.last_name,
    'phone', v_patient.phone,
    'medical_alerts', coalesce(v_alerts, '')
  );
end;
$$;

grant execute on function public.get_kiosk_medical_history_preview(uuid, text, text) to anon, authenticated;
