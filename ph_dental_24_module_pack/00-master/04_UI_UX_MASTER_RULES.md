# 04 — UI/UX Master Rules

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## Ürün hissi

Klinik güveni, düşük gürültü, hızlı okunabilirlik. AI slop kokan “gradient dashboard” yok.

## Layout standardı

```txt
AppShell
 ├─ Sidebar
 └─ Main
    ├─ Topbar with branch switcher
    └─ PageContainer
       ├─ PageHeader
       ├─ ActionBar / FilterBar
       └─ ContentGrid
```

## Zorunlu state seti

Her data component:

- loading
- empty
- error
- ready
- permission denied
- offline/retrying where relevant
- saving/saved/failed for forms

## Component sistemi

- Button
- Card
- MetricCard
- StatusBadge
- DataTable
- FilterBar
- EmptyState
- ErrorState
- FormSection
- DetailDrawer
- ConfirmationDialog
- AuditDrawer
- BranchSwitcher

## Dental-specific components

- FDI Odontogram
- ToothDrawer
- MedicalAlertBanner
- TreatmentPlanBuilder
- PaymentLedger
- ConsentSignaturePad
- QueueDisplayPanel

## Renklerin anlamı

- Teal: primary/brand/safe action
- Blue: information/system
- Green: completed/paid/success
- Orange: pending/warning
- Red: critical/error/blocked
- Gray: inactive/empty/neutral

## Hasta-facing ekran kuralı

Kiosk ve TV ekranlarında şu yasak:

- raw HTTP error
- translation key
- stack trace
- database table name
- full sensitive patient details

Doğru yaklaşım:

```txt
This display is temporarily unavailable. Please check with the front desk.
```

## Data table standardı

- Money columns right-aligned.
- Date columns consistent timezone.
- Status badge text-only meaning + color.
- Row actions in menu.
- Bulk actions permission aware.
