-- Auto no-show is disabled by product decision.
-- Staff must mark no-show manually from the appointment/queue workflow.

update public.appointments a
set status = 'scheduled',
    updated_at = now()
where a.status = 'no_show'
  and a.scheduled_at >= now() - interval '12 hours'
  and not exists (
    select 1
    from public.queue_entries qe
    where qe.appointment_id = a.id
      and qe.status <> 'cancelled'
  );

create or replace function public.auto_no_show_for_branch(
  p_branch_id uuid,
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_branch_id is null then
    raise exception 'branch_id is required';
  end if;

  if not public._user_can_check_in(p_branch_id) then
    raise exception 'Permission denied';
  end if;

  return jsonb_build_object(
    'marked', 0,
    'skipped', 0,
    'grace_minutes', p_grace_minutes,
    'disabled', true,
    'reason', 'No-show is manual only'
  );
end;
$$;

create or replace function public.auto_mark_overdue_appointments_no_show(
  p_grace_minutes int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'marked', 0,
    'skipped', 0,
    'grace_minutes', p_grace_minutes,
    'disabled', true,
    'reason', 'No-show is manual only'
  );
end;
$$;

grant execute on function public.auto_no_show_for_branch(uuid, int) to authenticated;
grant execute on function public.auto_mark_overdue_appointments_no_show(int) to service_role;
