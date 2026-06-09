# 06 — Source Notes & Assumptions

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## Kullanılan ürün kaynakları

- Kullanıcının paylaştığı dental clinic kağıt form fotoğrafları.
- Kullanıcının paylaştığı PDA Dental Chart PDF: Patient Information Record, Informed Consent, Dental Record Chart, Treatment Record.
- Daha önce hazırlanan DentQL Full Redesign Package.
- Daha önce hazırlanan PH Dental App UI/UX Master Spec.

## Varsayımlar

- Ürün multi-branch SaaS olacak.
- Backend Supabase olacak.
- Frontend React/Next.js olacak.
- Currency PHP.
- Primary locale en-PH; ileride Tagalog/Türkçe opsiyonel.
- Dental numbering FDI destekleyecek.
- Hasta-facing kiosk/tablet ve TV queue olacak.
- HMO ve PhilHealth modülleri ilk aşamada readiness/tracking, sonra integration hardening.

## Canlı kullanımdan önce doğrulanacaklar

- Philippines Data Privacy Act uygulama detayları.
- HMO provider sözleşme ve reimbursement süreçleri.
- PhilHealth eClaims güncel teknik gereksinimleri.
- Official receipt/tax/accounting gereksinimleri.
- SMS provider compliance ve opt-out kuralları.
