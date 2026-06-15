-- Hotfix: run if 20260615160000 failed at premature GRANT (backfill function missing)
-- Safe to re-run: uses CREATE OR REPLACE and idempotent grants.

drop function if exists public.check_in_appointment(uuid);

create or replace function public.backfill_patient_plan_invoices(
  p_patient_id uuid default null,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_created int := 0;
  v_invoice_id uuid;
begin
  if p_branch_id is not null and not public.has_permission('billing.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  for v_plan in
    select tp.id, tp.branch_id
    from public.treatment_plans tp
    where tp.organization_id = public.current_user_org_id()
      and (p_patient_id is null or tp.patient_id = p_patient_id)
      and (p_branch_id is null or tp.branch_id = p_branch_id)
      and tp.status in ('approved', 'in_progress')
      and exists (
        select 1 from public.treatment_plan_items i
        where i.plan_id = tp.id and i.status <> 'cancelled'
      )
      and not exists (
        select 1 from public.invoices inv
        where inv.treatment_plan_id = tp.id and inv.status <> 'void'
      )
  loop
    if public.has_permission('billing.write', v_plan.branch_id) then
      v_invoice_id := public._create_invoice_draft_from_plan(v_plan.id);
      if v_invoice_id is not null then
        v_created := v_created + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('created', v_created);
end;
$$;

grant execute on function public.unapprove_treatment_plan(uuid) to authenticated;
grant execute on function public.backfill_patient_plan_invoices(uuid, uuid) to authenticated;
grant execute on function public.check_in_appointment(uuid, boolean) to authenticated;
