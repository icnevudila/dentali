-- List, revoke, and auto-replace branch public tokens (TV / kiosk / portal links)

create or replace function public.list_branch_public_tokens(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
    from (
      select
        t.id,
        t.token_type,
        t.label,
        t.is_active,
        t.created_at,
        t.expires_at,
        right(t.token, 8) as token_suffix,
        dh.last_seen_at as last_display_ping_at,
        dh.seen_count as display_ping_count,
        (
          select max(ks.created_at)
          from public.kiosk_sessions ks
          where ks.token_id = t.id
        ) as last_kiosk_session_at
      from public.branch_public_tokens t
      left join public.display_heartbeats dh on dh.token_id = t.id
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.revoke_branch_public_token(p_token_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_t public.branch_public_tokens%rowtype;
begin
  select * into v_t
  from public.branch_public_tokens
  where id = p_token_id
    and organization_id = v_org;

  if not found then
    raise exception 'Token not found';
  end if;

  if not public.has_permission('queue.manage', v_t.branch_id) then
    raise exception 'Permission denied';
  end if;

  update public.branch_public_tokens
  set is_active = false
  where id = p_token_id;

  return jsonb_build_object('id', p_token_id, 'revoked', true);
end;
$$;

-- Revoke tokens of a type, optionally keeping the N most recently created (or most recently pinged for display)
create or replace function public.revoke_branch_public_tokens(
  p_branch_id uuid,
  p_token_type text,
  p_keep_count int default 1,
  p_prefer_recent_ping boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_keep_ids uuid[];
  v_revoked int;
begin
  if p_token_type not in ('kiosk', 'display', 'portal') then
    raise exception 'Invalid token type';
  end if;

  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  p_keep_count := greatest(coalesce(p_keep_count, 1), 0);

  if p_keep_count = 0 then
    update public.branch_public_tokens
    set is_active = false
    where organization_id = v_org
      and branch_id = p_branch_id
      and token_type = p_token_type
      and is_active = true;
    get diagnostics v_revoked = row_count;
    return jsonb_build_object('revoked', v_revoked, 'kept', 0);
  end if;

  if p_token_type = 'display' and p_prefer_recent_ping then
    select coalesce(array_agg(id), '{}')
    into v_keep_ids
    from (
      select t.id
      from public.branch_public_tokens t
      left join public.display_heartbeats dh on dh.token_id = t.id
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = p_token_type
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
      order by dh.last_seen_at desc nulls last, t.created_at desc
      limit p_keep_count
    ) keepers;
  else
    select coalesce(array_agg(id), '{}')
    into v_keep_ids
    from (
      select t.id
      from public.branch_public_tokens t
      where t.organization_id = v_org
        and t.branch_id = p_branch_id
        and t.token_type = p_token_type
        and t.is_active = true
        and (t.expires_at is null or t.expires_at > now())
      order by t.created_at desc
      limit p_keep_count
    ) keepers;
  end if;

  update public.branch_public_tokens
  set is_active = false
  where organization_id = v_org
    and branch_id = p_branch_id
    and token_type = p_token_type
    and is_active = true
    and id <> all(v_keep_ids);

  get diagnostics v_revoked = row_count;

  return jsonb_build_object(
    'revoked', v_revoked,
    'kept', coalesce(array_length(v_keep_ids, 1), 0)
  );
end;
$$;

-- New link replaces older links of the same type (keeps only the newly created token)
drop function if exists public.generate_branch_public_token(uuid, text, text);

create or replace function public.generate_branch_public_token(
  p_branch_id uuid,
  p_token_type text,
  p_label text default null,
  p_replace_existing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_token text;
  v_id uuid;
  v_revoked int := 0;
begin
  if p_token_type not in ('kiosk', 'display', 'portal') then
    raise exception 'Invalid token type';
  end if;

  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.branch_public_tokens (
    organization_id, branch_id, token_type, label, created_by
  ) values (
    v_org, p_branch_id, p_token_type, p_label, auth.uid()
  )
  returning id, token into v_id, v_token;

  if coalesce(p_replace_existing, true) then
    update public.branch_public_tokens
    set is_active = false
    where organization_id = v_org
      and branch_id = p_branch_id
      and token_type = p_token_type
      and is_active = true
      and id <> v_id;
    get diagnostics v_revoked = row_count;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'token_type', p_token_type,
    'revoked_previous', v_revoked
  );
end;
$$;

grant execute on function public.list_branch_public_tokens(uuid) to authenticated;
grant execute on function public.revoke_branch_public_token(uuid) to authenticated;
grant execute on function public.revoke_branch_public_tokens(uuid, text, int, boolean) to authenticated;
grant execute on function public.generate_branch_public_token(uuid, text, text, boolean) to authenticated;
