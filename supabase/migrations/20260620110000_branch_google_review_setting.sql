-- Allow clinics to store Google review link per branch (used by auto_review_request_sms).

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
  if p_key not in ('timezone', 'currency_code', 'display_name', 'google_review_url') then
    raise exception 'Unsupported branch setting key';
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
