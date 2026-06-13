-- TV display: heavily masked patient names (no full PHI on public token)

create or replace function public._mask_patient_display_name(p_first text, p_last text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(trim(p_first), '') = '' and coalesce(trim(p_last), '') = '' then null
    when coalesce(trim(p_last), '') = '' then upper(left(trim(p_first), 1)) || '***'
    when coalesce(trim(p_first), '') = '' then upper(left(trim(p_last), 1)) || '***'
    else upper(left(trim(p_first), 1)) || '*** ' || upper(left(trim(p_last), 1)) || '***'
  end;
$$;

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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name)
      )
      order by qe.called_at nulls last
    ),
    '[]'::jsonb
  )
  into v_now_serving
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id and qe.status = 'now_serving';

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
  where qe.branch_id = v_t.branch_id and qe.status in ('waiting', 'ready');

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;
