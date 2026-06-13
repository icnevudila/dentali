-- Module 14: Waitlist (branch-scoped, appointment conversion)

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'contacted', 'booked', 'cancelled', 'expired')),
  urgency text not null default 'normal'
    check (urgency in ('normal', 'urgent', 'high')),
  preferred_date date,
  preferred_time_start time,
  preferred_time_end time,
  notes text,
  appointment_id uuid references public.appointments(id) on delete set null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_waitlist_branch_status
  on public.waitlist_entries(branch_id, status, created_at);

create table if not exists public.waitlist_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  waitlist_entry_id uuid not null references public.waitlist_entries(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  note text,
  outcome text not null default 'reached'
    check (outcome in ('reached', 'no_answer', 'voicemail', 'declined', 'other')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_contact_entry
  on public.waitlist_contact_attempts(waitlist_entry_id, created_at desc);

alter table public.waitlist_entries enable row level security;
alter table public.waitlist_contact_attempts enable row level security;

create policy waitlist_entries_select on public.waitlist_entries
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy waitlist_entries_insert on public.waitlist_entries
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

create policy waitlist_entries_update on public.waitlist_entries
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

create policy waitlist_contact_select on public.waitlist_contact_attempts
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy waitlist_contact_insert on public.waitlist_contact_attempts
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('appointments.write', branch_id)
  );

-- Mark patient as contacted + log attempt
create or replace function public.mark_waitlist_contacted(
  p_entry_id uuid,
  p_note text default null,
  p_outcome text default 'reached'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be contacted in status %', v_entry.status;
  end if;

  insert into public.waitlist_contact_attempts (
    waitlist_entry_id, organization_id, branch_id, note, outcome, created_by
  ) values (
    v_entry.id, v_entry.organization_id, v_entry.branch_id, p_note, p_outcome, auth.uid()
  );

  update public.waitlist_entries
  set status = case when p_outcome = 'declined' then 'cancelled' else 'contacted' end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('id', p_entry_id, 'status', case when p_outcome = 'declined' then 'cancelled' else 'contacted' end);
end;
$$;

-- Book appointment from waitlist entry
create or replace function public.book_waitlist_entry(
  p_entry_id uuid,
  p_scheduled_at timestamptz,
  p_purpose text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_appt_id uuid;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry_id;
  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v_entry.status not in ('waiting', 'contacted') then
    raise exception 'Entry cannot be booked in status %', v_entry.status;
  end if;

  insert into public.appointments (
    organization_id, branch_id, patient_id, scheduled_at, purpose, created_by
  ) values (
    v_entry.organization_id, v_entry.branch_id, v_entry.patient_id,
    p_scheduled_at, coalesce(p_purpose, v_entry.notes), auth.uid()
  )
  returning id into v_appt_id;

  update public.waitlist_entries
  set status = 'booked',
      appointment_id = v_appt_id,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('entry_id', p_entry_id, 'appointment_id', v_appt_id);
end;
$$;

-- Expire stale entries (callable from cron or admin)
create or replace function public.expire_old_waitlist_entries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.waitlist_entries
  set status = 'expired',
      updated_at = now()
  where status in ('waiting', 'contacted')
    and expires_at is not null
    and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_waitlist_contacted(uuid, text, text) to authenticated;
grant execute on function public.book_waitlist_entry(uuid, timestamptz, text) to authenticated;
grant execute on function public.expire_old_waitlist_entries() to authenticated;
