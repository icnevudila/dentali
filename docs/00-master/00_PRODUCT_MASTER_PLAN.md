# 00 — Product Master Plan

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## Net ürün tanımı

Bu ürün bir “appointment app” değildir. Doğru tanım:

**Philippines-based, multi-branch dental clinic operating system.**

Ürün; hasta kayıtları, dental chart, treatment plan, randevu, queue, kiosk, invoice, HMO/PhilHealth hazırlığı, inventory, compliance, audit ve raporlamayı tek veri modeli altında birleştirir.

## Ana ürün ilkeleri

1. Multi-branch en baştan gelir, sonradan patch değildir.
2. Patient organization-level, visit/invoice/queue branch-level tutulur.
3. Supabase RLS tüm güvenliğin omurgasıdır.
4. UI kağıt dental formların mantığını korur ama dijital hız ve denetim ekler.
5. Her kritik değişiklik audit log yazar.
6. Hasta-facing ekranlar teknik hata göstermez.
7. Billing ayrı ledger ile çalışır; invoice içinde sadece toplam sayı saklayıp geçilmez.
8. Dental chart FDI standardı ile kalıcı ve süt dişlerini destekler.

## MVP çekirdeği

MVP için ilk teslimat:

- Organization & Multi-Branch
- Auth, Roles & Permissions
- Staff & Team
- Settings
- Patient Registry
- Patient Intake
- Medical History
- Consent Forms
- Dental Chart / Odontogram
- Treatment Plan
- Appointments
- Invoices, Payments & Ledger

## Phase 2

- Clinical Notes & Timeline
- Orthodontic Record
- Waitlist
- Check-in & Queue
- Kiosk
- TV Queue Display
- Notifications/SMS
- Procedure Catalog advanced
- HMO Claims
- Inventory
- Compliance & Reports

## Phase 3

- PhilHealth / eClaims readiness and integration hardening

## Product risk list

- RLS eksikleri multi-branch veri sızıntısı yaratır.
- PhilHealth/HMO state machine yanlışsa finansal/veri riski doğar.
- Invoice/payment ledger zayıfsa muhasebe çöp olur.
- Dental chart versioning yoksa klinik sorumluluk belirsizleşir.
- Kiosk public token geniş yetki alırsa PHI riski doğar.
