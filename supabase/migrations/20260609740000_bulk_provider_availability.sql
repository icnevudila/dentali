-- Module 13: Bulk edit provider weekly availability

create or replace function public.bulk_upsert_provider_availability(
  p_branch_id uuid,
  p_provider_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row jsonb;
  v_count int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  if not public.has_permission('appointments.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.provider_availability (
      organization_id, branch_id, provider_id, day_of_week,
      start_time, end_time, slot_minutes, is_available
    ) values (
      v_org_id,
      p_branch_id,
      p_provider_id,
      (v_row->>'day_of_week')::smallint,
      coalesce((v_row->>'start_time')::time, '09:00'::time),
      coalesce((v_row->>'end_time')::time, '17:00'::time),
      coalesce((v_row->>'slot_minutes')::integer, 30),
      coalesce((v_row->>'is_available')::boolean, true)
    )
    on conflict (branch_id, provider_id, day_of_week) do update
    set
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      slot_minutes = excluded.slot_minutes,
      is_available = excluded.is_available;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('updated', v_count);
end;
$$;

grant execute on function public.bulk_upsert_provider_availability(uuid, uuid, jsonb) to authenticated;
