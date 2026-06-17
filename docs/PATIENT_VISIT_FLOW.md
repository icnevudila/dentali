# Hasta ziyaret akışı (dentQL)

Tek kaynak kural: **fiziksel geliş = Queue check-in**. Randevu oluşturmak tek başına kliniğe giriş sayılmaz.

## Akış özeti

```
Randevu (scheduled/confirmed)
    → Queue: Check-in → Waiting
    → Ready / Called (now_serving)
    → In Chair (klinik + encounter açık)
    → Served (tedavi bitti)
    → Fatura (workflow açıksa otomatik taslak)
    → Ödeme
    → Encounter kapanır (workflow açıksa ödeme ile)
    → Randevu completed
```

Walk-in: **Queue → Patient arrival** (önce hasta dosyası yoksa Patients → New).

Kiosk: `submit_kiosk_checkin` aynı `check_in_patient` yoluna girer.

## Ekranlar ve sorumluluk

| Adım | Kim | Nerede | Ne olur |
|------|-----|--------|---------|
| Randevu | Reception | Appointments | `scheduled` — geçmiş saate randevu engelli |
| Check-in | Reception | Queue → Check-in kolonu | `check_in_appointment` → encounter + queue `waiting`, randevu `checked_in` |
| Kuyruk | Reception | Queue board | Waiting → Ready → Called → In Chair → Served |
| Klinik | Dentist | Dentist board / hasta chart | SOAP, odontogram, plan |
| Faturalama | Billing | Billing | Ödeme → encounter kapanışı (toggle) |
| Gün sonu | Owner | Reports → Closeout | Taslak snapshot kilitlemez; **Finalize** kilitle |

## Check-in listesi mantığı

Queue **Check-in** kolonunda görünenler:

- Bugün `scheduled`, `confirmed` veya takılı kalmış `checked_in`
- **Ve** aktif kuyruk kaydı yok (`waiting` \| `ready` \| `now_serving` \| `in_chair`)

`served` veya `cancelled` kuyruk kaydı check-in listesinden düşürür.

## Workflow toggle’ları (Settings → Workflow)

- `auto_checkin_updates_appointment` — check-in’de randevu `checked_in`
- `consent_gate_checkin` — imzasız consent check-in’i bloklar
- `auto_served_completes_appointment` — Served’da randevu `completed`
- `auto_served_creates_invoice` — Served’da fatura taslağı
- `auto_close_encounter_on_payment` — tam ödemede encounter kapanır

## SQL paketleri (sıra)

1. **`supabase/scripts/APPLY_PATIENT_FLOW_MASTER.sql`** — tek paket (veri onarımı, workflow, check-in, kuyruk, closeout, KPI, completed guard)
2. İsteğe bağlı ek: `supabase/migrations/20260618100000_appointment_complete_queue_guard.sql` (master’ı zaten uyguladıysan gerekmez)
3. Doğrulama: `supabase/scripts/verify_clinic_flow.sql`

Eski parçalı paketler (`apply_clinic_flow_queue_bundle.sql`, `20260618000000_patient_flow_hardening.sql`) master ile birleştirildi.

## 2 dakikalık smoke test

1. Bugün için randevu oluştur → Appointments’ta görünür
2. Queue → Check-in’de görünür → Check in → **Waiting**
3. In Chair → Served → Billing’de fatura
4. Closeout: Save draft faturalamayı kilitlememeli; Finalize kilitlemeli
