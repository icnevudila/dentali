-- Allow staff to revert a signed prescription back to draft for editing (mirrors treatment plan unapprove).

create or replace function public.unsign_prescription(p_prescription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rx public.prescriptions%rowtype;
begin
  select * into v_rx from public.prescriptions where id = p_prescription_id for update;
  if not found then raise exception 'Prescription not found'; end if;
  if v_rx.status <> 'signed' then raise exception 'Only signed prescriptions can be unsigned'; end if;
  if not public.has_permission('prescriptions.write', v_rx.branch_id) then
    raise exception 'Permission denied';
  end if;

  update public.prescriptions
  set status = 'draft',
      signed_at = null,
      updated_at = now()
  where id = p_prescription_id;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_rx.organization_id, v_rx.branch_id, auth.uid(),
    'prescription.unsign', 'prescription', p_prescription_id::text,
    jsonb_build_object('patient_id', v_rx.patient_id)
  );

  return jsonb_build_object('id', p_prescription_id, 'status', 'draft');
end;
$$;

grant execute on function public.unsign_prescription(uuid) to authenticated;
