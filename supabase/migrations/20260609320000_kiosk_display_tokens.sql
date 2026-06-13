-- Module 16–17: Kiosk + TV display public tokens

create table if not exists public.branch_public_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  token_type text not null check (token_type in ('kiosk', 'display')),
  label text,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_branch_public_tokens_branch
  on public.branch_public_tokens(branch_id, token_type, is_active);

create table if not exists public.kiosk_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  token_id uuid not null references public.branch_public_tokens(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kiosk_sessions_expires on public.kiosk_sessions(expires_at);

alter table public.branch_public_tokens enable row level security;
alter table public.kiosk_sessions enable row level security;

create policy branch_public_tokens_staff on public.branch_public_tokens
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

-- Staff: generate token
create or replace function public.generate_branch_public_token(
  p_branch_id uuid,
  p_token_type text,
  p_label text default null
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
begin
  if p_token_type not in ('kiosk', 'display') then
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

  return jsonb_build_object('id', v_id, 'token', v_token, 'token_type', p_token_type);
end;
$$;

-- Anon: open kiosk session
create or replace function public.create_kiosk_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
  v_branch_name text;
  v_session_id uuid;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'kiosk'
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invalid or expired kiosk link';
  end if;

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  insert into public.kiosk_sessions (organization_id, branch_id, token_id, expires_at)
  values (v_t.organization_id, v_t.branch_id, v_t.id, now() + interval '30 minutes')
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'expires_at', (now() + interval '30 minutes')
  );
end;
$$;

-- Anon: patient self check-in via kiosk
create or replace function public.submit_kiosk_checkin(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_code text;
  v_entry_id uuid;
  v_phone_norm text;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Kiosk session expired. Please refresh the page.';
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_norm = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Phone and last name are required';
  end if;

  select p.id into v_patient_id
  from public.patients p
  inner join public.patient_branch_links pbl on pbl.patient_id = p.id and pbl.branch_id = v_session.branch_id
  where p.organization_id = v_session.organization_id
    and p.status = 'active'
    and lower(p.last_name) = lower(trim(p_last_name))
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_phone_norm
  limit 1;

  if v_patient_id is null then
    raise exception 'We could not find your record. Please check with the front desk.';
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_session.branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'You are already checked in. Please wait to be called.';
  end if;

  v_code := public._next_queue_display_code(v_session.branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, display_code, notes
  ) values (
    v_session.organization_id, v_session.branch_id, v_patient_id, v_code, 'Kiosk check-in'
  )
  returning id into v_entry_id;

  return jsonb_build_object('entry_id', v_entry_id, 'display_code', v_code);
end;
$$;

-- Anon: TV queue display (codes only — no PHI)
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
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;

grant execute on function public.generate_branch_public_token(uuid, text, text) to authenticated;
grant execute on function public.create_kiosk_session(text) to anon, authenticated;
grant execute on function public.submit_kiosk_checkin(uuid, text, text) to anon, authenticated;
grant execute on function public.get_public_queue_display(text) to anon, authenticated;
