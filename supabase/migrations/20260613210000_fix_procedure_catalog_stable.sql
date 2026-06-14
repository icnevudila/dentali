-- Redefine get_procedure_catalog as volatile (removing stable classification) so it can safely execute INSERT
create or replace function public.get_procedure_catalog(p_branch_id uuid)
returns jsonb
language plpgsql
volatile
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