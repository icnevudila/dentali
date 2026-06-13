-- Module 23: Low-stock alert query

create or replace function public.get_inventory_low_stock_alerts(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'sku', i.sku,
        'quantity_on_hand', i.quantity_on_hand,
        'min_stock_level', i.min_stock_level,
        'unit', i.unit,
        'expiry_date', i.expiry_date,
        'alert_type',
          case
            when i.expiry_date is not null and i.expiry_date < current_date then 'expired'
            when i.quantity_on_hand <= 0 then 'critical'
            when i.quantity_on_hand <= i.min_stock_level then 'low'
            else 'ok'
          end
      )
      order by
        case
          when i.expiry_date is not null and i.expiry_date < current_date then 0
          when i.quantity_on_hand <= 0 then 1
          when i.quantity_on_hand <= i.min_stock_level then 2
          else 3
        end,
        i.name
    ),
    '[]'::jsonb
  )
  from public.inventory_items i
  where i.branch_id = p_branch_id
    and i.organization_id = public.current_user_org_id()
    and i.is_active = true
    and (
      i.quantity_on_hand <= i.min_stock_level
      or (i.expiry_date is not null and i.expiry_date < current_date)
    );
$$;

grant execute on function public.get_inventory_low_stock_alerts(uuid) to authenticated;
