-- Lab lifecycle statuses + provider time blocks + portal pay (applied via MCP; keep for local)

create or replace function public.update_lab_case_status_guarded(p_case_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.lab_cases%rowtype;
begin
  if p_status not in ('pending', 'sent', 'try_in', 'remake', 'received', 'completed', 'cancelled') then
    raise exception 'Invalid lab status';
  end if;
  select * into v_case from public.lab_cases where id = p_case_id for update;
  if not found then raise exception 'Lab case not found'; end if;
  if not public.has_permission('dental_chart.write', v_case.branch_id) then raise exception 'Permission denied'; end if;

  update public.lab_cases
  set status = p_status,
      received_date = case
        when p_status in ('received', 'completed') then coalesce(received_date, current_date)
        else received_date
      end,
      updated_at = now()
  where id = p_case_id;

  insert into public.organization_audit_logs
    (organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata)
  values (v_case.organization_id, v_case.branch_id, auth.uid(), 'lab_case.status', 'lab_case', p_case_id::text,
    jsonb_build_object('from', v_case.status, 'to', p_status));

  return jsonb_build_object('id', p_case_id, 'status', p_status);
end;
$$;

create table if not exists public.provider_time_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint provider_time_blocks_range check (ends_at > starts_at)
);

create index if not exists provider_time_blocks_provider_range_idx
  on public.provider_time_blocks (provider_id, starts_at, ends_at);

create index if not exists provider_time_blocks_branch_idx
  on public.provider_time_blocks (branch_id, starts_at);

alter table public.provider_time_blocks enable row level security;
