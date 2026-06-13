# Marathon Queue — Dentali

> **Kural:** `NOW` bitmeden sonrakine geçme. QUEUE boşalınca `tasks/*.md` BACKLOG satırlarından yeni madde ekle.

## İstatistik

| Metrik | Değer |
|--------|-------|
| DONE | 203 |
| Migrations | 85 |
| Edge functions | 11 |

---

## NOW

| ID | İş | Kaynak |
|----|-----|--------|
| **POLISH-P0-DB** | Supabase migration apply + RPC verify | [`tasks/POLISH_QUEUE.md`](./POLISH_QUEUE.md) |
| **VA-F6** | Production deploy + live secrets (Semaphore, PayMongo, Resend, PhilHealth) | MASTER F6 |

> **Polish ritmi:** Agent işleri → `POLISH_QUEUE.md`. Bitince DONE, yeni eksik → QUEUE.

> **Kullanıcı adımı:** `docs/VA-F6_USER_STEPS.md` — cron dashboard, secret'lar, `GO_LIVE_SMOKE.md` canlı/staging. Agent secret-free iş tamamlandı.

---

## QUEUE

_(Boş — secret-free iş kalmadı)_

---

## DONE (son oturum)

| ID | İş |
|----|-----|
| VA-MARATHON-VERIFY | tsc + `verify:attention` OK; orphan `DisplayHealthAnalyticsPanel` silindi |
| VA-MARATHON-SWEEP | tsc temiz; kırık `DisplayHealthAnalyticsPanel` import kaldırıldı |
| VA-BUNDLE | `_APPLY_ALL_IDEMPOTENT.sql` rebundle (80 migration) |
| VA-F4-07 | Provider utilization chart (`AppointmentsAnalyticsPanel`) |
| VA-F4-10 | Queue daily flow funnel (`QueueAnalyticsPanel`) |
| VA-F4-14 | Ortho adjustment timeline (reports + patient `OrthoCaseTimelinePanel`) |
| VA-F4-19 | Inventory movement trend (`InventoryAnalyticsPanel`) |
| VA-F4-20 | Expiry timeline buckets (`InventoryAnalyticsPanel`) |
| VA-F4-21 | SMS delivery rate (`NotificationAnalyticsPanel`) |
| VA-F4-22 | Audit action-type breakdown (`AuditAnalyticsPanel`) |
| VA-F4-23 | Kiosk check-in volume (`KioskAnalyticsPanel` on queue) |
| VA-F4-24 | TV display heartbeat + health (`DisplayAnalyticsPanel`, `TvDisplayHealthPanel`, `active_displays_7d` RPC) |
| VA-F3-04 | Procedure BOM + auto deduct on queue served |
| VA-F6-04 | Deploy checklist (`DEPLOY_CHECKLIST.md` + `VA-F6_USER_STEPS.md`) |
| VA-F7-MASTER | VISUALIZE_AUTOMATION_MASTER sync (~69/70) |

---

## BACKLOG (tasks/*.md — kullanıcı adımları)

| ID | İş |
|----|-----|
| VA-F6-01 | Semaphore SMS canlı mod (secret) |
| VA-F6-02 | PayMongo production + webhook (secret) |
| VA-F6-03 | PhilHealth API canlı (secret) |
| VA-F6-DEPLOY | Vercel prod deploy + env (kullanıcı) |
| MARATHON-RUNBOOK | Supabase SQL apply + seed + smoke (kullanıcı) |

---

## Secret'lar (canlı mod)

| Secret | Modül |
|--------|-------|
| `PAYMONGO_SECRET_KEY` | Ödeme gateway |
| `PHILHEALTH_ECLAIMS_API_URL` + `PHILHEALTH_API_KEY` | PhilHealth |
| `SEMAPHORE_API_KEY` | SMS |
| `RESEND_API_KEY` + `CLOSEOUT_EMAIL_FROM` | Closeout e-posta |
| `CRON_SECRET` | Scheduled edge functions |

## Toplu SQL

`supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql` — **80 dosya**, idempotent bundle (`npm run db:bundle:idempotent`)
