# Harici entegrasyonlar — hazırlık (hesap açmadan da klinik çalışır)

> PayMongo / PhilHealth / Semaphore **hesabı sende olmadan** klinik OS çalışır (dry-run / manuel).  
> Bu sayfa: hesap açınca **nereye ne yapıştırılır** — kod tarafı hazır.

Canlı site: https://ph-dental-app.vercel.app  
Supabase project: `https://ahipxdlxyuvqikcybjpm.supabase.co`

---

## Klinik bugün (hesap yok)

| Modül | Durum |
|-------|--------|
| Hasta / randevu / queue / fatura / nakit ödeme | Canlı |
| Inbox, WhatsApp `wa.me`, check-in link + QR | Canlı |
| Team chat, timesheet | Canlı |
| Online PayMongo checkout | Stub (secret yoksa) |
| PhilHealth claim kaydı | Dry-run sync (API yoksa) |
| SMS hatırlatma | Dry-run (Semaphore yoksa) |
| DICOM C-STORE gateway | Plan: `docs/superpowers/specs/2026-07-26-dicom-windows-gateway-design.md` (en son) |

---

## 1) PayMongo (isteğe bağlı — online ödeme)

Kod hazır: `create-payment-intent`, `portal-create-payment-intent`, `paymongo-webhook` (HMAC).

### Hesap açınca (5 adım)

1. [PayMongo Dashboard](https://dashboard.paymongo.com/) → API keys → **Secret key** kopyala  
2. Supabase → Edge Functions → Secrets:
   - `PAYMONGO_SECRET_KEY` = `sk_test_…` veya `sk_live_…`
   - `SITE_URL` = `https://ph-dental-app.vercel.app`
3. Webhooks → Add endpoint:
   - URL: `https://ahipxdlxyuvqikcybjpm.supabase.co/functions/v1/paymongo-webhook`
   - Event: `checkout_session.payment.paid`
4. Endpoint **signing secret** → `PAYMONGO_WEBHOOK_SECRET`  
5. Staff Billing’de “Create PayMongo link” → canlı checkout; portal hasta ödemesi aynı secret’ı kullanır

**Not:** Webhook secret yoksa webhook **503** verir (imzasız ödeme kabul edilmez). Checkout tutarı peso; PayMongo’ya centavos (×100).

Hesap yoksa: faturada **Record Payment** (nakit/GCash manuel) kullan.

---

## 2) PhilHealth eClaims (isteğe bağlı — partner sonra)

Kod hazır: claim CRUD + checklist + `sync-philhealth-claim` edge (secret yoksa **dry-run log**).

### Hesap / accreditation olunca

1. Partner veya PhilHealth eClaims API URL + key al  
2. Edge secrets:
   - `PHILHEALTH_ECLAIMS_API_URL`
   - `PHILHEALTH_API_KEY`
3. Billing → PhilHealth → claim **ready** → Sync  
4. Dry-run banner kaybolur; `provider_ref` canlı döner

**V1 önerisi:** Claim’leri DentQL’de tut; resmi gönderimi PhilHealth portal / billing partner üzerinden yap. Live connector ayrı program.

---

## 3) Semaphore SMS (isteğe bağlı)

1. [Semaphore](https://semaphore.co/) API key  
2. Edge secret: `SEMAPHORE_API_KEY`  
3. Settings → Notifications → branch **dry-run OFF**  
4. Cron’lar gerçek SMS atar (`appointment-reminders-cron`, vb.)

Yoksa: dry-run log + WhatsApp `wa.me` outreach yeterli.

---

## 4) Resend e-posta (isteğe bağlı — closeout)

| Secret | Örnek |
|--------|--------|
| `RESEND_API_KEY` | `re_…` |
| `CLOSEOUT_EMAIL_FROM` | `Dentali Closeout <closeout@yourdomain>` |

---

## 5) Zaten deploy edilmiş edge fonksiyonlar

| Function | JWT | Not |
|----------|-----|-----|
| `create-payment-intent` | yes | Staff PayMongo |
| `portal-create-payment-intent` | no | Portal (session doğrulamalı) |
| `paymongo-webhook` | no | HMAC zorunlu |
| `sync-philhealth-claim` | yes | Dry-run/live |
| `send-sms` / crons | mixed | Semaphore |
| `process-slot-notifications` | no | Waitlist (`x-cron-secret`) |

---

## 6) Vercel (Next.js) — minimum

| Key | Değer |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ahipxdlxyuvqikcybjpm.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard anon |
| `NEXT_PUBLIC_SITE_URL` | `https://ph-dental-app.vercel.app` |

PayMongo/PhilHealth secret’ları **Vercel’e değil**, Supabase Edge Secrets’a gider.

---

## 7) Smoke (hesap olmadan)

- [ ] Login + hasta oluştur  
- [ ] Randevu → Check-in link → QR / WhatsApp  
- [ ] `/inbox` badge  
- [ ] `/team-chat` mesaj  
- [ ] `/timesheet` clock in/out  
- [ ] Fatura → Record Payment (manuel)  
- [ ] PhilHealth claim oluştur → Sync → dry-run log  
- [ ] Billing PayMongo butonu → stub URL (secret yoksa normal)

Detay: [`GO_LIVE_SMOKE.md`](./GO_LIVE_SMOKE.md) · Tek sayfa: [`GO_LIVE_ONE_PAGE.md`](./GO_LIVE_ONE_PAGE.md)
