# Production deploy checklist

## Environment variables

### Next.js (Vercel)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client anon key |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for payment redirects |

### Supabase Edge Functions

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `CRON_SECRET` | Protects cron edge functions (`daily-reminder-cron`, `appointment-reminders-cron`, `payment-reminder-cron`, `send-closeout-email-cron`, `process-slot-notifications`) |
| `SEMAPHORE_API_KEY` | Live SMS via Semaphore (omit = dry-run unless branch overrides) |
| `RESEND_API_KEY` | Live closeout digest emails (omit = dry-run queue) |
| `CLOSEOUT_EMAIL_FROM` | Sender for closeout emails (default `Dentali Closeout <closeout@dentali.ph>`) |
| `CLOSEOUT_EMAIL_DRY_RUN` | Set `true` to force dry-run even when Resend is configured |
| `PAYMONGO_SECRET_KEY` | Live PayMongo checkout sessions |
| `PAYMONGO_WEBHOOK_SECRET` | Optional webhook signature verification |
| `SITE_URL` | Payment success/cancel URLs |
| `PHILHEALTH_ECLAIMS_API_URL` | PhilHealth sync (omit = dry-run stub) |

## Database

0. Local preflight (optional): `powershell -ExecutionPolicy Bypass -File scripts/go-live-preflight.ps1` — runs `tsc`, regenerates the idempotent bundle, prints migration count.
1. Apply migrations: run `supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql` in the SQL editor, or `npm run db:push` from a linked CLI project.
2. Confirm RPCs exist: `get_owner_analytics`, `check_in_patient`, `complete_payment_intent_by_ref`, `bulk_add_chart_findings_to_plan`.

## Edge functions

Deploy all functions under `supabase/functions/`. Cron endpoints (JWT disabled, use `x-cron-secret`):

- `daily-reminder-cron` — tomorrow reminders
- `appointment-reminders-cron` — T-24h / T-2h / no-show
- `payment-reminder-cron` — overdue invoice SMS
- `send-closeout-email-cron` — daily closeout digest email queue
- `process-slot-notifications` — waitlist slot queue
- `paymongo-webhook` — payment completion

## Scheduled jobs

Configure Supabase cron or external scheduler (e.g. Vercel Cron) to POST:

```http
POST https://<project>.supabase.co/functions/v1/appointment-reminders-cron
x-cron-secret: <CRON_SECRET>
```

Suggested schedule — full setup guide: [SUPABASE_CRON_SETUP.md](./SUPABASE_CRON_SETUP.md).

| Job | Interval |
|-----|----------|
| `appointment-reminders-cron` | Every 15 minutes |
| `daily-reminder-cron` | Daily 18:00 Asia/Manila |
| `payment-reminder-cron` | Daily 10:00 Asia/Manila |
| `send-closeout-email-cron` | Daily 20:00 Asia/Manila |
| `process-slot-notifications` | Every 5 minutes |

## PayMongo

1. Create webhook pointing to `/functions/v1/paymongo-webhook` for `checkout_session.payment.paid`.
2. Store checkout session id as `external_ref` on `payment_gateway_intents` (already done by `create-payment-intent`).

## Go-live verification

- [ ] Branch workflow toggles configured under Settings → Workflow
- [ ] Notification templates reviewed; dry-run disabled per branch when SMS is live
- [ ] Owner dashboard shows attention items and charts
- [ ] Closeout snapshot saves without error
- [ ] Test check-in → queue → served → invoice automation chain

Detailed steps: [GO_LIVE_SMOKE.md](./GO_LIVE_SMOKE.md). RPC check: `scripts/verify-go-live-rpcs.sql`.

**VA-F6 (canlı secret'lar):** Adım adım kullanıcı rehberi → [VA-F6_USER_STEPS.md](./VA-F6_USER_STEPS.md).
