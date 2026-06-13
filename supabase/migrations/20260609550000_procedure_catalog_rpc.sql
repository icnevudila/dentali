-- Module 19: Procedure categories + catalog RPC stubs

create table if not exists public.procedure_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (organization_id, slug)
);

create index if not exists idx_procedure_categories_org on public.procedure_categories(organization_id);

alter table public.procedure_categories enable row level security;

create policy procedure_categories_org on public.procedure_categories for all using (
  organization_id = public.current_user_org_id()
);

-- Branch overrides (MVP name: procedure_prices in module docs)
create or replace view public.procedure_prices as
select
  id,
  organization_id,
  branch_id,
  procedure_id,
  price_override as price,
  updated_by,
  updated_at
from public.branch_procedure_prices;

create or replace function public.ensure_procedure_categories(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.procedure_categories (organization_id, slug, name, sort_order) values
    (p_org_id, 'preventive', 'Preventive', 1),
    (p_org_id, 'restorative', 'Restorative', 2),
    (p_org_id, 'surgery', 'Surgery', 3),
    (p_org_id, 'ortho', 'Orthodontics', 4),
    (p_org_id, 'general', 'General', 99)
  on conflict (organization_id, slug) do nothing;
end;
$$;

create or replace function public.get_effective_procedure_price(
  p_procedure_id uuid,
  p_branch_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.get_procedure_effective_price(p_procedure_id, p_branch_id);
$$;

create or replace function public.get_procedure_catalog(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_categories jsonb;
  v_procedures jsonb;
begin
  select b.organization_id into v_org_id
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  if not public.has_permission('settings.manage', p_branch_id)
    and not public.has_permission('billing.read', p_branch_id)
    and not public.has_permission('appointments.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  perform public.ensure_procedure_categories(v_org_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pc.id,
      'slug', pc.slug,
      'name', pc.name,
      'sort_order', pc.sort_order
    ) order by pc.sort_order, pc.name
  ), '[]'::jsonb)
  into v_categories
  from public.procedure_categories pc
  where pc.organization_id = v_org_id
    and pc.is_active;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'name', p.name,
      'category', p.category,
      'base_price', p.base_price,
      'effective_price', public.get_effective_procedure_price(p.id, p_branch_id),
      'branch_override', (
        select bpp.price_override
        from public.branch_procedure_prices bpp
        where bpp.procedure_id = p.id
          and bpp.branch_id = p_branch_id
        limit 1
      ),
      'tooth_required', p.tooth_required,
      'is_active', p.is_active
    ) order by p.name
  ), '[]'::jsonb)
  into v_procedures
  from public.procedures p
  where p.organization_id = v_org_id
    and p.is_active;

  return jsonb_build_object(
    'branch_id', p_branch_id,
    'categories', v_categories,
    'procedures', v_procedures
  );
end;
$$;

grant execute on function public.ensure_procedure_categories(uuid) to authenticated;
grant execute on function public.get_effective_procedure_price(uuid, uuid) to authenticated;
grant execute on function public.get_procedure_catalog(uuid) to authenticated;
