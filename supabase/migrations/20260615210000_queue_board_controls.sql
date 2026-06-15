-- Queue board: backward transitions, audit, reorder within waiting column

create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_in_chair_at timestamptz;
  v_completed_at timestamptz;
  v_called_at timestamptz;
  v_chair_label text;
  v_backward boolean := false;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    raise exception 'Queue entry not found';
  end if;

  if not public.has_permission('queue.manage', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status not in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  if p_status = v_entry.status and p_chair_label is null then
    return jsonb_build_object('id', p_entry_id, 'status', p_status);
  end if;

  v_in_chair_at := v_entry.in_chair_at;
  v_completed_at := v_entry.completed_at;
  v_called_at := v_entry.called_at;
  v_chair_label := coalesce(p_chair_label, v_entry.chair_label);

  v_backward := (
    (v_entry.status = 'in_chair' and p_status in ('now_serving', 'ready', 'waiting'))
    or (v_entry.status = 'now_serving' and p_status in ('ready', 'waiting'))
    or (v_entry.status = 'ready' and p_status = 'waiting')
    or (v_entry.status = 'served' and p_status in ('in_chair', 'now_serving', 'ready', 'waiting'))
  );

  if p_status = 'in_chair' and v_entry.status is distinct from 'in_chair' then
    v_in_chair_at := now();
  elsif p_status in ('waiting', 'ready', 'now_serving') and v_entry.status = 'in_chair' then
    v_in_chair_at := null;
    if p_status in ('waiting', 'ready') then
      v_chair_label := null;
    end if;
  end if;

  if p_status = 'now_serving' then
    v_called_at := now();
  elsif p_status in ('waiting', 'ready') and v_entry.status in ('now_serving', 'in_chair') then
    v_called_at := null;
  end if;

  if p_status = 'served' and v_entry.status is distinct from 'served' then
    v_completed_at := now();
  elsif p_status in ('waiting', 'ready', 'now_serving', 'in_chair') and v_entry.status = 'served' then
    v_completed_at := null;
  end if;

  update public.queue_entries
  set status = p_status,
      chair_label = v_chair_label,
      called_at = v_called_at,
      in_chair_at = v_in_chair_at,
      completed_at = v_completed_at,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  if p_status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'completed', updated_at = now()
    where id = v_entry.appointment_id
      and status in ('checked_in', 'scheduled', 'confirmed');
  end if;

  if v_backward
    and v_entry.status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'checked_in', updated_at = now()
    where id = v_entry.appointment_id
      and status = 'completed';
  end if;

  perform public.emit_workflow_event(
    v_entry.branch_id, 'queue.status_changed', 'queue_entry', p_entry_id::text,
    jsonb_build_object(
      'status', p_status,
      'previous_status', v_entry.status,
      'backward', v_backward,
      'appointment_id', v_entry.appointment_id
    )
  );

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_entry.organization_id, v_entry.branch_id, auth.uid(),
    case when v_backward then 'queue.status_revert' else 'queue.status_change' end,
    'queue_entry', p_entry_id::text,
    jsonb_build_object(
      'previous_status', v_entry.status,
      'new_status', p_status,
      'patient_id', v_entry.patient_id,
      'display_code', v_entry.display_code,
      'backward', v_backward
    )
  );

  return jsonb_build_object('id', p_entry_id, 'status', p_status, 'backward', v_backward);
end;
$$;

-- Reorder patients within the waiting column (waiting + ready)
create or replace function public.reorder_queue_board(
  p_branch_id uuid,
  p_ordered_entry_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_base timestamptz;
  v_i int;
  v_id uuid;
  v_count int;
begin
  if p_branch_id is null or p_ordered_entry_ids is null or array_length(p_ordered_entry_ids, 1) is null then
    raise exception 'branch_id and ordered entry ids are required';
  end if;

  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select count(*) into v_count
  from public.queue_entries qe
  where qe.id = any(p_ordered_entry_ids)
    and qe.branch_id = p_branch_id
    and qe.organization_id = v_org
    and qe.status in ('waiting', 'ready');

  if v_count <> array_length(p_ordered_entry_ids, 1) then
    raise exception 'Invalid queue reorder: entries must be waiting or ready in this branch';
  end if;

  v_base := now() - (array_length(p_ordered_entry_ids, 1) + 1) * interval '1 minute';

  for v_i in 1..array_length(p_ordered_entry_ids, 1) loop
    v_id := p_ordered_entry_ids[v_i];
    update public.queue_entries
    set checked_in_at = v_base + (v_i * interval '1 second'),
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_id;
  end loop;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, p_branch_id, auth.uid(),
    'queue.reorder', 'queue_board', p_branch_id::text,
    jsonb_build_object('ordered_ids', to_jsonb(p_ordered_entry_ids))
  );

  return jsonb_build_object('ok', true, 'count', array_length(p_ordered_entry_ids, 1));
end;
$$;

grant execute on function public.update_queue_status(uuid, text, text) to authenticated;
grant execute on function public.reorder_queue_board(uuid, uuid[]) to authenticated;
