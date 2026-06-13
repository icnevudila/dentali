-- Marathon: BOM workflow toggle + TV display heartbeat (VA-F3-04, VA-F4-24)

-- ---------------------------------------------------------------------------
-- Workflow: auto BOM deduct toggle
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
    'auto_deduct_procedure_bom', true
  );
$$;

alter table public.branch_workflow_settings
  alter column settings set default public._default_workflow_settings();

create or replace function public._deduct_bom_on_queue_served(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_appt record;
  v_item record;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if v_entry.id is null then return; end if;

  if not public._workflow_enabled(v_entry.branch_id, 'auto_deduct_procedure_bom') then
    return;
  end if;

  select a.* into v_appt
  from public.appointments a
  where a.patient_id = v_entry.patient_id
    and a.branch_id = v_entry.branch_id
    and a.status = 'completed'
    and (a.scheduled_at at time zone 'Asia/Manila')::date = current_date
  order by a.updated_at desc
  limit 1;

  if v_appt.id is null then return; end if;

  for v_item in
    select distinct tpi.procedure_id
    from public.treatment_plan_items tpi
    join public.treatment_plans tp on tp.id = tpi.plan_id
    where tp.patient_id = v_entry.patient_id
      and tp.branch_id = v_entry.branch_id
      and tp.status = 'approved'
      and tpi.procedure_id is not null
    limit 3
  loop
    perform public._deduct_procedure_bom_internal(v_item.procedure_id, v_entry.branch_id, 'Auto BOM on queue served');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- TV display heartbeat (PII-free last refresh for owners)
-- ---------------------------------------------------------------------------
create table if not exists public.display_heartbeats (
  token_id uuid primary key references public.branch_public_tokens(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  seen_count bigint not null default 1
);

create index if not exists idx_display_heartbeats_branch
  on public.display_heartbeats(branch_id, last_seen_at desc);

alter table public.display_heartbeats enable row level security;

drop policy if exists display_heartbeats_select on public.display_heartbeats;
create policy display_heartbeats_select on public.display_heartbeats
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('queue.manage', branch_id)
  );

create or replace function public.record_display_heartbeat(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.branch_public_tokens%rowtype;
begin
  select * into v_t
  from public.branch_public_tokens
  where token = p_token
    and token_type = 'display'
    and is_active = true
  limit 1;

  if v_t.id is null then
    return;
  end if;

  insert into public.display_heartbeats (token_id, organization_id, branch_id, last_seen_at, seen_count)
  values (v_t.id, v_t.organization_id, v_t.branch_id, now(), 1)
  on conflict (token_id) do update set
    last_seen_at = now(),
    seen_count = public.display_heartbeats.seen_count + 1;
end;
$$;

grant execute on function public.record_display_heartbeat(text) to anon, authenticated;

create or replace function public.get_display_health_analytics(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_active_tokens int;
  v_last_heartbeat timestamptz;
  v_last_queue_activity timestamptz;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select count(*)::int
  into v_active_tokens
  from public.branch_public_tokens t
  where t.organization_id = v_org
    and t.branch_id = p_branch_id
    and t.token_type = 'display'
    and t.is_active = true
    and (t.expires_at is null or t.expires_at > now());

  select max(dh.last_seen_at)
  into v_last_heartbeat
  from public.display_heartbeats dh
  where dh.organization_id = v_org
    and dh.branch_id = p_branch_id;

  select max(greatest(q.checked_in_at, q.called_at, q.served_at))
  into v_last_queue_activity
  from public.queue_entries q
  where q.organization_id = v_org
    and q.branch_id = p_branch_id
    and q.checked_in_at >= (current_date - interval '7 days');

  return jsonb_build_object(
    'active_display_tokens', coalesce(v_active_tokens, 0),
    'has_active_link', coalesce(v_active_tokens, 0) > 0,
    'last_refresh_at', v_last_heartbeat,
    'minutes_since_refresh', case
      when v_last_heartbeat is null then null
      else round(extract(epoch from (now() - v_last_heartbeat)) / 60.0)::int
    end,
    'is_online', v_last_heartbeat is not null and v_last_heartbeat >= now() - interval '5 minutes',
    'last_queue_activity', v_last_queue_activity,
    'minutes_since_activity', case
      when v_last_queue_activity is null then null
      else round(extract(epoch from (now() - v_last_queue_activity)) / 60.0)::int
    end
  );
end;
$$;

grant execute on function public.get_display_health_analytics(uuid) to authenticated;
