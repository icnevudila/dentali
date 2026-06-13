-- Module 22: PhilHealth eClaims readiness stub

create table if not exists public.philhealth_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  philhealth_id text,
  case_rate_code text,
  status text not null default 'draft'
    check (status in ('draft', 'checklist_incomplete', 'ready', 'submitted', 'sync_failed', 'acknowledged')),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.philhealth_sync_logs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.philhealth_claims(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('pending', 'success', 'failed')),
  response_summary text,
  created_at timestamptz not null default now()
);

alter table public.philhealth_claims enable row level security;
alter table public.philhealth_sync_logs enable row level security;

create policy philhealth_claims_all on public.philhealth_claims
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('billing.read', branch_id)
  )
  with check (organization_id = public.current_user_org_id());

create policy philhealth_sync_select on public.philhealth_sync_logs
  for select to authenticated using (organization_id = public.current_user_org_id());

create policy philhealth_sync_insert on public.philhealth_sync_logs
  for insert to authenticated with check (organization_id = public.current_user_org_id());

create or replace function public.queue_philhealth_sync(p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.philhealth_claims%rowtype;
declare v_log_id uuid;
begin
  select * into v from public.philhealth_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if v.status <> 'ready' then raise exception 'Claim must pass readiness checklist first'; end if;

  insert into public.philhealth_sync_logs (claim_id, organization_id, status, response_summary)
  values (p_claim_id, v.organization_id, 'pending', 'Queued for eClaims sync (stub — no live API yet)')
  returning id into v_log_id;

  update public.philhealth_claims set status = 'submitted', updated_at = now() where id = p_claim_id;

  return jsonb_build_object('sync_log_id', v_log_id, 'status', 'submitted');
end; $$;

grant execute on function public.queue_philhealth_sync(uuid) to authenticated;
