-- Drop and recreate call_next_patient to prioritize scheduled appointments over walk-ins/others
create or replace function public.call_next_patient(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_code text;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select id, display_code into v_entry_id, v_code
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('waiting', 'ready')
  order by 
    case when appointment_id is not null then 0 else 1 end asc,
    checked_in_at asc
  limit 1
  for update skip locked;

  if v_entry_id is null then
    return jsonb_build_object('found', false);
  end if;

  update public.queue_entries
  set status = 'now_serving',
      called_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_entry_id;

  return jsonb_build_object('found', true, 'id', v_entry_id, 'display_code', v_code);
end;
$$;

grant execute on function public.call_next_patient(uuid) to authenticated;
