-- Module 21: HMO claims

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin') and p.name in ('hmo.read', 'hmo.write')
on conflict do nothing;

create table if not exists public.hmo_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hmo_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  provider_id uuid references public.hmo_providers(id) on delete set null,
  claim_number text,
  member_id text,
  claimed_amount numeric(12, 2) not null,
  approved_amount numeric(12, 2),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid')),
  rejection_reason text,
  payment_ref text,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hmo_claims_branch on public.hmo_claims(branch_id, status, created_at desc);

alter table public.hmo_providers enable row level security;
alter table public.hmo_claims enable row level security;

create policy hmo_providers_select on public.hmo_providers
  for select to authenticated using (organization_id = public.current_user_org_id());

create policy hmo_claims_select on public.hmo_claims
  for select to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_has_branch_access(branch_id)
    and public.has_permission('hmo.read', branch_id)
  );

create policy hmo_claims_write on public.hmo_claims
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.has_permission('hmo.write', branch_id)
  )
  with check (organization_id = public.current_user_org_id() and public.has_permission('hmo.write', branch_id));

create or replace function public.seed_hmo_providers(p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.hmo_providers where organization_id = p_org_id limit 1) then return; end if;
  insert into public.hmo_providers (organization_id, name, code) values
    (p_org_id, 'Maxicare', 'MAX'), (p_org_id, 'Intellicare', 'INT'), (p_org_id, 'Medicard', 'MED'), (p_org_id, 'Avega', 'AVG');
end; $$;

create or replace function public.submit_hmo_claim(p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  if v.status <> 'draft' then raise exception 'Only draft claims can be submitted'; end if;
  update public.hmo_claims set status = 'submitted', submitted_at = now(), updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'submitted');
end; $$;

create or replace function public.approve_hmo_claim(p_claim_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  update public.hmo_claims set status = 'approved', approved_amount = p_amount, updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'approved');
end; $$;

create or replace function public.reject_hmo_claim(p_claim_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  update public.hmo_claims set status = 'rejected', rejection_reason = p_reason, updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'rejected');
end; $$;

create or replace function public.mark_hmo_claim_paid(p_claim_id uuid, p_payment_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.hmo_claims%rowtype;
begin
  select * into v from public.hmo_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if not public.has_permission('hmo.write', v.branch_id) then raise exception 'Permission denied'; end if;
  if v.status <> 'approved' then raise exception 'Only approved claims can be marked paid'; end if;
  update public.hmo_claims set status = 'paid', payment_ref = p_payment_ref, paid_at = now(), updated_at = now() where id = p_claim_id;
  return jsonb_build_object('id', p_claim_id, 'status', 'paid');
end; $$;

grant execute on function public.seed_hmo_providers(uuid) to authenticated;
grant execute on function public.submit_hmo_claim(uuid) to authenticated;
grant execute on function public.approve_hmo_claim(uuid, numeric) to authenticated;
grant execute on function public.reject_hmo_claim(uuid, text) to authenticated;
grant execute on function public.mark_hmo_claim_paid(uuid, text) to authenticated;

do $$ declare v_org uuid; begin
  for v_org in select id from public.organizations loop perform public.seed_hmo_providers(v_org); end loop;
end; $$;
