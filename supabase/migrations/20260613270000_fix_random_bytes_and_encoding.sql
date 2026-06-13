-- Fix missing pgcrypto gen_random_bytes by switching to native gen_random_uuid()
-- Fix corrupted ANSI characters in consent templates

-- 1. Fix default tokens for branch_public_tokens
alter table public.branch_public_tokens 
  alter column token set default replace(gen_random_uuid()::text, '-', '');

-- 2. Fix default tokens for consent_signing_tokens
alter table public.consent_signing_tokens 
  alter column token set default replace(gen_random_uuid()::text, '-', '');

-- 3. Fix generate_consent_signing_token RPC
create or replace function public.generate_consent_signing_token(
  p_consent_id uuid,
  p_channel text default 'link'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent public.patient_consents%rowtype;
  v_token text;
begin
  select * into v_consent from public.patient_consents where id = p_consent_id;
  if not found then
    raise exception 'Consent not found';
  end if;

  if v_consent.status = 'signed' then
    raise exception 'Consent is already signed';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.consent_signing_tokens (
    patient_consent_id, token, channel, expires_at, created_by
  ) values (
    p_consent_id,
    v_token,
    p_channel,
    now() + interval '7 days',
    public.current_user_id()
  );

  return v_token;
end;
$$;

-- 4. Fix generate_branch_public_token RPC
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

  -- Expire existing tokens for this type/branch
  update public.branch_public_tokens
  set is_active = false
  where branch_id = p_branch_id
    and token_type = p_token_type
    and is_active = true;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.branch_public_tokens (
    organization_id, branch_id, token, token_type, label, expires_at, created_by
  ) values (
    v_org, p_branch_id, v_token, p_token_type, p_label, now() + interval '24 hours', public.current_user_id()
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'token_type', p_token_type);
end;
$$;

-- 5. Fix Character Encoding (ANSI â€“ to standard UTF-8 hyphen -)
update public.consent_templates
set 
  name = replace(name, 'â€“', '-'),
  body = replace(body, 'â€“', '-');
