-- Module 19: Bulk procedure upsert stub

create or replace function public.bulk_upsert_procedures(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_item jsonb;
  v_inserted int := 0;
  v_updated int := 0;
  v_code text;
begin
  if v_org_id is null or v_org_id <> public.current_user_org_id() then
    raise exception 'Organization mismatch';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'procedures', '[]'::jsonb))
  loop
    v_code := nullif(trim(v_item->>'code'), '');

    if v_code is not null and exists (
      select 1 from public.procedures p
      where p.organization_id = v_org_id and p.code = v_code
    ) then
      update public.procedures set
        name = coalesce(nullif(trim(v_item->>'name'), ''), name),
        category = coalesce(nullif(trim(v_item->>'category'), ''), category),
        base_price = coalesce((v_item->>'base_price')::numeric, base_price),
        is_active = coalesce((v_item->>'is_active')::boolean, is_active)
      where organization_id = v_org_id and code = v_code;
      v_updated := v_updated + 1;
    else
      insert into public.procedures (
        organization_id, code, name, category, base_price, tooth_required, is_active
      ) values (
        v_org_id,
        v_code,
        coalesce(nullif(trim(v_item->>'name'), ''), 'Unnamed procedure'),
        coalesce(nullif(trim(v_item->>'category'), ''), 'general'),
        coalesce((v_item->>'base_price')::numeric, 0),
        coalesce((v_item->>'tooth_required')::boolean, false),
        coalesce((v_item->>'is_active')::boolean, true)
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  perform public.ensure_procedure_categories(v_org_id);

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'total', v_inserted + v_updated
  );
end;
$$;

grant execute on function public.bulk_upsert_procedures(jsonb) to authenticated;
