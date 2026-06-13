# Go-live smoke test

Manual verification after applying `_APPLY_ALL_IDEMPOTENT.sql` and deploying Edge Functions. Run in staging first.

**SQL sırası:** [`docs/SQL_RUNBOOK_TR.md`](./SQL_RUNBOOK_TR.md)

## 1. Database RPC sanity

In Supabase SQL Editor, run `scripts/runbook/02-verify-complete.sql` or `scripts/verify-go-live-rpcs.sql`. All rows should show `exists` / `overall = PASS`.

## 2. Cron endpoints (dry-run OK without SMS/Resend)

Replace `<PROJECT_REF>` and `<CRON_SECRET>`:

```bash
curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/appointment-reminders-cron" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json"

curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/payment-reminder-cron" \
  -H "x-cron-secret: <CRON_SECRET>"

curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/recall-reminder-cron" \
  -H "x-cron-secret: <CRON_SECRET>"

curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/owner-digest-sms-cron" \
  -H "x-cron-secret: <CRON_SECRET>"

curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/send-closeout-email-cron" \
  -H "x-cron-secret: <CRON_SECRET>"

curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/process-slot-notifications" \
  -H "x-cron-secret: <CRON_SECRET>"
```

Expected: HTTP 200 with JSON (`dry_run` counts when provider keys are missing).

## 3. App smoke (Playwright)

```bash
npm run test:e2e -- e2e/public.smoke.spec.ts
npm run test:e2e -- e2e/chart.smoke.spec.ts
npm run test:e2e -- e2e/automation-chain.spec.ts
```

With credentials:

```bash
# .env.local or CI secrets
E2E_TEST_EMAIL=...
E2E_TEST_PASSWORD=...
npm run test:e2e -- e2e/smoke.spec.ts
```

## 4. Clinical automation chain (manual)

1. Settings → Workflow — enable check-in + served + plan→invoice toggles
2. Create appointment → check-in from queue → mark served
3. Confirm appointment status `completed`
4. Approve treatment plan → invoice draft appears under Billing
5. Record payment → balance updates

## 5. Owner analytics & digest SMS

1. Reports Hub — branch benchmark + finance summary panels load
2. Daily Closeout — save snapshot without error
3. Settings → Staff — owner/admin **mobile phone** filled (`+639…`)
4. Settings → Workflow — enable **Owner daily digest SMS** (warning banner clears when phone set)
5. Export CSV from Reports Hub

## 6. Patient intake + insurance

1. `/patients/new` — step through Insurance (optional) → Register
2. Patient profile shows coverage if HMO/PhilHealth selected

## 7. Live integrations (production only)

| Integration | Verify |
|-------------|--------|
| Semaphore SMS | Branch notification dry-run off; reminder cron sends real SMS |
| PayMongo | Test checkout → webhook marks intent paid |
| Resend | Closeout email cron delivers to owner inbox |
| PhilHealth | Claim submit returns provider response (not stub) |

See also [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) and [VA-F6_USER_STEPS.md](./VA-F6_USER_STEPS.md).
