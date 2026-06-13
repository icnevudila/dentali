# Visualize %100 + Modüller Arası Otomasyon — Master Plan

> **Hedef:** Tüm modüllerde owner-grade görselleştirme + maksimum modüller arası otomasyon (Filipinler multi-branch dental OS).
> **Kitle:** Clinic owner / admin (tüm şubeler + drill-down).
> **Grafik:** Recharts hibrit — zengin ama klinik-özel, template/slop yok.

---

## F0 — Altyapı

- [x] **VA-F0-01** `ChartKit` bileşenleri: `TrendLine`, `TrendArea`, `CompareBar`, `StatusFunnel`, `Sparkline` (design token renkleri)
- [x] **VA-F0-02** `fetch_owner_analytics` / `get_branch_analytics_summary` RPC (çok şube, tarih aralığı)
- [x] **VA-F0-03** `workflow_events` tablosu + `emit_workflow_event` helper
- [x] **VA-F0-04** `branch_workflow_settings` (otomasyon kuralları açık/kapalı)
- [x] **VA-F0-05** Reports servis katmanını RPC'ye taşı (client-side aggregation azalt)
- [x] **VA-F0-06** i18n anahtarları: analytics, closeout, automation

---

## F1 — Operasyon otomasyonu

- [x] **VA-F1-01** `check_in_patient` → bağlı randevu `checked_in` (atomik RPC)
- [x] **VA-F1-02** Kiosk check-in → aynı RPC zinciri
- [x] **VA-F1-03** `update_queue_status(served)` → randevu `completed`
- [x] **VA-F1-04** Queue `cancelled` → randevu durumu politikası (no-show vs cancel)
- [x] **VA-F1-05** Consent/medical eksik → check-in soft gate + override (audit)
- [x] **VA-F1-06** Cancel/no-show slot açılınca waitlist match RPC
- [x] **VA-F1-07** Waitlist match → otomatik SMS kuyruğu
- [x] **VA-F1-08** Randevu T-24h / T-2h hatırlatma cron (Edge `scheduled-reminders`)
- [x] **VA-F1-09** No-show sonrası otomatik SMS + waitlist tetik

---

## F2 — Finans otomasyonu

- [x] **VA-F2-01** Treatment plan `approved` → invoice draft RPC (auto)
- [x] **VA-F2-02** Invoice `issued` + hasta HMO → HMO claim draft auto
- [x] **VA-F2-03** Balance > 0 + vade → ödeme hatırlatma SMS
- [x] **VA-F2-04** PayMongo webhook → payment kaydı otomatik (intent succeeded)
- [x] **VA-F2-05** Payment → ortho case balance güncelleme
- [x] **VA-F2-06** Void/refund → claim/ledger uyumu + audit
- [x] **VA-F2-07** PhilHealth claim draft metadata auto-fill (readiness checklist)

---

## F3 — Klinik otomasyonu

- [x] **VA-F3-01** Odontogram bulgusu → treatment plan satırı önerisi UI
- [x] **VA-F3-02** Bulk “chart findings → plan items” RPC
- [x] **VA-F3-03** Appointment completed → eksik clinical note uyarısı (Attention)
- [x] **VA-F3-04** Procedure catalog BOM → tamamlanan prosedürde envanter düşümü
- [x] **VA-F3-05** Low stock → prosedür uyarısı (plan/invoice satırında)
- [x] **VA-F3-06** Consent signed → patient checklist auto-update
- [x] **VA-F3-07** Medical history güncelleme → chart ekranında alert refresh

---

## F4 — Visualize: modül modül %100

### Overview
- [x] **VA-F4-01** Dashboard: çok şubeli owner KPI grid (partial — `OwnerBranchKpiGrid`)
- [x] **VA-F4-02** Dashboard: 7/30/90g trend (appointments + collections) — period toggle on dashboard + reports hub
- [x] **VA-F4-03** Reports Hub: Recharts line/area, şube karşılaştırma
- [x] **VA-F4-04** Reports: HMO pending + open AR özet grafikleri (`FinanceSummaryPanel` + `HmoAnalyticsPanel` on hub)

### Appointments
- [x] **VA-F4-05** Takvim yoğunluk heatmap / doluluk % (`ScheduleHeatmap` + week cell intensity)
- [x] **VA-F4-06** No-show & cancel trend sparkline
- [x] **VA-F4-07** Dentist/chair utilization breakdown (`AppointmentsAnalyticsPanel` provider bar)

### Queue + Waitlist
- [x] **VA-F4-08** Median wait time + peak hours chart
- [x] **VA-F4-09** Waitlist conversion funnel (waiting → contacted → booked)
- [x] **VA-F4-10** Günlük flow özeti (waiting/serving/served) (`QueueAnalyticsPanel` today flow funnel)

### Patients + Clinical
- [x] **VA-F4-11** Registry: yeni hasta trend + consent completion rate
- [x] **VA-F4-12** Hasta profili: treatment plan progress bar
- [x] **VA-F4-13** Odontogram summary zenginleştirme (condition dağılımı)
- [x] **VA-F4-14** Ortho: adjustment timeline + balance chart (`OrthoCaseTimelinePanel`)

### Billing + Claims
- [x] **VA-F4-15** AR aging chart (0-30 / 31-60 / 60+)
- [x] **VA-F4-16** Billing list: tahsilat sparkline
- [x] **VA-F4-17** HMO pipeline funnel
- [x] **VA-F4-18** PhilHealth readiness + claim status breakdown

### Inventory + Ops
- [x] **VA-F4-19** Stock movement in/out trend (`InventoryAnalyticsPanel`)
- [x] **VA-F4-20** Expiry timeline + low-stock trend (`InventoryAnalyticsPanel`)
- [x] **VA-F4-21** SMS delivery rate chart (`NotificationAnalyticsPanel`)
- [x] **VA-F4-22** Audit action-type breakdown (`AuditAnalyticsPanel`)
- [x] **VA-F4-23** Kiosk check-in volume (`KioskAnalyticsPanel` on queue)
- [x] **VA-F4-24** TV display uptime / last refresh (`TvDisplayHealthPanel` + `active_displays_7d` RPC)

---

## F5 — Owner intelligence

- [x] **VA-F5-01** Daily Closeout ekranı (`/reports/closeout`)
- [x] **VA-F5-02** Closeout: tahsilat, açık bakiye, no-show, pending consent, pending claims
- [x] **VA-F5-03** Closeout PDF + CSV export
- [x] **VA-F5-04** `dashboard_snapshots` / closeout run history
- [x] **VA-F5-05** Scheduled email report (Edge, owner) — kod hazır; Resend secret canlıda
- [x] **VA-F5-06** Branch compare mode (yan yana şube)

---

## F6 — Canlı entegrasyonlar

- [ ] **VA-F6-01** Semaphore SMS canlı mod + otomasyon bağlantısı
- [ ] **VA-F6-02** PayMongo production secrets + webhook doğrulama
- [ ] **VA-F6-03** PhilHealth API (readiness → submit path)
- [x] **VA-F6-04** Vercel production deploy + env checklist (`DEPLOY_CHECKLIST.md` + `VA-F6_USER_STEPS.md`; deploy kullanıcıda)

---

## F7 — Fazlası (ürün farkı)

- [x] **VA-F7-01** Workflow rule builder UI (branch settings)
- [x] **VA-F7-02** Automation run log (owner: ne tetiklendi, başarı/hata)
- [x] **VA-F7-03** Smart attention engine (declarative rules + workflow hints)
- [x] **VA-F7-04** Patient merge UI (preview + DOB/archived guard)
- [x] **VA-F7-05** Invoice gerçek PDF (server-side `generate-invoice-pdf` edge fn + download button)
- [x] **VA-F7-06** Multi-branch benchmark (şube sıralaması)
- [x] **VA-F7-07** E2E: automation chain smoke (auth helpers, attention routes, invoice PDF/print, merge panel)

---

## Bağımlılık sırası

```txt
F0 → F1 + F2 + F3 (paralel) → F4 → F5 → F6 → F7
```

## İlerleme

| Faz | Toplam | Bitti (yaklaşık) |
|-----|--------|------------------|
| F0 | 6 | 6 |
| F1 | 9 | 9 |
| F2 | 7 | 7 |
| F3 | 7 | 7 |
| F4 | 24 | 24 |
| F5 | 6 | 6 |
| F6 | 4 | 1 (F6-04 checklist; F6-01–03 secret + deploy bekliyor) |
| F7 | 7 | 7 |
| **Toplam** | **70** | **~69** |

> **Kalan:** yalnızca **VA-F6-01–03 + deploy** (canlı secret + cron + smoke) — bkz. `docs/VA-F6_USER_STEPS.md`. Agent secret-free iş tamamlandı; marathon kuyruğu boş.
