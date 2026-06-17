-- Per-branch messaging channel settings (UI-editable; API keys stay in Supabase secrets).

alter table public.notification_branch_settings
  add column if not exists clinic_display_name text,
  add column if not exists email_from_address text,
  add column if not exists email_reply_to text,
  add column if not exists email_dry_run_mode boolean not null default true,
  add column if not exists whatsapp_clinic_phone text,
  add column if not exists sms_sender_name text,
  add column if not exists default_patient_channel text not null default 'whatsapp_manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_branch_settings_default_patient_channel_check'
  ) then
    alter table public.notification_branch_settings
      add constraint notification_branch_settings_default_patient_channel_check
      check (default_patient_channel in ('whatsapp_manual', 'sms', 'email'));
  end if;
end $$;

drop policy if exists notification_branch_settings_select on public.notification_branch_settings;
create policy notification_branch_settings_select on public.notification_branch_settings
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('notifications.read', branch_id)
  );

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

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'dry_run_mode', coalesce(v_settings.dry_run_mode, true),
    'email_dry_run_mode', coalesce(v_settings.email_dry_run_mode, true),
    'clinic_display_name', coalesce(nullif(trim(v_settings.clinic_display_name), ''), v_branch_name),
    'email_from_address', v_settings.email_from_address,
    'email_reply_to', v_settings.email_reply_to,
    'whatsapp_clinic_phone', coalesce(nullif(trim(v_settings.whatsapp_clinic_phone), ''), v_contact),
    'sms_sender_name', coalesce(nullif(trim(v_settings.sms_sender_name), ''), 'dentali'),
    'default_patient_channel', coalesce(v_settings.default_patient_channel, 'whatsapp_manual')
  );
end;
$$;

grant execute on function public.get_notification_channel_settings(uuid) to authenticated;

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

  return public.get_notification_channel_settings(v_branch_id);
end;
$$;

grant execute on function public.upsert_notification_channel_settings(jsonb) to authenticated;

create or replace function public.claim_closeout_email_batch(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'organization_id', q.organization_id,
      'branch_id', q.branch_id,
      'recipient_email', q.recipient_email,
      'snapshot_date', q.snapshot_date,
      'payload', q.payload
    ))
    from (
      select * from public.closeout_email_queue
      where status = 'pending'
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_closeout_email_batch(int) to service_role;
