-- Org-level provider API keys (set from Settings UI; edge functions read here first, then env fallback).

create table if not exists public.organization_notification_providers (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  semaphore_api_key text,
  resend_api_key text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.organization_notification_providers enable row level security;

revoke all on table public.organization_notification_providers from anon, authenticated;

create or replace function public._notification_key_hint(p_key text)
returns text
language sql
immutable
as $$
  select case
    when p_key is null or length(trim(p_key)) < 4 then null
    else '••••' || right(trim(p_key), 4)
  end;
$$;

create or replace function public.get_notification_channel_settings(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_branch_name text;
  v_contact text;
  v_settings public.notification_branch_settings%rowtype;
  v_providers public.organization_notification_providers%rowtype;
begin
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Permission denied';
  end if;
  if not public.has_permission('notifications.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.name, b.contact_number
  into v_branch_name, v_contact
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = v_org;

  if v_branch_name is null then
    raise exception 'Branch not found';
  end if;

  select * into v_settings
  from public.notification_branch_settings nbs
  where nbs.branch_id = p_branch_id;

  select * into v_providers
  from public.organization_notification_providers onp
  where onp.organization_id = v_org;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'dry_run_mode', coalesce(v_settings.dry_run_mode, true),
    'email_dry_run_mode', coalesce(v_settings.email_dry_run_mode, true),
    'clinic_display_name', coalesce(nullif(trim(v_settings.clinic_display_name), ''), v_branch_name),
    'email_from_address', v_settings.email_from_address,
    'email_reply_to', v_settings.email_reply_to,
    'whatsapp_clinic_phone', coalesce(nullif(trim(v_settings.whatsapp_clinic_phone), ''), v_contact),
    'sms_sender_name', coalesce(nullif(trim(v_settings.sms_sender_name), ''), 'dentali'),
    'default_patient_channel', coalesce(v_settings.default_patient_channel, 'whatsapp_manual'),
    'sms_api_key_configured', v_providers.semaphore_api_key is not null and length(trim(v_providers.semaphore_api_key)) > 0,
    'email_api_key_configured', v_providers.resend_api_key is not null and length(trim(v_providers.resend_api_key)) > 0,
    'sms_api_key_hint', public._notification_key_hint(v_providers.semaphore_api_key),
    'email_api_key_hint', public._notification_key_hint(v_providers.resend_api_key)
  );
end;
$$;

create or replace function public.upsert_notification_channel_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_org uuid := public.current_user_org_id();
  v_channel text := coalesce(nullif(p_payload->>'default_patient_channel', ''), 'whatsapp_manual');
  v_semaphore_key text := nullif(trim(p_payload->>'semaphore_api_key'), '');
  v_resend_key text := nullif(trim(p_payload->>'resend_api_key'), '');
  v_clear_semaphore boolean := coalesce((p_payload->>'clear_semaphore_api_key')::boolean, false);
  v_clear_resend boolean := coalesce((p_payload->>'clear_resend_api_key')::boolean, false);
  v_can_manage_secrets boolean := false;
begin
  if v_branch_id is null then
    raise exception 'branch_id is required';
  end if;
  if not public.has_permission('notifications.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;
  if v_channel not in ('whatsapp_manual', 'sms', 'email') then
    raise exception 'Invalid default_patient_channel';
  end if;

  v_can_manage_secrets :=
    public.user_is_org_admin()
    or public.has_permission('settings.manage', v_branch_id);

  insert into public.notification_branch_settings (
    branch_id,
    organization_id,
    dry_run_mode,
    email_dry_run_mode,
    clinic_display_name,
    email_from_address,
    email_reply_to,
    whatsapp_clinic_phone,
    sms_sender_name,
    default_patient_channel,
    updated_at
  ) values (
    v_branch_id,
    v_org,
    coalesce((p_payload->>'dry_run_mode')::boolean, true),
    coalesce((p_payload->>'email_dry_run_mode')::boolean, true),
    nullif(trim(p_payload->>'clinic_display_name'), ''),
    nullif(trim(p_payload->>'email_from_address'), ''),
    nullif(trim(p_payload->>'email_reply_to'), ''),
    nullif(trim(p_payload->>'whatsapp_clinic_phone'), ''),
    nullif(trim(p_payload->>'sms_sender_name'), ''),
    v_channel,
    now()
  )
  on conflict (branch_id) do update set
    dry_run_mode = coalesce((p_payload->>'dry_run_mode')::boolean, notification_branch_settings.dry_run_mode),
    email_dry_run_mode = coalesce((p_payload->>'email_dry_run_mode')::boolean, notification_branch_settings.email_dry_run_mode),
    clinic_display_name = nullif(trim(p_payload->>'clinic_display_name'), ''),
    email_from_address = nullif(trim(p_payload->>'email_from_address'), ''),
    email_reply_to = nullif(trim(p_payload->>'email_reply_to'), ''),
    whatsapp_clinic_phone = nullif(trim(p_payload->>'whatsapp_clinic_phone'), ''),
    sms_sender_name = nullif(trim(p_payload->>'sms_sender_name'), ''),
    default_patient_channel = v_channel,
    updated_at = now();

  if v_can_manage_secrets and (
    v_semaphore_key is not null
    or v_resend_key is not null
    or v_clear_semaphore
    or v_clear_resend
  ) then
    insert into public.organization_notification_providers (
      organization_id,
      semaphore_api_key,
      resend_api_key,
      updated_at,
      updated_by
    ) values (
      v_org,
      case when v_clear_semaphore then null when v_semaphore_key is not null then v_semaphore_key else null end,
      case when v_clear_resend then null when v_resend_key is not null then v_resend_key else null end,
      now(),
      auth.uid()
    )
    on conflict (organization_id) do update set
      semaphore_api_key = case
        when v_clear_semaphore then null
        when v_semaphore_key is not null then v_semaphore_key
        else organization_notification_providers.semaphore_api_key
      end,
      resend_api_key = case
        when v_clear_resend then null
        when v_resend_key is not null then v_resend_key
        else organization_notification_providers.resend_api_key
      end,
      updated_at = now(),
      updated_by = auth.uid();
  end if;

  return public.get_notification_channel_settings(v_branch_id);
end;
$$;

grant execute on function public.get_notification_channel_settings(uuid) to authenticated;
grant execute on function public.upsert_notification_channel_settings(jsonb) to authenticated;
