-- Module 15: Check-in queue board

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  display_code text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled')),
  chair_label text,
  notes text,
  checked_in_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_queue_branch_status
  on public.queue_entries(branch_id, status, checked_in_at);

alter table public.queue_entries enable row level security;

create policy queue_entries_select on public.queue_entries
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

create policy queue_entries_insert on public.queue_entries
  for insert to authenticated with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

create policy queue_entries_update on public.queue_entries
  for update to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('queue.manage', branch_id)
  );

create or replace function public._next_queue_display_code(p_branch_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_num integer;
begin
  select count(*) + 1 into v_num
  from public.queue_entries
  where branch_id = p_branch_id
    and checked_in_at::date = (now() at time zone 'Asia/Manila')::date;

  return 'Q' || lpad(v_num::text, 3, '0');
end;
$$;

create or replace function public.check_in_patient(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_patient_id uuid := (p_payload->>'patient_id')::uuid;
  v_appointment_id uuid := nullif(p_payload->>'appointment_id', '')::uuid;
  v_notes text := nullif(p_payload->>'notes', '');
  v_org uuid := public.current_user_org_id();
  v_code text;
  v_id uuid;
begin
  if v_branch_id is null or v_patient_id is null then
    raise exception 'branch_id and patient_id are required';
  end if;

  if not public.has_permission('queue.manage', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  if exists (
    select 1 from public.queue_entries
    where branch_id = v_branch_id
      and patient_id = v_patient_id
      and status in ('waiting', 'ready', 'now_serving', 'in_chair')
  ) then
    raise exception 'Patient is already in the queue';
  end if;

  v_code := public._next_queue_display_code(v_branch_id);

  insert into public.queue_entries (
    organization_id, branch_id, patient_id, appointment_id,
    display_code, notes, created_by
  ) values (
    v_org, v_branch_id, v_patient_id, v_appointment_id,
    v_code, v_notes, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'display_code', v_code, 'status', 'waiting');
end;
$$;

create or replace function public.update_queue_status(
  p_entry_id uuid,
  p_status text,
  p_chair_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    raise exception 'Queue entry not found';
  end if;

  if not public.has_permission('queue.manage', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  if p_status not in ('waiting', 'ready', 'now_serving', 'in_chair', 'served', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  update public.queue_entries
  set status = p_status,
      chair_label = coalesce(p_chair_label, chair_label),
      called_at = case when p_status = 'now_serving' and called_at is null then now() else called_at end,
      completed_at = case when p_status = 'served' then now() else completed_at end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('id', p_entry_id, 'status', p_status);
end;
$$;

create or replace function public.call_next_patient(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_code text;
begin
  if not public.has_permission('queue.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select id, display_code into v_entry_id, v_code
  from public.queue_entries
  where branch_id = p_branch_id
    and status in ('waiting', 'ready')
  order by checked_in_at asc
  limit 1
  for update skip locked;

  if v_entry_id is null then
    return jsonb_build_object('found', false);
  end if;

  update public.queue_entries
  set status = 'now_serving',
      called_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_entry_id;

  return jsonb_build_object('found', true, 'id', v_entry_id, 'display_code', v_code);
end;
$$;

grant execute on function public.check_in_patient(jsonb) to authenticated;
grant execute on function public.update_queue_status(uuid, text, text) to authenticated;
grant execute on function public.call_next_patient(uuid) to authenticated;
