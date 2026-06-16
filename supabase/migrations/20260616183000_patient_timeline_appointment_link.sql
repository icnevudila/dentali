-- Link clinical notes to appointment-based visit sessions in timeline metadata

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
        'signed', cn.status = 'signed',
        'appointment_id', cn.appointment_id
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
      jsonb_build_object(
        'branch_id', a.branch_id,
        'duration_minutes', a.duration_minutes
      )
    from public.appointments a
    where a.patient_id = p_patient_id
      and a.organization_id = public.current_user_org_id()
  ) timeline
  order by timeline.occurred_at desc nulls last;
$$;
