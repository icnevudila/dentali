-- Fix: invoice encounter_id backfill blocked by check_closeout_lock on closed days.
-- Safe to run if 20260616200000 failed at the invoice UPDATE step.

do $encounter_invoice_backfill$
begin
  perform set_config('app.bypass_closeout_lock', 'true', true);

  update public.invoices inv
  set encounter_id = pe.id
  from public.patient_encounters pe
  where inv.encounter_id is null
    and inv.patient_id = pe.patient_id
    and inv.branch_id = pe.branch_id
    and inv.created_at >= pe.opened_at - interval '2 hours'
    and inv.created_at <= coalesce(pe.closed_at, pe.opened_at) + interval '48 hours';
end;
$encounter_invoice_backfill$;

grant execute on function public.close_patient_encounter(uuid) to authenticated;
grant execute on function public.get_patient_encounters(uuid, uuid, int) to authenticated;
grant execute on function public.get_patient_encounter_detail(uuid) to authenticated;
grant execute on function public.get_active_patient_encounter(uuid, uuid) to authenticated;
