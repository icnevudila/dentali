-- Fix TV display sync: remove restrictive checked_in_at date filter for active queue entries
-- This ensures that any active patients (waiting, ready, now_serving, in_chair) show up on the TV
-- display even if they checked in on a previous day or if there are timezone/date differences.

create or replace function public.get_public_queue_display(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_now_serving jsonb;
  v_waiting jsonb;
  v_today date;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'display'
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid display link';
  end if;

  v_today := cast(now() at time zone 'Asia/Manila' as date);

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name),
        'called_at', qe.called_at
      )
      order by qe.called_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_now_serving
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id
    and qe.status in ('now_serving', 'in_chair');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name)
      )
      order by qe.checked_in_at
    ),
    '[]'::jsonb
  )
  into v_waiting
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id
    and qe.status in ('waiting', 'ready');

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;
