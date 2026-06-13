# Modül 13: Appointments

## Backend / Database
- [x] `appointments` tablosu
- [x] `provider_availability` tablosu + RPCs
- [x] RPC: `get_available_appointment_slots`
- [x] RPC: `ensure_provider_availability_defaults`
- [x] RPC: `create_appointment_validated`
- [x] RPC: `check_in_appointment`
- [x] RPC: `get_day_schedule`
- [x] RPC: `reschedule_appointment` (Q136)
- [x] RPC: `mark_appointment_no_show` + audit log (Q145)

## Edge Functions
- [x] `send-appointment-reminder` (SMS stub, dry-run aware)
- [x] `daily-reminder-cron` (tomorrow appointments batch, CRON_SECRET)

## UI Bileşenleri
- [x] `AppointmentWeekCalendar` (haftalık takvim)
- [x] Day view — tarih navigasyonu, özet badge'ler, "Up next", check-in + SMS reminder
- [x] `ProviderAvailabilityPanel` + slot picker on book form

## Frontend Ekranları
- [x] `/appointments` sayfası (week + day + provider slots)
- [x] **Drag-reschedule** — `reschedule_appointment` RPC, haftalık takvimde sürükle-bırak (Q136)
- [x] **Provider availability bulk edit** — `bulk_upsert_provider_availability` RPC, weekly editor (Q141)
- [x] **No-show workflow** — mark no-show action + waitlist slot notify (Q145)
- [x] Day view summary includes `no_show` count (Q145)

## Durum: ✅ MVP entegre (Q079, Q083, Q087–Q089, Q095, Q145 no-show)
