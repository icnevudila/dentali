-- Payment reminder cron RPCs were callable by anon via PUBLIC default grants.
-- Edge cron uses service_role only (payment-reminder-cron).

revoke all on function public.enqueue_payment_reminders(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_payment_reminders(uuid) to service_role;

revoke all on function public.claim_payment_reminder_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_payment_reminder_batch(integer) to service_role;

revoke all on function public.mark_payment_reminder_processed(uuid) from public, anon, authenticated;
grant execute on function public.mark_payment_reminder_processed(uuid) to service_role;

comment on function public.enqueue_payment_reminders(uuid) is
  'Cron enqueue for payment reminders. EXECUTE: service_role only.';
comment on function public.claim_payment_reminder_batch(integer) is
  'Cron claim batch for payment reminders. EXECUTE: service_role only.';
comment on function public.mark_payment_reminder_processed(uuid) is
  'Cron mark reminder processed. EXECUTE: service_role only.';
