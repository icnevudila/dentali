# Philippines Domain Notes

Bu dosya Filipinler bağlamına özel ürün kararlarını toplar.

## Locale

- Default locale: `en-PH`
- Default timezone: `Asia/Manila`
- Currency: `PHP`
- Currency display: `₱1,000.00`
- Phone format: Filipinler mobil numarası desteklenmeli, fakat input normalize edilmeden gösterimde kullanıcıyı zorlamamalı.

## Dil yaklaşımı

MVP dili İngilizce olabilir. Ancak sistem ileride Tagalog/Filipino ve Türkçe yönetim çevirilerini destekleyecek şekilde kurulmalı.

Önerilen diller:

- `en-PH` default
- `fil-PH` sonraki faz
- `tr-TR` founder/admin iç dokümantasyon için opsiyonel

## Dental chart standardı

Uygulama FDI tooth numbering yaklaşımını desteklemeli:

- Permanent: 11–18, 21–28, 31–38, 41–48
- Primary/temporary: 51–55, 61–65, 71–75, 81–85

Chart UI'da upper/lower, left/right ayrımı kağıt formlara yakın tutulmalı. Kullanıcı “eski formu dijital görüyor” hissini almalı.

## Kağıt formlardan dijitale taşınacak alanlar

### Patient information

- Full name
- Birthdate
- Age
- Sex/gender
- Civil status
- Address
- Contact number
- Email
- Occupation/company
- Guardian info for minors
- Referral source
- Reason for dental consultation

### Medical history

- General health
- Current medical treatment
- Serious illness/surgery
- Hospitalization
- Prescription/non-prescription medication
- Tobacco use
- Alcohol/drug use
- Allergies
- Pregnancy/nursing/birth control pills where applicable
- Blood type
- Blood pressure
- Disease checklist

### Consent

- Treatment consent
- Drugs and medication consent
- Change in treatment plan consent
- Radiograph consent
- Extraction/removal consent
- Crowns/bridges consent
- Endodontics consent
- Periodontal disease consent
- Fillings consent
- Dentures consent
- Patient/guardian signature
- Dentist signature
- Date

### Dental record chart

- Tooth condition
- Restoration/prosthetics
- Surgery/extraction
- X-ray taken
- Periodontal screening
- Occlusion
- Appliances
- TMD notes

### Treatment record

- Date
- Tooth number/s
- Procedure
- Dentist
- Amount charged
- Amount paid
- Balance
- Next appointment

## HMO yaklaşımı

Filipinler dental kliniklerinde HMO/insurance akışı klinikten kliniğe değişebilir. MVP'de provider bazlı claim tracking yeterli:

- HMO provider
- Claim number
- Requested amount
- Approved amount
- Status
- Rejection reason
- Payment date

Başta gerçek entegrasyon değil, operasyonel tracking yap. Entegrasyon gelirse ayrı connector modülü aç.

## PhilHealth yaklaşımı

PhilHealth eClaims dental klinik kapsamına, akreditasyona ve hizmet tipine göre değişebilir. Bu yüzden MVP'de PhilHealth'i opsiyonel modül yap:

- Feature flag ile aç/kapat
- Accredited clinic bilgileri olmadan submit aksiyonu gösterme
- Cipher key ve claim payload güvenli saklama gerektirir
- Gerçek submit öncesi compliance ve local legal/ops doğrulaması şart

## Data Privacy Act yaklaşımı

Philippines Data Privacy Act bağlamında hasta verisi kişisel ve sağlık bilgisi içerir. Ürün şu prensiple tasarlanmalı:

- Minimum necessary data
- Explicit consent
- Role-based access
- Encryption at rest for sensitive fields
- Audit trail
- Data export and access request hazırlığı
- Breach/incident reporting süreci

## Operasyon gerçekliği

Klinikte internet bazen kopar, tablet şarjı biter, reception aynı anda ödeme ve telefonla uğraşır. Bu yüzden:

- Draft kayıtlar autosave olmalı.
- Kiosk offline durumunda sakin hata göstermeli.
- Queue display son başarılı veriyi cache'te tutmalı.
- Payment kaydı atomic olmalı.
- Tedavi notu kaybolmamalı.

## Ürün tonu

Hastaya: sıcak, güvenli, kısa.

Staff'a: hızlı, net, operasyon odaklı.

Admin'e: sayılar, riskler, audit ve kontrol.
