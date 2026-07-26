# Hasta ziyaret akışı (dentQL)

Tek kaynak kural: **fiziksel geliş = Queue check-in**. Randevu oluşturmak tek başına kliniğe giriş sayılmaz.

## Sözlük (tek dil)

UI genelinde tek terminoloji kullanılır. Kod/DB alanları (ör. `encounter_id`, queue status `served`) değişmez; yalnızca kullanıcıya görünen metin standarttır.

| Kavram | UI terimi | Eski/kaçınılan |
|--------|-----------|----------------|
| Klinik ziyaret (encounter) | **Visit / Ziyaret** | encounter, muayene |
| Tedavi tamamlandı (queue `served`) | **Treatment done / Tedavi bitti** | Served |
| Ziyareti kapatma aksiyonu | **Finish visit / Ziyareti bitir** | Checkout / Discharge |
| Ziyaret kaydını kapatma | **Close visit / Ziyareti kapat** | close encounter, discharge |
| Kapatmayı geri alma | **Reopen visit / Ziyareti yeniden aç** | Undo discharge |

## Akış özeti

```
Randevu (scheduled/confirmed)
    → Queue: Check-in → Waiting
    → Ready / Called (now_serving)
    → In Chair (klinik + visit açık)
    → Treatment done (queue `served`) → Finish visit paneli açılır
    → Fatura (workflow açıksa otomatik taslak)
    → Ödeme
    → Visit kapanır (workflow açıksa ödeme ile, ya da Finish visit ile elle)
    → Randevu completed
```

Walk-in: **Queue → Patient arrival** (önce hasta dosyası yoksa Patients → New).

Kiosk: `submit_kiosk_checkin` aynı `check_in_patient` yoluna girer.

## Dentist board doğrudan aksiyonları

Dentist board’da (Dentist sayfası) hekim, hastayı Queue’ya gitmeden yönetir:

- **Start treatment / Tedaviyi başlat** — `waiting` / `ready` / `now_serving` satırında görünür; queue durumunu `in_chair` yapar.
- **Finish visit / Ziyareti bitir** — `in_chair` satırında görünür; queue durumunu `served` yapar ve **Finish visit** panelini açar.

Böylece hekim tüm ziyaret döngüsünü tek ekrandan yürütür.

## Finish visit paneli (tek panel checklist)

`Finish visit` artık çok adımlı sihirbaz değil, tek panelde checklist’tir:

- **Clinical note** — notu ekle/imzala (soft, bilgilendirme).
- **Billing & plan** — fatura/plan boşluğu varsa **Needs attention**, yoksa **Ready**.
- **Collect payment** — açık fatura varsa bakiye tutarı gösterilir, yoksa **Clear**.
- **Finish visit** — visit’i kapatır. Açık maddeler varsa engellenmez; **soft-gate** olarak izin verilir ve denetime (audit) yazılır.

## Ekranlar ve sorumluluk

| Adım | Kim | Nerede | Ne olur |
|------|-----|--------|---------|
| Randevu | Reception | Appointments | `scheduled` — geçmiş saate randevu engelli |
| Check-in | Reception | Queue → Check-in kolonu | `check_in_appointment` → visit + queue `waiting`, randevu `checked_in` |
| Kuyruk | Reception | Queue board | Waiting → Ready → Called → In Chair → Treatment done |
| Klinik + ziyaret | Dentist | Dentist board / hasta chart | Start treatment / Finish visit, SOAP, odontogram, plan |
| Faturalama | Billing | Billing | Ödeme → visit kapanışı (toggle) |
| Gün sonu | Owner | Reports → Closeout | Taslak snapshot kilitlemez; **Finalize** kilitle |

## Check-in listesi mantığı

Queue **Check-in** kolonunda görünenler:

- Bugün `scheduled`, `confirmed` veya takılı kalmış `checked_in`
- **Ve** aktif kuyruk kaydı yok (`waiting` \| `ready` \| `now_serving` \| `in_chair`)

`served` veya `cancelled` kuyruk kaydı check-in listesinden düşürür.

## Workflow toggle’ları (Settings → Workflow)

- `auto_checkin_updates_appointment` — check-in’de randevu `checked_in`
- `consent_gate_checkin` — imzasız consent check-in’i bloklar
- `auto_served_completes_appointment` — Treatment done’da randevu `completed`
- `auto_served_creates_invoice` — Treatment done’da fatura taslağı
- `auto_close_encounter_on_payment` — tam ödemede visit kapanır

## SQL paketleri (sıra)

1. **`supabase/scripts/APPLY_PATIENT_FLOW_MASTER.sql`** — tek paket (veri onarımı, workflow, check-in, kuyruk, closeout, KPI, completed guard)
2. İsteğe bağlı ek: `supabase/migrations/20260618100000_appointment_complete_queue_guard.sql` (master’ı zaten uyguladıysan gerekmez)
3. Doğrulama: `supabase/scripts/verify_clinic_flow.sql`

Eski parçalı paketler (`apply_clinic_flow_queue_bundle.sql`, `20260618000000_patient_flow_hardening.sql`) master ile birleştirildi.

## 2 dakikalık smoke test

1. Bugün için randevu oluştur → Appointments’ta görünür
2. Queue → Check-in’de görünür → Check in → **Waiting**
3. Dentist board → **Start treatment** → satır **In chair** olur
4. Dentist board → **Finish visit** → Finish visit paneli açılır; checklist (not/fatura/ödeme) görünür
5. Finish visit → visit kapanır; hasta aktif kuyruktan düşer, **Treatment done today** sayacına eklenir
6. Closeout: Save draft faturalamayı kilitlememeli; Finalize kilitlemeli
