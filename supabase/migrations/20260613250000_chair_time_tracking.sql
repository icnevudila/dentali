-- Add in_chair_at to queue_entries
alter table public.queue_entries add column if not exists in_chair_at timestamptz;

-- Update the update_queue_status function to set in_chair_at
create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_app_id uuid;
  v_branch_id uuid;
  v_patient_id uuid;
  v_old_status text;
  v_in_chair_at timestamptz;
  v_completed_at timestamptz;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    return jsonb_build_object('error', 'Entry not found');
  end if;

  v_app_id := v_entry.appointment_id;
  v_branch_id := v_entry.branch_id;
  v_patient_id := v_entry.patient_id;
  v_old_status := v_entry.status;
  
  -- Keep existing timestamps unless we are transitioning into the state
  v_in_chair_at := v_entry.in_chair_at;
  v_completed_at := v_entry.completed_at;

  if p_status = 'in_chair' and v_old_status != 'in_chair' then
    v_in_chair_at := now();
  end if;

  if p_status = 'served' and v_old_status != 'served' then
    v_completed_at := now();
  end if;

  update public.queue_entries
  set 
    status = p_status,
    chair_label = coalesce(p_chair_label, chair_label),
    called_at = case when p_status = 'now_serving' then now() else called_at end,
    in_chair_at = v_in_chair_at,
    completed_at = v_completed_at,
    updated_at = now()
  where id = p_entry_id;

  -- 1) Auto-Complete Appointment
  if p_status = 'served' and v_app_id is not null then
    -- Check workflow settings
    declare
      v_auto_served boolean;
    begin
      select (settings->>'auto_served_completes_appointment')::boolean into v_auto_served
      from public.workflow_settings
      where branch_id = v_branch_id;

      if coalesce(v_auto_served, true) then
        update public.appointments
        set status = 'completed', updated_at = now()
        where id = v_app_id;
      end if;
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('success', true);
end;
$$;
