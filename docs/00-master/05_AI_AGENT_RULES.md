# 05 — AI Agent Rules

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## Non-negotiable rules

1. Modül MD'sini okumadan kod yazma.
2. Bu dosyada olmayan component pattern uydurma.
3. Supabase RLS varsayımı yapma; explicit policy veya RPC belirt.
4. Hasta verisini mock bile olsa gerçek kişisel veriyle doldurma.
5. Loading/empty/error/permission state olmadan ekran teslim etme.
6. Financial state transition frontend-only yapılmaz.
7. Dental chart update audit olmadan olmaz.
8. Kiosk/TV raw error göstermez.
9. Branch scope tüm queries'de görünür olmalı.
10. Her yeni tablo için organization_id/branch_id kararını açıkla.

## Uygulama sırası

```txt
1. Read master rules
2. Read module MD
3. Produce component tree
4. Produce Supabase table/RLS/RPC plan
5. Produce UI states
6. Write code
7. Add tests
8. List spec deviations
```

## Kod üretmeden önce cevap formatı

Agent önce şunu yazmalı:

```txt
Module:
Screens:
Components:
Tables:
RLS policies:
RPC/Edge functions:
States covered:
Risks:
```

Onay sonrası kod.

## Red flags

- “Modern dashboard” ama klinik akış yok.
- Branch ID sadece frontend filter olarak kullanılmış.
- Patient data public storage içinde.
- Payment sadece invoice.paid_amount update ediyor, ledger yok.
- Consent signature image public URL ile tutuluyor.
- Role UI'da gizlenmiş ama backend policy yok.
