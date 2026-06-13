-- Module 18: Notification templates + logs (SMS MVP, dry-run default)

insert into public.permissions (name, description) values
  ('notifications.read', 'View notification templates and logs'),
  ('notifications.write', 'Edit templates and send test messages')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.name in ('notifications.read', 'notifications.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'receptionist'
  and p.name = 'notifications.read'
on conflict do nothing;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  template_key text not null,
  name text not null,
  channel text not null default 'sms' check (channel in ('sms', 'email')),
  body text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_notification_templates_key
  on public.notification_templates(organization_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), template_key);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  template_id uuid references public.notification_templates(id) on delete set null,
  template_key text,
  recipient_phone text,
  body_preview text not null,
  status text not null default 'dry_run'
    check (status in ('dry_run', 'queued', 'sent', 'failed', 'delivered')),
  error_message text,
  provider_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_logs_branch
  on public.notification_logs(branch_id, created_at desc);

create table if not exists public.notification_branch_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dry_run_mode boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_templates enable row level security;
alter table public.notification_logs enable row level security;
alter table public.notification_branch_settings enable row level security;

create policy notification_templates_select on public.notification_templates
  for select to authenticated using (
    organization_id = public.current_user_org_id()
  );

create policy notification_templates_insert on public.notification_templates
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
  );

create policy notification_templates_update on public.notification_templates
  for update to authenticated using (
    organization_id = public.current_user_org_id()
  );

create policy notification_logs_select on public.notification_logs
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and (branch_id is null or public.user_has_branch_access(branch_id))
  );

create policy notification_logs_insert on public.notification_logs
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
  );

create policy notification_branch_settings_all on public.notification_branch_settings
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('notifications.write', branch_id)
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('notifications.write', branch_id)
  );

-- Seed default templates for an org
create or replace function public.seed_notification_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.notification_templates where organization_id = p_org_id limit 1) then
    return;
  end if;

  insert into public.notification_templates (organization_id, template_key, name, body) values
    (p_org_id, 'appointment_reminder',
     'Appointment reminder',
     'Hi {{patient_name}}, reminder: your appointment at {{clinic_name}} is on {{appointment_date}} at {{appointment_time}}.'),
    (p_org_id, 'waitlist_slot',
     'Waitlist slot available',
     'Hi {{patient_name}}, a slot opened at {{clinic_name}}. Please call us to confirm your appointment.'),
    (p_org_id, 'payment_reminder',
     'Payment reminder',
     'Hi {{patient_name}}, you have an outstanding balance of {{amount}} at {{clinic_name}}. Thank you.'),
    (p_org_id, 'queue_called',
     'Queue called',
     '{{clinic_name}}: Queue number {{queue_code}} — please proceed to the front desk.');
end;
$$;

-- Render {{var}} placeholders
create or replace function public._render_notification_body(p_body text, p_vars jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_result text := p_body;
  v_key text;
  v_val text;
begin
  for v_key, v_val in select * from jsonb_each_text(coalesce(p_vars, '{}'::jsonb))
  loop
    v_result := replace(v_result, '{{' || v_key || '}}', v_val);
  end loop;
  return v_result;
end;
$$;

create or replace function public.send_test_notification(
  p_template_id uuid,
  p_phone text,
  p_variables jsonb default '{}'::jsonb,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tpl public.notification_templates%rowtype;
  v_branch_id uuid := p_branch_id;
  v_dry_run boolean := true;
  v_body text;
  v_log_id uuid;
  v_status text;
begin
  select * into v_tpl from public.notification_templates where id = p_template_id;
  if not found then
    raise exception 'Template not found';
  end if;

  v_branch_id := coalesce(p_branch_id, v_tpl.branch_id);
  if v_branch_id is null then
    select id into v_branch_id from public.branches
    where organization_id = v_tpl.organization_id and is_active = true
    order by created_at limit 1;
  end if;

  if not public.has_permission('notifications.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(nbs.dry_run_mode, true) into v_dry_run
  from public.notification_branch_settings nbs
  where nbs.branch_id = v_branch_id;

  if not found then
    v_dry_run := true;
  end if;

  v_body := public._render_notification_body(v_tpl.body, p_variables);
  v_status := case when v_dry_run then 'dry_run' else 'queued' end;

  insert into public.notification_logs (
    organization_id, branch_id, template_id, template_key,
    recipient_phone, body_preview, status, created_by
  ) values (
    v_tpl.organization_id, v_branch_id, v_tpl.id, v_tpl.template_key,
    p_phone, v_body, v_status, auth.uid()
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'log_id', v_log_id,
    'status', v_status,
    'dry_run', v_dry_run,
    'body_preview', v_body
  );
end;
$$;

create or replace function public.get_notification_status(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dry_run boolean := true;
  v_sent bigint;
  v_failed bigint;
  v_dry bigint;
begin
  if not public.has_permission('notifications.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(nbs.dry_run_mode, true) into v_dry_run
  from public.notification_branch_settings nbs where nbs.branch_id = p_branch_id;

  select count(*) into v_sent from public.notification_logs
  where branch_id = p_branch_id and status in ('sent', 'delivered')
    and created_at >= (now() at time zone 'Asia/Manila')::date;

  select count(*) into v_failed from public.notification_logs
  where branch_id = p_branch_id and status = 'failed'
    and created_at >= (now() at time zone 'Asia/Manila')::date;

  select count(*) into v_dry from public.notification_logs
  where branch_id = p_branch_id and status = 'dry_run'
    and created_at >= (now() at time zone 'Asia/Manila')::date;

  return jsonb_build_object(
    'dry_run_mode', coalesce(v_dry_run, true),
    'sent_today', v_sent,
    'failed_today', v_failed,
    'dry_run_today', v_dry
  );
end;
$$;

grant execute on function public.seed_notification_templates(uuid) to authenticated;
grant execute on function public.send_test_notification(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.get_notification_status(uuid) to authenticated;

-- Seed templates for existing orgs
do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations
  loop
    perform public.seed_notification_templates(v_org);
  end loop;
end;
$$;
