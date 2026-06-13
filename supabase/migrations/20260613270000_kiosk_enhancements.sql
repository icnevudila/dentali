-- Add mood to queue_entries
alter table public.queue_entries add column if not exists patient_mood text;

-- RPC to update mood
create or replace function public.update_queue_entry_mood(
  p_entry_id uuid,
  p_mood text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queue_entries
  set patient_mood = p_mood
  where id = p_entry_id;
end;
$$;

-- RPC to get live queue stats for kiosk
create or replace function public.get_kiosk_queue_stats(
  p_branch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serving jsonb;
  v_wait_count int;
begin
  -- get array of display codes currently serving (status IN ('now_serving', 'in_chair'))
  select coalesce(jsonb_agg(display_code order by created_at asc), '[]'::jsonb)
  into v_serving
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('now_serving', 'in_chair')
    and cast(created_at at time zone 'Asia/Manila' as date) = cast(now() at time zone 'Asia/Manila' as date);

  -- get count of waiting patients
  select count(*)
  into v_wait_count
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('waiting', 'ready')
    and cast(created_at at time zone 'Asia/Manila' as date) = cast(now() at time zone 'Asia/Manila' as date);

  return jsonb_build_object(
    'serving', coalesce(v_serving, '[]'::jsonb),
    'waitCount', coalesce(v_wait_count, 0)
  );
end;
$$;
