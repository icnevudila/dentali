-- Expose branch_id on public display payload for Realtime subscriptions

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

  select coalesce(jsonb_agg(jsonb_build_object('display_code', display_code) order by called_at nulls last), '[]'::jsonb)
  into v_now_serving
  from public.queue_entries
  where branch_id = v_t.branch_id and status = 'now_serving';

  select coalesce(jsonb_agg(jsonb_build_object('display_code', display_code) order by checked_in_at), '[]'::jsonb)
  into v_waiting
  from public.queue_entries
  where branch_id = v_t.branch_id and status in ('waiting', 'ready');

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;
