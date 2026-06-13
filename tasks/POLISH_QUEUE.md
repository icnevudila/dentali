# Polish Queue — A→Z Mükemmelleştirme

> **Ritim:** Biten iş → burada `DONE` + tarih. Yeni eksik → `NOW` veya `QUEUE`. Geliştirdikçe liste büyür, bittikçe küçülür.
> **Tam denetim:** [`tasks/MODULE_COMPLETENESS_AUDIT.md`](./MODULE_COMPLETENESS_AUDIT.md)

---

## İstatistik

| Metrik | Değer |
|--------|-------|
| P0 açık | 0 |
| P1 akış polish | 11 + journey panel | FLOW + A→Z panel uygulandı — manuel smoke |
| Son güncelleme | 2026-06-13 (marketing pages + leads RPC) |

---

## NOW (tek seferde bir dalga)

| ID | İş | Durum |
|----|-----|-------|
| **POLISH-SMOKE-MANUAL** | [`tasks/CLINICAL_JOURNEY_AZ.md`](./CLINICAL_JOURNEY_AZ.md) checklist — staging turu | 🔴 kullanıcı |
| **POLISH-E2E-STAFF** | `E2E_TEST_*` ile `e2e/smoke.spec.ts` + `automation-chain.spec.ts` | 🟡 credentials gerekir |

---

## QUEUE (sıradaki agent işleri)

| ID | Öncelik | Modül | İş |
|----|---------|-------|-----|
| POLISH-P2-F6 | P2 | Canlı | Semaphore / PayMongo / Resend — `docs/VA-F6_USER_STEPS.md` |
| POLISH-P2-SEO-HUB | P2 | Marketing | ~~Landing shell + pricing/quote/signup~~ DONE — blog Phase 2 `tasks/SEO_CONTENT_HUB.md` |
| POLISH-P3-STERILIZATION | P3 | Modül 24 | ~~Sterilization/compliance log (schema + UI)~~ DONE |
| POLISH-P3-INVENTORY-REORDER | P3 | Modül 23 | ~~Reorder suggestion UI~~ DONE |
| POLISH-P3-HALLMARK-PASS | P3 | UI/UX | ~~Compliance + audit cross-links~~ DONE — welcome redesign deferred |
| POLISH-P3-E2E-EXPAND | P3 | QA | Consent sign + billing payment E2E |

---

## Modül skor kartı (Working / Partial / Broken)

| Modül | Route | Backend | UI | Otomasyon | Not |
|-------|-------|---------|-----|-----------|-----|
| 01–04 Foundation | settings/* | 🟢 | 🟢 | 🟢 | — |
| 05–12 Clinical | patients/* | 🟢 | 🟢 | 🟢 | Akış CTA eklendi |
| 13–17 Operations | appt/queue/kiosk | 🟢 | 🟢 | 🟢 | Queue→note, appt→queue |
| 18 Notifications | settings/notifications | 🟢 | 🟢 | 🟠 | F6 SMS |
| 19–21 Billing | billing/* | 🟢 | 🟢 | 🟢 | HMO link polish |
| 22 PhilHealth | billing/philhealth | 🟢 | 🟢 | 🟠 | F6 API |
| 23 Inventory | /inventory | 🟢 | 🟢 | 🟢 | Reorder suggestion UI eklendi |
| 24 Compliance | reports/audit | 🟢 | 🟢 | 🟢 | Sterilization log at `/reports/compliance` |
| F6 Canlı | — | — | — | 🔴 | secret + cron deploy |

Simge: 🟢 tamam · 🟡 kısmi · 🔴 blocker (canlı)

---

## Doğrulama

```bash
npx tsc --noEmit
npm run test:e2e:public
npm run test:e2e -- e2e/chart.smoke.spec.ts
# SQL: scripts/runbook/02-verify-complete.sql → overall PASS
```

---

## DONE (2026-06-13)

| ID | İş |
|----|-----|
| POLISH-COMPLIANCE-24 | `compliance_cycles` migration, RPC, `/reports/compliance` sterilization log UI |
| POLISH-HALLMARK-COMPLIANCE | Audit ↔ compliance links, reports hub card, ModulePageShell polish |
| POLISH-MARKETING-AZ | `/signup`, `/pricing`, `/quote`, `MarketingShell`, i18n, JSON-LD, `marketing_leads` RPC + bundle 89 |

## DONE (2026-06-12)

| ID | İş |
|----|-----|
| POLISH-P0-DB | SQL bundle + verify PASS |
| POLISH-AUDIT | `MODULE_COMPLETENESS_AUDIT.md` — 24 modül, RPC, akış boşlukları |
| POLISH-FLOW-01…11 | Intake banner, consent checklist links, appt→queue, waitlist link, queue consent/note, plan/chart, HMO links, workflow chip |
| POLISH-JOURNEY-AZ | `ClinicalVisitJourneyPanel`, `CLINICAL_JOURNEY_AZ.md`, sidebar New patient, billing payment success banner |
| POLISH-CONSENT / SEO / E2E-PUBLIC | (önceki tur) |

---

## Nasıl kullanılır (agent)

1. `MODULE_COMPLETENESS_AUDIT.md` oku → NOW/QUEUE seç.
2. Bitir → DONE + modül skor kartını güncelle.
3. `npx tsc --noEmit` + ilgili E2E.
