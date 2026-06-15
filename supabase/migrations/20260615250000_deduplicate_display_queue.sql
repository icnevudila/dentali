-- Deduplicate TV display entries by display_code
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

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  -- Select most recent now_serving/in_chair entry per display_code
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
  from (
    select distinct on (display_code) *
    from public.queue_entries
    where branch_id = v_t.branch_id
      and status in ('now_serving', 'in_chair')
    order by display_code, called_at desc nulls last
  ) qe
  left join public.patients p on p.id = qe.patient_id;

  -- Select most recent waiting/ready entry per display_code
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
  from (
    select distinct on (display_code) *
    from public.queue_entries
    where branch_id = v_t.branch_id
      and status in ('waiting', 'ready')
    order by display_code, checked_in_at desc
  ) qe
  left join public.patients p on p.id = qe.patient_id;

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;
