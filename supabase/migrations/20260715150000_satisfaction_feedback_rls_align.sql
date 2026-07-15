-- Align satisfaction read policy with existing report hub permissions (audit.read).

drop policy if exists patient_satisfaction_feedback_select on public.patient_satisfaction_feedback;
create policy patient_satisfaction_feedback_select on public.patient_satisfaction_feedback
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and (
      public.has_permission('audit.read', branch_id)
      or public.has_permission('billing.read', branch_id)
      or public.has_permission('compliance.read', branch_id)
    )
  );
