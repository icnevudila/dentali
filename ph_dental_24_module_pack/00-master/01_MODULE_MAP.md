# 01 — 24 Module Map

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

| No | Module | Purpose | Primary phase |
|---:|---|---|---|
| 01 | Organization & Multi-Branch | Marka/organizasyon ve her klinik şubesinin veri sınırlarını, ayarlarını, branch switcher deneyimini ve multi-tenant güvenlik modelini kurar. | MVP Foundation |
| 02 | Auth, Roles & Permissions | Supabase Auth, role map, permission guards, session güvenliği ve RLS uyumlu erişim katmanını kurar. | MVP Foundation |
| 03 | Staff & Team Management | Dentist, receptionist, billing staff ve asistanların ekip yönetimi, branch ataması, statü ve audit takibini sağlar. | MVP Foundation |
| 04 | Settings & Configuration | Clinic profile, branch ayarları, currency, timezone, kiosk token, notification templates ve security seçeneklerini yönetir. | MVP Foundation |
| 05 | Patient Registry | Hastaların organization-level kaydını, iletişim bilgilerini, duplicate detection ve branch visit geçmişini yönetir. | MVP Clinical Core |
| 06 | Patient Intake | Yeni hasta kayıt formunu kağıttaki patient information mantığından dijitale taşır: kişisel bilgiler, emergency contact, insurance, referral ve reason for consultation. | MVP Clinical Core |
| 07 | Medical History | Kağıt formlardaki medical history, allergies, medications, pregnancy, conditions ve risk uyarılarını dijital klinik karara dönüştürür. | MVP Clinical Core |
| 08 | Consent & Legal Forms | Informed consent, treatment consent, data privacy consent ve imza süreçlerini dijital, saklanabilir ve denetlenebilir hale getirir. | MVP Clinical Core |
| 09 | Dental Chart / Odontogram | PDA dental chart / FDI tooth numbering mantığını dijital odontogram, tooth condition, restorations, surgery codes ve treatment önerilerine çevirir. | MVP Clinical Core |
| 10 | Treatment Plan | Dental chart bulgularından planlanan procedure listesi, öncelik, tahmini fiyat, hasta onayı ve invoice dönüşümünü yönetir. | MVP Clinical Core |
| 11 | Clinical Notes & Visit Timeline | Her visit için SOAP/clinical notes, attachments, x-ray refs, timeline ve treatment outcome kayıtlarını tutar. | Phase 2 Clinical Depth |
| 12 | Orthodontic Treatment Record | Kağıt orthodontic treatment record akışını dijital case, adjustment log, next procedure/date, payment/balance bağlantısıyla yönetir. | Phase 2 Specialty |
| 13 | Appointments | Branch bazlı randevu takvimi, dentist availability, status flow ve check-in’e dönüşüm akışını yönetir. | MVP Operations |
| 14 | Waitlist | Slot açıldığında hastaları preference, urgency ve sıraya göre çağırmayı ve appointmenta çevirmeyi sağlar. | Phase 2 Operations |
| 15 | Check-in & Queue | Front desk check-in, waiting/in chair/served statusları, now serving ve realtime queue operasyonunu yönetir. | Phase 2 Operations |
| 16 | Kiosk / Patient Tablet | Hasta tabletinden check-in, intake, booking request ve staff login ayrımını güvenli şekilde sunar. | Phase 2 Patient Facing |
| 17 | TV Queue Display | Bekleme salonunda now serving ve waiting listesini uzaktan okunur, güvenli, realtime/refresh destekli gösterir. | Phase 2 Patient Facing |
| 18 | Notifications / SMS | Appointment reminders, waitlist SMS, payment reminders ve sistem mesajlarını template/log/retry ile yönetir. | Phase 2 Operations |
| 19 | Procedure Catalog & Pricing | Procedure catalog, dental codes, tooth requirement, branch price overrides ve treatment/invoice fiyat kaynağını yönetir. | MVP Billing Support |
| 20 | Invoices, Payments & Ledger | Treatment itemlarından invoice oluşturma, ödeme kaydı, balance, void/refund ve branch revenue ledgerını yönetir. | MVP Billing Core |
| 21 | HMO Claims | HMO provider reimbursement sürecini draft, submitted, under review, approved, rejected, paid state machine ile yönetir. | Phase 2 Billing |
| 22 | PhilHealth / eClaims Readiness | PhilHealth/eClaims için readiness checklist, claim metadata, documents, encryption/payload referansları ve sync log altyapısını hazırlar. | Phase 3 Compliance/Risk |
| 23 | Inventory & Supplies | Dental supplies, medication/material stock, low stock, expiry, movement ledger ve reorder suggestion yönetimi sağlar. | Phase 2 Operations Control |
| 24 | Compliance, Audit & Reports | Sterilization/compliance logs, audit trail, operational reports, financial reports ve branch/organization analytics merkezidir. | MVP Audit + Phase 2 Reports |

## Dependency rules

- Foundation modülleri olmadan clinical modüller başlamaz.
- Patient Registry olmadan Appointments/Invoices anlamlı çalışmaz.
- Dental Chart olmadan Treatment Plan klinik bağlamını kaybeder.
- Treatment Plan olmadan Invoice item provenance zayıflar.
- Audit bütün kritik modüllere yatay bağlıdır.
