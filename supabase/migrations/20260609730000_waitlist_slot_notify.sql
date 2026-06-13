-- Module 14: Auto-notify waitlist when appointment slot opens

alter table public.waitlist_entries
  add column if not exists slot_alert_sent_at timestamptz;

create or replace function public.get_waitlist_notify_candidates(
  p_branch_id uuid,
  p_slot_at timestamptz,
  p_limit int default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slot_date date := (p_slot_at at time zone 'Asia/Manila')::date;
  v_slot_time time := (p_slot_at at time zone 'Asia/Manila')::time;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'entry_id', w.id,
        'patient_id', w.patient_id,
        'patient_name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
        'patient_phone', p.phone,
        'urgency', w.urgency,
        'status', w.status
      )
      order by
        case w.urgency when 'high' then 0 when 'urgent' then 1 else 2 end,
        w.created_at
    )
    from public.waitlist_entries w
    join public.patients p on p.id = w.patient_id
    where w.branch_id = p_branch_id
      and w.organization_id = public.current_user_org_id()
      and w.status = 'waiting'
      and (w.expires_at is null or w.expires_at > now())
      and (w.slot_alert_sent_at is null or w.slot_alert_sent_at < now() - interval '12 hours')
      and (w.preferred_date is null or w.preferred_date = v_slot_date)
      and (
        w.preferred_time_start is null
        or (
          v_slot_time >= w.preferred_time_start
          and (w.preferred_time_end is null or v_slot_time <= w.preferred_time_end)
        )
      )
    limit greatest(coalesce(p_limit, 3), 1)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.record_waitlist_slot_notify(
  p_entry_id uuid,
  p_slot_at timestamptz,
  p_notification_log_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_note text;
begin
  select * into v_entry
  from public.waitlist_entries
  where id = p_entry_id
    and organization_id = public.current_user_org_id()
  for update;

  if not found then
    raise exception 'Waitlist entry not found';
  end if;

  if not public.has_permission('appointments.write', v_entry.branch_id) then
    raise exception 'Permission denied';
  end if;

  v_note := 'Auto SMS: slot opened ' || to_char(p_slot_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI');

  insert into public.waitlist_contact_attempts (
    waitlist_entry_id, organization_id, branch_id, note, outcome, created_by
  ) values (
    p_entry_id, v_entry.organization_id, v_entry.branch_id,
    v_note || coalesce(' (log ' || p_notification_log_id::text || ')', ''),
    'reached', auth.uid()
  );

  update public.waitlist_entries
  set
    status = case when status = 'waiting' then 'contacted' else status end,
    slot_alert_sent_at = now(),
    updated_at = now()
  where id = p_entry_id;
end;
$$;

grant execute on function public.get_waitlist_notify_candidates(uuid, timestamptz, int) to authenticated;
grant execute on function public.record_waitlist_slot_notify(uuid, timestamptz, uuid) to authenticated;

update public.notification_templates
set body = 'Hi {{patient_name}}, a slot opened at {{clinic_name}} on {{slot_date}} at {{slot_time}}. Please call us to confirm your appointment.'
where template_key = 'waitlist_slot';
