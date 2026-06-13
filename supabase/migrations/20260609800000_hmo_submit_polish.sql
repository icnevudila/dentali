-- Module 21: HMO claim submit polish (validation, provider ref, retry)

alter table public.hmo_claims
  add column if not exists provider_ref text;

create or replace function public.submit_hmo_claim(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.hmo_claims%rowtype;
  v_ref text;
begin
  select * into v from public.hmo_claims where id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  if not public.has_permission('hmo.write', v.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v.status <> 'draft' then
    raise exception 'Only draft claims can be submitted';
  end if;

  if nullif(trim(v.member_id), '') is null then
    raise exception 'Member ID is required before submit';
  end if;

  if v.claimed_amount is null or v.claimed_amount <= 0 then
    raise exception 'Claimed amount must be greater than zero';
  end if;

  v_ref := 'HMO-SUB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  update public.hmo_claims
  set status = 'submitted',
      submitted_at = now(),
      provider_ref = v_ref,
      updated_at = now()
  where id = p_claim_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v.organization_id, v.branch_id, auth.uid(), 'hmo_claim.submitted',
    'hmo_claim', p_claim_id::text,
    jsonb_build_object(
      'claim_number', v.claim_number,
      'provider_ref', v_ref,
      'claimed_amount', v.claimed_amount,
      'member_id', v.member_id
    )
  );

  return jsonb_build_object('id', p_claim_id, 'status', 'submitted', 'provider_ref', v_ref);
end;
$$;

create or replace function public.reset_hmo_claim_to_draft(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;

  if not found then
    raise exception 'Claim not found';
  end if;

  if not public.has_permission('hmo.write', v.branch_id) then
    raise exception 'Permission denied';
  end if;

  if v.status <> 'rejected' then
    raise exception 'Only rejected claims can be reset to draft';
  end if;

  update public.hmo_claims
  set status = 'draft',
      rejection_reason = null,
      provider_ref = null,
      submitted_at = null,
      updated_at = now()
  where id = p_claim_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v.organization_id, v.branch_id, auth.uid(), 'hmo_claim.reset_to_draft',
    'hmo_claim', p_claim_id::text,
    jsonb_build_object('claim_number', v.claim_number)
  );
end;
$$;

grant execute on function public.reset_hmo_claim_to_draft(uuid) to authenticated;
