# Modül 08: Consent & Legal Forms

## Backend / Database
- [x] `consent_templates`, `patient_consents` tabloları
- [x] RPC: `lock_signed_consent`
- [x] RPC: `void_patient_consent` (admin only)
- [x] Storage bucket `consent-documents` + RPC `register_signed_consent_pdf`

## UI Bileşenleri
- [x] `ConsentViewer` (view + print + stored export)
- [x] `ConsentSignaturePad` (canvas imza, HiDPI, stroke validation, signer role Q138)
- [x] `buildConsentSignaturePayload` + server JSON validation on `lock_signed_consent` (Q138)
- [x] Admin void panel on signed view
- [x] Org template override admin — `/settings/consent-templates` (Q143)

## Frontend Ekranları
- [x] `/patients/[id]/consents/[formId]` imza + auto storage upload
- [x] `/patients/[id]/consents/[formId]/view` signed export + void

- [x] `/settings/consent-templates` — org override editor (Q143)

## Durum: ✅ MVP entegre + UX polish (2026-06-12)

### UX polish (2026-06-12)
- [x] Klinik letterhead (`ConsentDocumentHeader`) — staff sign, public `/sign/[token]`, signed view
- [x] Uzun legal metin accordion (`<details>`) — 280+ karakter paragraph alanları
- [x] `buildConsentBodySnapshot` — imza anında narrative + cevaplar tek snapshot
- [x] `ConsentSignedDocument` — yapılandırılmış read-only görünüm, print/PDF
- [x] Public sign akışı staff ile aynı `ConsentDocumentContent` bileşeni
- [x] Template admin preview — `{{patient_name}}` vb. örnek değişkenler
- [x] HTML arşiv export — alan cevapları + signer role
