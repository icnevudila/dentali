# Supabase cron setup

Configure scheduled HTTP calls to Edge Functions using [Supabase Cron](https://supabase.com/docs/guides/functions/schedule-functions) or an external scheduler (Vercel Cron, GitHub Actions).

All cron endpoints require header:

```http
x-cron-secret: <CRON_SECRET>
```

Set `CRON_SECRET` in Supabase Edge Function secrets (Dashboard → Project Settings → Edge Functions → Secrets).

## Recommended schedule (Asia/Manila)

| Function | Cron (UTC) | Local (PHT) | Notes |
|----------|------------|-------------|--------|
| `process-slot-notifications` | `*/5 * * * *` | every 5 min | Waitlist slot queue |
| `appointment-reminders-cron` | `*/15 * * * *` | every 15 min | T-24h / T-2h / no-show |
| `daily-reminder-cron` | `0 10 * * *` | 18:00 | Tomorrow reminders |
| `payment-reminder-cron` | `0 2 * * *` | 10:00 | Overdue invoice SMS |
| `send-closeout-email-cron` | `0 12 * * *` | 20:00 | Owner closeout digest (email) |
| `recall-reminder-cron` | `0 3 * * *` | 11:00 | 6-month hygiene recall SMS |
| `owner-digest-sms-cron` | `30 12 * * *` | 20:30 | Owner closeout digest (SMS) |

## Example: Supabase SQL cron (pg_cron + pg_net)

Replace placeholders before running in SQL Editor:

```sql
-- Requires extensions: pg_cron, pg_net (enable in Dashboard → Database → Extensions)

select cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/appointment-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Repeat for each function URL. Unschedule with `select cron.unschedule('appointment-reminders');`.

**Ready-to-paste bundle:** `scripts/cron-schedule-template.sql` schedules all seven jobs with `dentali-*` names.

## External scheduler (curl)

See [GO_LIVE_SMOKE.md](./GO_LIVE_SMOKE.md) for curl examples.

## Verification

1. Invoke each endpoint manually once — expect HTTP 200 JSON.
2. Check Edge Function logs for errors.
3. With SMS/Resend keys unset, responses should indicate `dry_run` mode.
