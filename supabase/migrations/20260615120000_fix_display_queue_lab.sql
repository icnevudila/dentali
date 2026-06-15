-- Fix TV display sync: show called patients (now_serving + in_chair), faster recall, lab_cases RLS

-- ---------------------------------------------------------------------------
-- TV display: include in_chair patients, today's queue only, expose called_at
-- ---------------------------------------------------------------------------
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
  v_today date;
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

  v_today := cast(now() at time zone 'Asia/Manila' as date);

  select name into v_branch_name from public.branches where id = v_t.branch_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name),
        'called_at', qe.called_at
      )
      order by qe.called_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_now_serving
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id
    and qe.status in ('now_serving', 'in_chair')
    and cast(qe.checked_in_at at time zone 'Asia/Manila' as date) = v_today;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_code', qe.display_code,
        'masked_name', public._mask_patient_display_name(p.first_name, p.last_name)
      )
      order by qe.checked_in_at
    ),
    '[]'::jsonb
  )
  into v_waiting
  from public.queue_entries qe
  left join public.patients p on p.id = qe.patient_id
  where qe.branch_id = v_t.branch_id
    and qe.status in ('waiting', 'ready')
    and cast(qe.checked_in_at at time zone 'Asia/Manila' as date) = v_today;

  return jsonb_build_object(
    'branch_id', v_t.branch_id,
    'branch_name', v_branch_name,
    'now_serving', v_now_serving,
    'waiting', v_waiting,
    'updated_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Announce / recall: refresh called_at so TV display + voice re-trigger
-- ---------------------------------------------------------------------------
create or replace function public.recall_queue_patient(p_entry_id uuid)
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

  if v_entry.status not in ('now_serving', 'in_chair') then
    raise exception 'Patient must be currently serving to announce';
  end if;

  update public.queue_entries
  set called_at = now(),
      updated_at = now()
  where id = p_entry_id;

  return jsonb_build_object('success', true, 'display_code', v_entry.display_code);
end;
$$;

grant execute on function public.recall_queue_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Queue status: merge permission checks, called_at refresh, chair tracking
-- ---------------------------------------------------------------------------
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
  v_in_chair_at timestamptz;
  v_completed_at timestamptz;
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

  v_in_chair_at := v_entry.in_chair_at;
  v_completed_at := v_entry.completed_at;

  if p_status = 'in_chair' and v_entry.status is distinct from 'in_chair' then
    v_in_chair_at := now();
  end if;

  if p_status = 'served' and v_entry.status is distinct from 'served' then
    v_completed_at := now();
  end if;

  update public.queue_entries
  set status = p_status,
      chair_label = coalesce(p_chair_label, chair_label),
      called_at = case when p_status = 'now_serving' then now() else called_at end,
      in_chair_at = v_in_chair_at,
      completed_at = v_completed_at,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_entry_id;

  if p_status = 'served'
    and v_entry.appointment_id is not null
    and public._workflow_enabled(v_entry.branch_id, 'auto_served_completes_appointment') then
    update public.appointments
    set status = 'completed', updated_at = now()
    where id = v_entry.appointment_id
      and status in ('checked_in', 'scheduled', 'confirmed');
  end if;

  perform public.emit_workflow_event(
    v_entry.branch_id, 'queue.status_changed', 'queue_entry', p_entry_id::text,
    jsonb_build_object('status', p_status, 'appointment_id', v_entry.appointment_id)
  );

  return jsonb_build_object('id', p_entry_id, 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lab cases: RLS so inserts are visible immediately after create
-- ---------------------------------------------------------------------------
alter table public.lab_cases enable row level security;

drop policy if exists lab_cases_select on public.lab_cases;
create policy lab_cases_select on public.lab_cases
  for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists lab_cases_insert on public.lab_cases;
create policy lab_cases_insert on public.lab_cases
  for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists lab_cases_update on public.lab_cases;
create policy lab_cases_update on public.lab_cases
  for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());
