# VA-F6 — Canlı entegrasyon (kullanıcı adımları)

Kod hazır. Bu faz **secret ve dashboard erişimi** gerektirir — agent oturumu bunları uygulayamaz.

## Ön koşul

1. `powershell -ExecutionPolicy Bypass -File scripts/go-live-preflight.ps1` — yerelde `tsc` + migration bundle OK
2. **SQL runbook:** [`docs/SQL_RUNBOOK_TR.md`](./SQL_RUNBOOK_TR.md) — ADIM 1→3 (`_APPLY_ALL_IDEMPOTENT.sql` 88 migration)
3. `scripts/runbook/02-verify-complete.sql` — `overall = PASS`

## VA-F6-01 — Semaphore SMS

Supabase → Edge Functions → Secrets:

| Secret | Değer |
|--------|--------|
| `SEMAPHORE_API_KEY` | Semaphore dashboard API key |

Branch: Settings → Notifications → dry-run kapat (canlı SMS).

Doğrulama: `appointment-reminders-cron` curl (bkz. [GO_LIVE_SMOKE.md](./GO_LIVE_SMOKE.md)) → gerçek SMS.

## VA-F6-02 — PayMongo

Supabase secrets:

| Secret | Değer |
|--------|--------|
| `PAYMONGO_SECRET_KEY` | PayMongo live secret |
| `PAYMONGO_WEBHOOK_SECRET` | Webhook imza (önerilir) |
| `SITE_URL` | `https://ph-dental-app.vercel.app` (veya prod URL) |

PayMongo dashboard → Webhook URL:  
`https://<PROJECT_REF>.supabase.co/functions/v1/paymongo-webhook`  
Event: `checkout_session.payment.paid`

## VA-F6-03 — PhilHealth

| Secret | Değer |
|--------|--------|
| `PHILHEALTH_ECLAIMS_API_URL` | Provider endpoint |
| `PHILHEALTH_API_KEY` | API key |

Doğrulama: Billing → PhilHealth → claim submit (stub değil, provider yanıtı).

## VA-F6-04 — Vercel + cron

**Vercel** (Dashboard → Project → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

**Supabase** Edge secrets:

- `CRON_SECRET` — güçlü rastgele string

**Cron zamanlama:** [SUPABASE_CRON_SETUP.md](./SUPABASE_CRON_SETUP.md) — pg_cron veya harici scheduler.

**Deploy:** `git push` → Vercel otomatik build; Edge functions: `supabase functions deploy` (tüm `supabase/functions/*`).

## VA-F6-02 (cron) + VA-F6-03 (smoke)

1. Cron job'ları Supabase Dashboard'dan kur ([SUPABASE_CRON_SETUP.md](./SUPABASE_CRON_SETUP.md))
2. [GO_LIVE_SMOKE.md](./GO_LIVE_SMOKE.md) — staging sonra production

## Bitti sayılır

- [ ] Tüm secret'lar set
- [ ] Cron 200 JSON (dry_run veya canlı)
- [ ] GO_LIVE_SMOKE manuel + e2e geçti
- [ ] PayMongo test ödeme → invoice paid
- [ ] SMS + closeout email inbox'a düştü
