-- Branch-level procedure price overrides

create table if not exists public.branch_procedure_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  price_override numeric(12,2) not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now(),
  unique (branch_id, procedure_id)
);

create index if not exists idx_branch_procedure_prices_branch on public.branch_procedure_prices(branch_id);

alter table public.branch_procedure_prices enable row level security;

create policy branch_procedure_prices_org on public.branch_procedure_prices for all using (
  organization_id = public.current_user_org_id()
);

-- Effective price for a procedure at a branch (override or base)
create or replace function public.get_procedure_effective_price(
  p_procedure_id uuid,
  p_branch_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select bpp.price_override
      from public.branch_procedure_prices bpp
      where bpp.procedure_id = p_procedure_id
        and bpp.branch_id = p_branch_id
        and bpp.organization_id = public.current_user_org_id()
    ),
    (
      select p.base_price
      from public.procedures p
      where p.id = p_procedure_id
        and p.organization_id = public.current_user_org_id()
    )
  );
$$;
