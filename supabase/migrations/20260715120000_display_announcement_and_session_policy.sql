-- Clinic announcement ticker for TV display + own-session audit read policy.

-- ---------------------------------------------------------------------------
-- Allow display_announcement on branch_settings
-- ---------------------------------------------------------------------------
create or replace function public.set_branch_setting(
  p_branch_id uuid,
  p_key text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in (
    'timezone',
    'currency_code',
    'display_name',
    'google_review_url',
    'display_announcement'
  ) then
    raise exception 'Unsupported branch setting key';
  end if;

  if p_key = 'display_announcement' and char_length(coalesce(p_value, '')) > 280 then
    raise exception 'Announcement must be 280 characters or fewer';
  end if;

  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.branch_settings (branch_id, key, value, updated_at)
  values (p_branch_id, p_key, p_value, now())
  on conflict (branch_id, key) do update
  set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.set_branch_setting(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff can read their own session audit rows (login history)
-- ---------------------------------------------------------------------------
drop policy if exists session_audit_select_own on public.session_audit_logs;
create policy session_audit_select_own on public.session_audit_logs
  for select to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public queue display includes clinic announcement (no PHI)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_queue_display(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_announcement text;
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

  select nullif(trim(bs.value), '')
  into v_announcement
  from public.branch_settings bs
  where bs.branch_id = v_t.branch_id
    and bs.key = 'display_announcement'
  limit 1;

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
    'announcement', v_announcement,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;

grant execute on function public.get_public_queue_display(text) to anon, authenticated;
