# Canlıya al — tek sayfa (dönüş checklist)

> Koşudan döndüğünde: **① key’leri yapıştır → ② SQL zaten PASS ise atla → ③ git push otomatik Vercel → ④ 5 dk smoke**

---

## ① Vercel (Production environment)

Project: **ph-dental-app** · Region: **sin1**

| Key | Nereden alınır |
|-----|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `NEXT_PUBLIC_SITE_URL` | `https://ph-dental-app.vercel.app` (veya custom domain) |

Deploy: `main` branch push → Vercel otomatik build.

---

## ② Supabase Edge secrets (Dashboard → Edge Functions → Secrets)

**Minimum (cron + uygulama):**

| Secret | Değer |
|--------|--------|
| `CRON_SECRET` | Güçlü rastgele string (cron curl header) |
| `SITE_URL` | Aynı production URL |

**Canlı entegrasyon (isteğe bağlı — yoksa dry-run çalışır):**

| Secret | Servis |
|--------|--------|
| `SEMAPHORE_API_KEY` | SMS hatırlatmalar |
| `RESEND_API_KEY` | Gün sonu e-posta |
| `CLOSEOUT_EMAIL_FROM` | `Dentali Closeout <closeout@dentali.ph>` |
| `PAYMONGO_SECRET_KEY` | Online ödeme |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo webhook imza |
| `PHILHEALTH_ECLAIMS_API_URL` | PhilHealth |
| `PHILHEALTH_API_KEY` | PhilHealth |

Edge deploy (CLI):

```bash
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

---

## ③ Veritabanı (bir kez)

SQL Editor’da sırayla:

1. `supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql` (tek dosya)
2. Doğrula: `scripts/runbook/02-verify-complete.sql` → **`overall = PASS`**

Detay: [`docs/SQL_RUNBOOK_TR.md`](./SQL_RUNBOOK_TR.md)

---

## ④ Cron (Supabase pg_cron veya harici)

Her 15 dk / günlük job’lar — [`docs/SUPABASE_CRON_SETUP.md`](./SUPABASE_CRON_SETUP.md)

Örnek:

```bash
curl -X POST "https://YOUR_REF.supabase.co/functions/v1/appointment-reminders-cron" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## ⑤ İlk giriş smoke (5 dk)

1. `/onboarding` — org + şube
2. **Settings → Workflow** — check-in, served, plan→invoice **ON**
3. `/patients/new` → journey panel % ilerlemesi
4. Randevu → check-in → queue → served → plan → fatura → ödeme

Tam liste: [`tasks/CLINICAL_JOURNEY_AZ.md`](../tasks/CLINICAL_JOURNEY_AZ.md)

---

## ⑥ PayMongo webhook (canlı ödeme açınca)

URL: `https://YOUR_REF.supabase.co/functions/v1/paymongo-webhook`  
Event: `checkout_session.payment.paid`

---

## Hazır mı?

| Kontrol | Beklenen |
|---------|----------|
| Vercel build | ✅ Ready |
| SQL verify | `PASS` |
| Login | Staff girişi OK |
| Journey panel | Hasta profilinde A→Z adımlar |
| Workflow toggles | ON |
| SMS/ödeme | Secret yoksa dry-run (normal) |

**Detaylı F6:** [`docs/VA-F6_USER_STEPS.md`](./VA-F6_USER_STEPS.md) · **Deploy:** [`docs/DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md)
