-- P3 automation: hygiene recall SMS + owner daily digest SMS
-- Depends on: workflow settings, notification_templates, patient_branch_links

-- ---------------------------------------------------------------------------
-- Workflow defaults (new keys)
-- ---------------------------------------------------------------------------
create or replace function public._default_workflow_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'auto_checkin_updates_appointment', true,
    'auto_served_completes_appointment', true,
    'consent_gate_checkin', true,
    'auto_approve_creates_invoice', true,
    'auto_hmo_claim_on_invoice', true,
    'auto_waitlist_on_slot_open', true,
    'auto_sms_reminders', true,
    'auto_payment_reminder', true,
    'auto_hygiene_recall', true,
    'auto_owner_digest_sms', false
  );
$$;

-- ---------------------------------------------------------------------------
-- Internal closeout payload (service role / cron safe — no auth.uid() org)
-- ---------------------------------------------------------------------------
create or replace function public._build_daily_closeout_payload(
  p_org_id uuid,
  p_branch_id uuid default null,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_org_id is null then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'date', p_date,
    'collected', (
      select coalesce(sum(ip.amount), 0)
      from public.invoice_payments ip
      join public.invoices inv on inv.id = ip.invoice_id
      where inv.organization_id = p_org_id
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and ip.created_at::date = p_date
    ),
    'open_balance', (
      select coalesce(sum(inv.total_amount - inv.paid_amount), 0)
      from public.invoices inv
      where inv.organization_id = p_org_id
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'open_invoice_count', (
      select count(*)
      from public.invoices inv
      where inv.organization_id = p_org_id
        and (p_branch_id is null or inv.branch_id = p_branch_id)
        and inv.status in ('draft', 'sent', 'partial')
    ),
    'appointments_completed', (
      select count(*)
      from public.appointments a
      where a.organization_id = p_org_id
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'completed'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'no_show', (
      select count(*)
      from public.appointments a
      where a.organization_id = p_org_id
        and (p_branch_id is null or a.branch_id = p_branch_id)
        and a.status = 'no_show'
        and (a.scheduled_at at time zone 'Asia/Manila')::date = p_date
    ),
    'pending_consents', (
      select count(*)
      from public.patient_consents pc
      where pc.organization_id = p_org_id
        and (p_branch_id is null or pc.branch_id = p_branch_id)
        and pc.status = 'pending'
    ),
    'hmo_pending', (
      select count(*)
      from public.hmo_claims hc
      where hc.organization_id = p_org_id
        and (p_branch_id is null or hc.branch_id = p_branch_id)
        and hc.status in ('draft', 'submitted', 'under_review')
    ),
    'low_stock', (
      select case when p_branch_id is null then 0 else (
        select count(*) from public.inventory_items i
        where i.branch_id = p_branch_id and i.is_active
          and (i.quantity_on_hand <= i.min_stock_level
            or (i.expiry_date is not null and i.expiry_date < current_date))
      ) end
    )
  );
end;
$$;

grant execute on function public._build_daily_closeout_payload(uuid, uuid, date) to service_role;

-- Authenticated wrapper keeps existing permission model
create or replace function public.get_daily_closeout(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  return public._build_daily_closeout_payload(v_org, p_branch_id, p_date);
end;
$$;

grant execute on function public.get_daily_closeout(uuid, date) to authenticated;

-- Fix closeout email enqueue to use internal builder
create or replace function public.enqueue_closeout_email_digest(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_admin record;
  v_payload jsonb;
  v_count int := 0;
begin
  for v_org in
    select distinct o.id as organization_id
    from public.organizations o
  loop
    for v_admin in
      select distinct p.email
      from public.profiles p
      join public.staff_branch_assignments sba on sba.profile_id = p.id
      join public.roles r on r.id = sba.role_id
      where p.organization_id = v_org.organization_id
        and r.name in ('owner', 'admin')
        and p.email is not null
        and length(trim(p.email)) > 0
    loop
      v_payload := public._build_daily_closeout_payload(v_org.organization_id, null, p_date);

      if not exists (
        select 1 from public.closeout_email_queue
        where organization_id = v_org.organization_id
          and recipient_email = v_admin.email
          and snapshot_date = p_date
          and status in ('pending', 'sent', 'dry_run')
      ) then
        insert into public.closeout_email_queue (
          organization_id, branch_id, recipient_email, snapshot_date, payload
        ) values (
          v_org.organization_id, null, v_admin.email, p_date, v_payload
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hygiene recall queue
-- ---------------------------------------------------------------------------
create table if not exists public.patient_recall_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  last_visit_date date not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_recall_queue_pending
  on public.patient_recall_queue(branch_id, created_at)
  where processed_at is null;

alter table public.patient_recall_queue enable row level security;

drop policy if exists patient_recall_queue_select on public.patient_recall_queue;
create policy patient_recall_queue_select on public.patient_recall_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', branch_id)
  );

drop policy if exists patient_recall_queue_service on public.patient_recall_queue;
create policy patient_recall_queue_service on public.patient_recall_queue
  for all to service_role using (true) with check (true);

create table if not exists public.patient_recall_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  last_visit_date date not null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_patient_recall_dispatches_recent
  on public.patient_recall_dispatches(patient_id, branch_id, sent_at desc);

alter table public.patient_recall_dispatches enable row level security;

drop policy if exists patient_recall_dispatches_select on public.patient_recall_dispatches;
create policy patient_recall_dispatches_select on public.patient_recall_dispatches
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('patients.read', branch_id)
  );

drop policy if exists patient_recall_dispatches_service on public.patient_recall_dispatches;
create policy patient_recall_dispatches_service on public.patient_recall_dispatches
  for all to service_role using (true) with check (true);

create or replace function public.enqueue_hygiene_recalls(
  p_branch_id uuid,
  p_months int default 6
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row record;
  v_cutoff date := (current_date - make_interval(months => greatest(p_months, 1)));
  v_window_start date := v_cutoff - 7;
begin
  if not public._workflow_enabled(p_branch_id, 'auto_hygiene_recall') then
    return 0;
  end if;

  for v_row in
    select
      b.organization_id,
      pbl.branch_id,
      pbl.patient_id,
      pbl.last_visit_at::date as last_visit_date
    from public.patient_branch_links pbl
    join public.patients p on p.id = pbl.patient_id
    join public.branches b on b.id = pbl.branch_id
    where pbl.branch_id = p_branch_id
      and b.is_active
      and p.status = 'active'
      and pbl.last_visit_at is not null
      and pbl.last_visit_at::date >= v_window_start
      and pbl.last_visit_at::date <= v_cutoff
      and coalesce(length(trim(p.phone)), 0) > 0
      and not exists (
        select 1 from public.appointments a
        where a.patient_id = pbl.patient_id
          and a.branch_id = p_branch_id
          and a.status in ('scheduled', 'confirmed', 'checked_in')
          and a.scheduled_at >= now()
      )
      and not exists (
        select 1 from public.patient_recall_dispatches d
        where d.patient_id = pbl.patient_id
          and d.branch_id = p_branch_id
          and d.sent_at > now() - interval '150 days'
      )
      and not exists (
        select 1 from public.patient_recall_queue q
        where q.patient_id = pbl.patient_id
          and q.branch_id = p_branch_id
          and q.processed_at is null
      )
  loop
    insert into public.patient_recall_queue (
      organization_id, branch_id, patient_id, last_visit_date
    ) values (
      v_row.organization_id, v_row.branch_id, v_row.patient_id, v_row.last_visit_date
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.enqueue_hygiene_recalls(uuid, int) to service_role;

create or replace function public.claim_hygiene_recall_batch(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'branch_id', q.branch_id,
      'organization_id', q.organization_id,
      'patient_id', q.patient_id,
      'last_visit_date', q.last_visit_date
    ))
    from (
      select * from public.patient_recall_queue
      where processed_at is null
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_hygiene_recall_batch(int) to service_role;

create or replace function public.mark_hygiene_recall_processed(
  p_id uuid,
  p_dispatched boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.patient_recall_queue%rowtype;
begin
  select * into v_row
  from public.patient_recall_queue
  where id = p_id and processed_at is null
  for update;

  if not found then
    return;
  end if;

  update public.patient_recall_queue
  set processed_at = now()
  where id = p_id;

  if p_dispatched then
    insert into public.patient_recall_dispatches (
      organization_id, branch_id, patient_id, last_visit_date
    ) values (
      v_row.organization_id, v_row.branch_id, v_row.patient_id, v_row.last_visit_date
    );
  end if;
end;
$$;

grant execute on function public.mark_hygiene_recall_processed(uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Owner digest SMS queue
-- ---------------------------------------------------------------------------
create table if not exists public.owner_digest_sms_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  recipient_phone text not null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  snapshot_date date not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'dry_run', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_owner_digest_sms_pending
  on public.owner_digest_sms_queue(branch_id, snapshot_date)
  where status = 'pending';

alter table public.owner_digest_sms_queue enable row level security;

drop policy if exists owner_digest_sms_queue_admin on public.owner_digest_sms_queue;
create policy owner_digest_sms_queue_admin on public.owner_digest_sms_queue
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );

drop policy if exists owner_digest_sms_queue_service on public.owner_digest_sms_queue;
create policy owner_digest_sms_queue_service on public.owner_digest_sms_queue
  for all to service_role using (true) with check (true);

create or replace function public.enqueue_owner_digest_sms(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch record;
  v_owner record;
  v_payload jsonb;
  v_count int := 0;
begin
  for v_branch in
    select b.id as branch_id, b.organization_id
    from public.branches b
    where b.is_active
      and public._workflow_enabled(b.id, 'auto_owner_digest_sms')
  loop
    v_payload := public._build_daily_closeout_payload(v_branch.organization_id, v_branch.branch_id, p_date);

    for v_owner in
      select distinct p.id as profile_id, sp.phone_number
      from public.profiles p
      join public.staff_profiles sp on sp.profile_id = p.id
      join public.staff_branch_assignments sba on sba.profile_id = p.id
      join public.roles r on r.id = sba.role_id
      where p.organization_id = v_branch.organization_id
        and sba.branch_id = v_branch.branch_id
        and r.name in ('owner', 'admin')
        and coalesce(sp.is_active, true)
        and sp.phone_number is not null
        and length(trim(sp.phone_number)) > 0
    loop
      if not exists (
        select 1 from public.owner_digest_sms_queue q
        where q.branch_id = v_branch.branch_id
          and q.recipient_phone = trim(v_owner.phone_number)
          and q.snapshot_date = p_date
          and q.status in ('pending', 'sent', 'dry_run')
      ) then
        insert into public.owner_digest_sms_queue (
          organization_id,
          branch_id,
          recipient_phone,
          recipient_profile_id,
          snapshot_date,
          payload
        ) values (
          v_branch.organization_id,
          v_branch.branch_id,
          trim(v_owner.phone_number),
          v_owner.profile_id,
          p_date,
          v_payload
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.enqueue_owner_digest_sms(date) to service_role;

create or replace function public.claim_owner_digest_sms_batch(p_limit int default 20)
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
      'recipient_phone', q.recipient_phone,
      'snapshot_date', q.snapshot_date,
      'payload', q.payload
    ))
    from (
      select * from public.owner_digest_sms_queue
      where status = 'pending'
      order by created_at asc
      limit greatest(coalesce(p_limit, 20), 1)
      for update skip locked
    ) q
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.claim_owner_digest_sms_batch(int) to service_role;

create or replace function public.mark_owner_digest_sms_sent(
  p_id uuid,
  p_status text default 'sent',
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.owner_digest_sms_queue
  set status = coalesce(p_status, 'sent'),
      error_message = p_error,
      sent_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.mark_owner_digest_sms_sent(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Notification templates (new orgs + backfill existing orgs)
-- ---------------------------------------------------------------------------
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
     '{{clinic_name}}: Queue number {{queue_code}} — please proceed to the front desk.'),
    (p_org_id, 'hygiene_recall',
     'Hygiene recall (6 months)',
     'Hi {{patient_name}}, it has been 6 months since your visit at {{clinic_name}}. Book your check-up: {{booking_link}}'),
    (p_org_id, 'owner_daily_digest',
     'Owner daily digest SMS',
     '{{clinic_name}} {{date}}: Collected {{collected}}, open {{open_balance}}, done {{appointments_completed}}, no-shows {{no_show}}.');
end;
$$;

insert into public.notification_templates (organization_id, template_key, name, body)
select
  o.id,
  v.template_key,
  v.name,
  v.body
from public.organizations o
cross join (
  values
    (
      'hygiene_recall',
      'Hygiene recall (6 months)',
      'Hi {{patient_name}}, it has been 6 months since your visit at {{clinic_name}}. Book your check-up: {{booking_link}}'
    ),
    (
      'owner_daily_digest',
      'Owner daily digest SMS',
      '{{clinic_name}} {{date}}: Collected {{collected}}, open {{open_balance}}, done {{appointments_completed}}, no-shows {{no_show}}.'
    )
) as v(template_key, name, body)
where not exists (
  select 1 from public.notification_templates nt
  where nt.organization_id = o.id and nt.template_key = v.template_key
);
