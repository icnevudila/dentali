-- Patient chart: treatment plan timeline for odontogram context

create or replace function public.get_patient_treatment_timeline(
  p_patient_id uuid,
  p_branch_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'plan_id', tp.id,
        'plan_title', tp.title,
        'plan_status', tp.status,
        'plan_created_at', tp.created_at,
        'plan_approved_at', tp.approved_at,
        'item_id', i.id,
        'description', i.description,
        'tooth_number', i.tooth_number,
        'priority', i.priority,
        'item_status', i.status,
        'estimated_price', i.estimated_price,
        'item_created_at', i.created_at
      )
      order by
        case tp.status
          when 'in_progress' then 0
          when 'approved' then 1
          when 'proposed' then 2
          when 'draft' then 3
          else 4
        end,
        case i.priority
          when 'urgent' then 0
          when 'restorative' then 1
          when 'cosmetic' then 2
          when 'ortho' then 3
          else 4
        end,
        i.created_at
    ),
    '[]'::jsonb
  )
  from public.treatment_plans tp
  join public.treatment_plan_items i on i.plan_id = tp.id
  join public.patients p on p.id = tp.patient_id
  where tp.patient_id = p_patient_id
    and p.organization_id = public.current_user_org_id()
    and tp.status not in ('cancelled', 'completed')
    and i.status not in ('cancelled', 'completed')
    and (p_branch_id is null or tp.branch_id = p_branch_id);
$$;

grant execute on function public.get_patient_treatment_timeline(uuid, uuid) to authenticated;
