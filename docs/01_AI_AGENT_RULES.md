# AI Agent Rules

Bu dosya Cursor, Claude Code, ChatGPT, Devin veya başka bir AI coding agent için çalışma kurallarıdır. Repo kökünde tutulmalı ve her task başlamadan okunmalıdır.

## 1. Ürün gerçeği

Bu uygulama dental klinik operasyon sistemi olacak. Hasta bilgisi, ödeme bilgisi, medikal geçmiş ve tedavi notu tutar. Bu yüzden frontend oyuncağı gibi davranma. Güvenlik, audit ve veri doğruluğu tasarımın parçasıdır.

## 2. Kod yazma kuralları

- TypeScript strict kullanılmalı.
- `any` yasak; gerekirse `unknown` + parse/validation kullan.
- API payload'ları Zod veya benzeri schema ile validate edilmeli.
- Business logic component içine gömülmemeli.
- Her modül şu ayrımı korumalı:
  - UI component
  - form schema
  - API client
  - domain types
  - service/use-case
  - repository/db access
- Büyük dosya yazma. 300 satırı geçen dosya parçalanmalı.
- Tarih/saat hesaplarında `Asia/Manila` varsayılan timezone olarak düşünülmeli.
- Para değerleri PHP centavo/sentimo hassasiyetiyle saklanmalı. Float ile muhasebe yapılmaz.

## 3. UI kuralları

Her data ekranında şu state'ler olmak zorunda:

- loading
- empty
- error
- ready

Kural:

- Raw backend error patient-facing ekranda gösterilmez.
- Kiosk ve TV Queue ekranlarında `HTTP 503`, stack trace, translation key, `undefined` görünemez.
- Sayfa başına bir tane ana primary action olur.
- Destructive action confirmation ister.
- Para kolonları sağ hizalanır.
- Status renkleri tek başına anlam taşımaz; metin badge içinde görünür.

## 4. Backend kuralları

- Backend permission kontrolü olmadan frontend menü gizleme güvenlik sayılmaz.
- Her kritik işlem audit log'a yazılır.
- API response formatı standart olmalı.
- State transition backend'de korunmalı.
- Patient, invoice, claim, payment, consent, chart değişiklikleri auditlenmeli.
- Kiosk token read/write scope'u dar olmalı.
- Queue display token read-only olmalı.

## 5. Privacy kuralları

- Gerçek hasta verisi test seed içine koyma.
- Log içine phone, email, address, medical note, raw claim payload yazma.
- Error monitoring'de PHI/PII maskelenmeli.
- Consent ve medical history soft-delete bile olsa auditli tutulmalı.
- Upload edilen consent/dental record dosyaları private bucket'ta saklanmalı.

## 6. i18n kuralları

- Kullanıcıya translation key gösterme.
- Her translation çağrısında fallback text olmalı.

Örnek:

```ts
const label = t('appointments.new', 'New appointment')
```

Kötü:

```tsx
<Button>{t('common.save')}</Button>
```

## 7. Done definition

Bir task tamamlandı sayılması için:

- Type check geçmeli.
- Unit test veya en az smoke test eklenmeli.
- Loading/empty/error state tamamlanmalı.
- Permission kontrolü varsa backend'de uygulanmalı.
- Audit gerekiyorsa event yazılmalı.
- Mobil/tablet kırılımı kontrol edilmeli.
- Accessibility temel kontroller yapılmalı.

## 8. Agent'a yasak olan şeyler

- Kullanıcıdan izin almadan tech stack değiştirme.
- Var olan data modelini bozacak migration'ı açıklamasız yazma.
- Raw SQL ile PII dump alma.
- Dummy olarak gerçek hastaya benzeyen kişisel veri üretme.
- Tek committe devasa refactor yapma.

## 9. Kod üretirken öncelik sırası

1. Güvenli veri modeli
2. Net business rule
3. Testlenebilir backend
4. Basit ve okunur UI
5. Sonra animasyon, polish, süs püs

Ürün klinikte 8 saat kullanılacak. Aşırı havalı ama yavaş ekran, bekleme salonunda 503 gösteren TV kadar trajikomiktir.
