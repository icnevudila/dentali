# A→Z Klinik Akış Rehberi

> **Hedef:** Kayıttan ödemeye kadar tüm klinik yolculuğun %100 çalıştığını doğrulamak.  
> **Entegrasyonlar (SMS, PayMongo canlı, PhilHealth API)** sonra — bu rehber ürün akışını kapsar.

---

## Tek sayfa özeti

| # | Adım | Route / ekran | Otomasyon (Workflow açıkken) |
|---|------|---------------|------------------------------|
| 0 | Onboarding | `/onboarding` | — |
| 1 | Yeni hasta kaydı | `/patients/new` | — |
| 2 | Tıbbi geçmiş | `/patients/[id]/medical-history` | — |
| 3 | Onam formları | `?tab=consents` veya `/sign/[token]` | — |
| 4 | Randevu | `/appointments` | Hatırlatma cron (F6 SMS) |
| 5 | Check-in | `/queue` veya `/appointments` | Randevu → `checked_in` |
| 6 | Koltuk / sıra | `/queue` | TV `/display`, kiosk `/kiosk` |
| 7 | Klinik not | `?tab=clinical-notes` | Served sonrası CTA |
| 8 | Diş chart | `/patients/[id]/chart` | — |
| 9 | Tedavi planı | `/patients/[id]/treatment-plan` | Chart → bulk add |
| 10 | Plan onayı | treatment-plan sayfası | **Fatura taslağı** |
| 11 | Fatura | `/billing` | Plan onay → invoice draft |
| 12 | Ödeme | `/billing/[id]` | Manuel / PayMongo stub |
| 13 | HMO (opsiyonel) | `/billing/hmo` | Claim draft |
| 14 | Gün sonu | `/reports/closeout` | Closeout email cron (F6) |

**Hasta profilinde** `A→Z clinic journey` paneli her adımın durumunu ve sıradaki aksiyonu gösterir.

---

## Ön koşullar (bir kez)

1. SQL: `supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql` → `02-verify-complete.sql` = **PASS**
2. **Settings → Workflow** — şunları aç:
   - Check-in updates appointment
   - Served completes appointment
   - Plan approval creates invoice draft
   - (Opsiyonel) BOM stok düşümü, owner digest
3. **Settings → Procedures** — en az bir prosedür (veya Load defaults)
4. **Settings → Consent templates** — DPA + general treatment şablonları

---

## Dalga 1 — Intake (kayıt öncesi)

### 1.1 Yeni hasta
- **Route:** `/patients/new` (sidebar: **New patient**)
- **Doğrula:** Kayıt sonrası `/patients/[id]?intake=complete` + yeşil banner
- **Sonraki:** Medical history, consents, book appointment linkleri

### 1.2 Tıbbi geçmiş
- **Route:** `/patients/[id]/medical-history`
- **Doğrula:** Alerji/ilaç/kronik kaydedilir; profilde Medical Alert Banner görünür

### 1.3 Onamlar
- **Staff:** `?tab=consents` → imzala veya hasta linki gönder
- **Public:** `/sign/[token]`
- **Doğrula:** Checklist’te DPA + general = done; queue consent gate geçilir

---

## Dalga 2 — Ziyaret günü (front desk)

### 2.1 Randevu oluştur
- **Route:** `/appointments` veya profilden Book appointment
- **Doğrula:** Takvimde görünür; hasta profili Appointments sekmesinde listelenir

### 2.2 Check-in
- **Route:** `/appointments` (Check-in) veya `/queue` (Walk-in / bugünkü randevu)
- **Doğrula:** Başarı banner → **Open queue board**; sıra numarası oluşur
- **Otomasyon:** Randevu durumu `checked_in` (workflow toggle)

### 2.3 Sıra & koltuk
- **Route:** `/queue` — Waiting → Called → Served
- **Consent eksikse:** Override veya **Open consents** linki
- **Served sonrası:** **Create note** banner → clinical notes
- **Otomasyon:** Served → appointment `completed`; BOM düşümü (toggle)

### 2.4 Kiosk / TV (opsiyonel)
- **Kiosk:** `/kiosk?token=…` — self check-in
- **Display:** `/display?token=…` — bekleme salonu ekranı

---

## Dalga 3 — Koltukta (clinical)

### 3.1 Klinik not
- **Route:** `/patients/[id]?tab=clinical-notes` veya `/patients/[id]/notes`
- **Doğrula:** SOAP kaydı timeline’da; journey adımı “Clinical note” = done

### 3.2 Diş chart (odontogram)
- **Route:** `/patients/[id]/chart`
- **Doğrula:** Bulgu kaydet → save; perio panel; plan suggest banner (findings varsa)

### 3.3 Tedavi planı
- **Route:** `/patients/[id]/treatment-plan`
- **Boş plan:** Chart’a link
- **Bulk from chart:** Chart bulgularını prosedüre eşle
- **Onay:** Approve → toplam güncellenir

### 3.4 Plan onayı → fatura
- **Otomasyon:** Workflow açıkken onay sonrası `/billing`’de **draft invoice**
- **Doğrula:** Journey “Plan approved” + “Invoice issued” = done

---

## Dalga 4 — Checkout (billing)

### 4.1 Fatura detay
- **Route:** `/billing/[id]`
- **Doğrula:** Kalemler, özet, PDF/Print

### 4.2 Ödeme
- **Manuel:** Record Payment (cash/card/GCash/bank)
- **Online stub:** PayMongo/GCash link (dry-run OK entegrasyon öncesi)
- **Doğrula:** Balance = 0; yeşil **Payment recorded** banner; hasta profiline dönüş linki

### 4.3 HMO (varsa)
- **Route:** `/billing/hmo?status=draft`
- **Fatura ekranından:** HMO claim drafts hint

### 4.4 PhilHealth (varsa)
- **Route:** `/billing/philhealth` — dry-run submit (F6 öncesi stub)

---

## Dalga 5 — Raporlama & kapanış

- **Reports Hub:** `/reports` — branch benchmark, finance
- **Daily Closeout:** `/reports/closeout`
- **Dashboard Needs attention** — overdue, consents, missing notes deep link’leri

---

## Doğrulama checklist (%100 güven)

Her maddeyi staging’de tek turda işaretle:

```
[ ] 02-verify-complete.sql → PASS
[ ] Workflow toggles ON (check-in, served, plan→invoice)
[ ] Yeni hasta → intake banner
[ ] Medical history + consents signed
[ ] Randevu → check-in → queue served
[ ] Clinical note yazıldı
[ ] Chart bulgu kaydedildi
[ ] Treatment plan → approve
[ ] Billing’de invoice göründü
[ ] Ödeme kaydedildi, balance 0
[ ] Hasta profilinde journey %100 (veya billing adımı current)
```

### Otomatik testler

```bash
npx tsc --noEmit
npm run test:e2e:public
npm run test:e2e -- e2e/chart.smoke.spec.ts
npm run test:e2e -- e2e/clinical-journey-routes.spec.ts
# Staff (credentials):
npm run test:e2e -- e2e/smoke.spec.ts e2e/automation-chain.spec.ts
```

### Manuel altın yol

Tam adım adım: [`docs/GO_LIVE_SMOKE.md`](../docs/GO_LIVE_SMOKE.md) §4

---

## Bilinçli v2 parçalar (100% akış dışı)

| Parça | Durum | Not |
|-------|-------|-----|
| Sterilization log | v2 | Modül 24 — schema + UI yok |
| Inventory reorder UI | v2 | Modül 23 |
| F6 canlı SMS/ödeme | Sonra | `docs/VA-F6_USER_STEPS.md` |
| SEO blog hub | Sonra | `tasks/SEO_CONTENT_HUB.md` |

---

## Sorun giderme

| Belirti | Kontrol |
|---------|---------|
| Check-in randevuyu güncellemez | Settings → Workflow toggle |
| Plan onayı fatura oluşturmaz | Workflow + prosedür fiyatları |
| Queue consent blok | DPA/general imzalı mı? force_checkin |
| Journey adımı takılı | Profilde panel — Next CTA’yı takip et |
| RPC hatası | `02-verify-complete.sql` yeniden çalıştır |

---

*Son güncelleme: 2026-06-12 — ClinicalVisitJourneyPanel + sidebar New patient*
