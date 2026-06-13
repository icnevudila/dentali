-- Module 22: PhilHealth eClaims submit polish (provider ref, retry)

alter table public.philhealth_claims
  add column if not exists provider_ref text,
  add column if not exists submitted_at timestamptz;

alter table public.philhealth_sync_logs
  add column if not exists mode text check (mode is null or mode in ('dry_run', 'live'));

create or replace function public.reset_philhealth_claim_for_retry(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.philhealth_claims%rowtype;
begin
  select * into v from public.philhealth_claims where id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  if v.organization_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.has_permission('billing.write', v.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v.status <> 'sync_failed' then
    raise exception 'Only sync_failed claims can be reset for retry';
  end if;

  update public.philhealth_claims
  set status = 'ready', updated_at = now()
  where id = p_claim_id;
end;
$$;

grant execute on function public.reset_philhealth_claim_for_retry(uuid) to authenticated;
