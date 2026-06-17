-- Allow an admin to undo an accidental same-day closeout finalization.
-- This only flips today's closeout snapshot back to draft; historical days stay locked.

create or replace function public.reopen_today_closeout_snapshot(
  p_branch_id uuid default null,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_id uuid;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  if p_date is distinct from v_today then
    raise exception 'Only today''s closeout can be reopened from the app.';
  end if;

  update public.closeout_snapshots cs
  set finalized = false,
      created_by = auth.uid(),
      created_at = now()
  where cs.organization_id = v_org
    and cs.snapshot_date = p_date
    and cs.branch_id is not distinct from p_branch_id
    and cs.finalized = true
  returning cs.id into v_id;

  if v_id is null then
    raise exception 'No finalized closeout snapshot found for today.';
  end if;

  return v_id;
end;
$$;

revoke all on function public.reopen_today_closeout_snapshot(uuid, date) from public;
grant execute on function public.reopen_today_closeout_snapshot(uuid, date) to authenticated;

create or replace function public.log_manual_whatsapp_notification(
  p_branch_id uuid,
  p_phone text,
  p_body text,
  p_template_key text default null,
  p_patient_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_log_id uuid;
begin
  if not public.has_permission('notifications.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.notification_logs (
    organization_id,
    branch_id,
    patient_id,
    template_key,
    recipient_phone,
    body_preview,
    status,
    provider_ref,
    created_by
  )
  values (
    v_org,
    p_branch_id,
    p_patient_id,
    p_template_key,
    p_phone,
    left(p_body, 500),
    'dry_run',
    'manual_whatsapp',
    auth.uid()
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.log_manual_whatsapp_notification(uuid, text, text, text, uuid) from public;
grant execute on function public.log_manual_whatsapp_notification(uuid, text, text, text, uuid) to authenticated;
