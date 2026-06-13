-- Module 13: Provider availability stub

create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  slot_minutes integer not null default 30 check (slot_minutes > 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, provider_id, day_of_week)
);

create index if not exists idx_provider_availability_branch
  on public.provider_availability(branch_id, provider_id);

alter table public.provider_availability enable row level security;

create policy provider_availability_select on public.provider_availability
  for select to authenticated using (
    organization_id = public.current_user_org_id()
  );

create policy provider_availability_write on public.provider_availability
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.write', branch_id)
  ) with check (
    organization_id = public.current_user_org_id()
    and public.has_permission('appointments.write', branch_id)
  );

create or replace function public.ensure_provider_availability_defaults(
  p_branch_id uuid,
  p_provider_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_hour record;
begin
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  perform public.ensure_branch_clinic_hours(p_branch_id);

  for v_hour in
    select ch.day_of_week, ch.open_time, ch.close_time, ch.is_closed
    from public.clinic_hours ch
    where ch.branch_id = p_branch_id
  loop
    insert into public.provider_availability (
      organization_id, branch_id, provider_id, day_of_week,
      start_time, end_time, slot_minutes, is_available
    ) values (
      v_org_id, p_branch_id, p_provider_id, v_hour.day_of_week,
      coalesce(v_hour.open_time, '09:00'::time),
      coalesce(v_hour.close_time, '17:00'::time),
      30,
      not coalesce(v_hour.is_closed, false)
    )
    on conflict (branch_id, provider_id, day_of_week) do nothing;
  end loop;
end;
$$;

create or replace function public.get_branch_provider_availability(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'provider_id', pa.provider_id,
      'provider_name', coalesce(p.full_name, p.email, 'Provider'),
      'day_of_week', pa.day_of_week,
      'start_time', to_char(pa.start_time, 'HH24:MI'),
      'end_time', to_char(pa.end_time, 'HH24:MI'),
      'slot_minutes', pa.slot_minutes,
      'is_available', pa.is_available
    ) order by pa.provider_id, pa.day_of_week
  ), '[]'::jsonb)
  into v_result
  from public.provider_availability pa
  join public.profiles p on p.id = pa.provider_id
  where pa.branch_id = p_branch_id
    and pa.organization_id = public.current_user_org_id();

  return jsonb_build_object('branch_id', p_branch_id, 'rows', v_result);
end;
$$;

create or replace function public.get_available_appointment_slots(
  p_branch_id uuid,
  p_provider_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dow smallint;
  v_avail record;
  v_slots jsonb := '[]'::jsonb;
  v_cursor time;
  v_end time;
  v_slot interval;
  v_ts timestamptz;
  v_taken boolean;
begin
  if not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public.ensure_provider_availability_defaults(p_branch_id, p_provider_id);

  v_dow := extract(dow from p_date)::smallint;

  select pa.start_time, pa.end_time, pa.slot_minutes, pa.is_available
  into v_avail
  from public.provider_availability pa
  where pa.branch_id = p_branch_id
    and pa.provider_id = p_provider_id
    and pa.day_of_week = v_dow
    and pa.organization_id = public.current_user_org_id();

  if v_avail is null or not v_avail.is_available then
    return jsonb_build_object('date', p_date, 'slots', v_slots);
  end if;

  v_cursor := v_avail.start_time;
  v_end := v_avail.end_time;
  v_slot := make_interval(mins => v_avail.slot_minutes);

  while v_cursor < v_end loop
    v_ts := (p_date + v_cursor) at time zone 'Asia/Manila';
    select exists (
      select 1 from public.appointments a
      where a.branch_id = p_branch_id
        and coalesce(a.provider_id, p_provider_id) = p_provider_id
        and a.scheduled_at = v_ts
        and a.status not in ('cancelled', 'no_show')
    ) into v_taken;

    v_slots := v_slots || jsonb_build_array(jsonb_build_object(
      'time', to_char(v_cursor, 'HH24:MI'),
      'available', not v_taken
    ));

    v_cursor := v_cursor + v_slot;
  end loop;

  return jsonb_build_object(
    'date', p_date,
    'provider_id', p_provider_id,
    'slots', v_slots
  );
end;
$$;

grant execute on function public.ensure_provider_availability_defaults(uuid, uuid) to authenticated;
grant execute on function public.get_branch_provider_availability(uuid) to authenticated;
grant execute on function public.get_available_appointment_slots(uuid, uuid, date) to authenticated;
