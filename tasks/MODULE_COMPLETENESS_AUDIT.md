# Modül Tamamlık Denetimi — 2026-06-13

> DB verify **PASS** sonrası ürün boşluk analizi. Canlı entegrasyonlar (F6) hariç.
> Ritim: Her dalga bitince ilgili satırı `POLISH_QUEUE.md` → DONE.

---

## Özet skor

| Katman | Durum | Not |
|--------|-------|-----|
| 24 modül route + servis | **24/24** | Eksik modül yok |
| Frontend ↔ migration RPC | **115/115 eşleşiyor** | Eksik backend RPC yok |
| Otomasyon F1–F5 + F7 | **~69/70** | F6 secret bekliyor |
| Modüller arası UI zinciri | **~90%** | A→Z journey panel + FLOW CTA’lar |
| E2E kapsam | **4 spec** | Staff smoke credentials gerekir |

---

## Modül matrisi

| # | Modül | Route | RPC/UI | Boşluk |
|---|-------|-------|--------|--------|
| 01 | Organization | `/settings/organization`, `/onboarding` | 🟢 | — |
| 02 | Auth / Roles | `/login`, `/settings/roles` | 🟢 | — |
| 03 | Staff | `/settings/staff/*` | 🟢 | — |
| 04 | Settings | `/settings/*` | 🟢 | — |
| 05 | Patient registry | `/patients` | 🟢 | Sidebar **New patient** eklendi |
| 06 | Intake | `/patients/new` | 🟢 | Kayıt sonrası sıradaki adım CTA → **POLISH-FLOW-01** |
| 07 | Medical history | patient tab | 🟢 | — |
| 08 | Consent | consents + `/sign/[token]` | 🟢 | Checklist consent link → **POLISH-FLOW-02** |
| 09 | Chart / perio | `/patients/[id]/chart` | 🟢 | — |
| 10 | Treatment plan | `/patients/[id]/treatment-plan` | 🟢 | Boş plan → chart CTA → **POLISH-FLOW-03** |
| 11 | Clinical notes | patient tab | 🟢 | Queue served → note CTA → **POLISH-FLOW-04** |
| 12 | Ortho | `/patients/[id]/ortho` | 🟢 | — |
| 13 | Appointments | `/appointments` | 🟢 | Check-in → queue link → **POLISH-FLOW-05** |
| 14 | Waitlist | `/waitlist` | 🟢 | Toast → waitlist link → **POLISH-FLOW-06** |
| 15 | Queue | `/queue` | 🟢 | Consent gate link → **POLISH-FLOW-07** |
| 16 | Kiosk | `/kiosk` | 🟢 | — |
| 17 | Display | `/display` | 🟢 | — |
| 18 | Notifications | `/settings/notifications` | 🟡 | Dry-run SMS (F6) |
| 19 | Procedures | `/settings/procedures` | 🟢 | — |
| 20 | Invoices | `/billing` | 🟢 | Empty → plan/workflow hint → **POLISH-FLOW-08** |
| 21 | HMO | `/billing/hmo` | 🟢 | Invoice/plan → HMO link → **POLISH-FLOW-09** |
| 22 | PhilHealth | `/billing/philhealth` | 🟡 | Dry-run submit (F6) |
| 23 | Inventory | `/inventory` | 🟢 | Reorder suggestion UI eklendi |
| 24 | Compliance / reports | `/reports`, `/reports/compliance`, audit | 🟢 | Sterilization log UI eklendi |

---

## Eksik fonksiyon (RPC)

**Frontend’de çağrılıp migration’da olmayan:** yok.

**UI’da olmayan ama kasıtlı (edge/cron/internal):**

| RPC | Neden UI yok |
|-----|----------------|
| `enqueue_*` cron RPC’leri | Edge functions |
| `create_payment_intent` | Edge `create-payment-intent` |
| `deduct_procedure_bom` | Otomasyon (queue served + workflow toggle) |
| `expire_old_waitlist_entries` | pg_cron adayı — bağlantı doğrula |
| `seed_demo_showcase_data` | Script only |

**Gerçek ürün boşluğu:** manuel BOM stok düşümü UI’si yok (workflow açıkken otomatik).

---

## Modüller arası akış boşlukları (öncelik)

| ID | Akış | Sorun | Fix |
|----|------|-------|-----|
| POLISH-FLOW-01 | Intake → profile | Kayıt sonrası yönlendirme belirsiz | `?intake=complete` + next-steps banner |
| POLISH-FLOW-02 | Profile checklist | DPA/general consent link yok | Checklist `href` → `?tab=consents` |
| POLISH-FLOW-03 | Chart → plan | Boş plan satırında CTA yok | “Open chart” link |
| POLISH-FLOW-04 | Queue → note | Served sonrası not yönlendirmesi yok | Complete sonrası “Create note” |
| POLISH-FLOW-05 | Appt → queue | Check-in sonrası queue link yok | Başarı banner + `/queue` |
| POLISH-FLOW-06 | Waitlist notify | Toast’tan waitlist’e geçiş yok | Link `/waitlist` |
| POLISH-FLOW-07 | Consent gate | Override öncesi consent açılamıyor | “Open consents” link |
| POLISH-FLOW-08 | Plan → invoice | Billing empty zayıf | Workflow + patients CTA |
| POLISH-FLOW-09 | Invoice → HMO | Fatura ekranında HMO link yok | `/billing/hmo?status=draft` |
| POLISH-FLOW-10 | Ops sayfaları | Workflow durumu görünmüyor | Settings/workflow chip (queue, appt, billing) |
| POLISH-FLOW-11 | Profile metrics | Consents metric tıklanmıyor | `href` → consents tab |

---

## %100’e giden yol (entegrasyon hariç)

### Dalga 1 — Akış CTA’ları (1–2 gün) ✅
POLISH-FLOW-01 … 11 + **ClinicalVisitJourneyPanel** → [`tasks/CLINICAL_JOURNEY_AZ.md`](./CLINICAL_JOURNEY_AZ.md) manuel tur

### Dalga 2 — UX polish (modül modül)
Her modül için `docs/screens` + UI master rules:
- loading / empty / error / permission / saving
- Hallmark design-review pass (`tasks/DESIGN_REVIEW_MVP.md`)

### Dalga 3 — Test güveni
- `E2E_TEST_*` ile `e2e/smoke.spec.ts` + `automation-chain.spec.ts`
- Modül bazlı: consent sign, billing payment, queue chain

### Dalga 4 — v2 / büyük parçalar
- Modül 24 sterilization logging (schema + UI)
- Inventory reorder suggestions
- SEO content hub Phase 2

### Dalga 5 — Canlı (sizin tarafınız)
- `docs/VA-F6_USER_STEPS.md`

---

## Doğrulama komutları

```bash
npx tsc --noEmit
npm run test:e2e:public
npm run test:e2e -- e2e/chart.smoke.spec.ts
# credentials ile:
npm run test:e2e -- e2e/smoke.spec.ts e2e/automation-chain.spec.ts
```

SQL: `scripts/runbook/02-verify-complete.sql` → `overall = PASS`
