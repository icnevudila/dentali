# UI / UX System

## Ürün hissi

- Klinik güven veren
- Temiz
- Hızlı okunur
- Masa başında 8 saat kullanılabilir
- Tablet/kioskta eli eldivenli kullanıcıya toleranslı
- TV queue ekranında 5 metreden okunabilir

Görsel dil: modern ama steril. Neon startup dashboard değil; klinik önlüğü gibi temiz, keskin ve güvenilir.

## Design tokens

```css
:root {
  --bg: #F6F8FA;
  --surface: #FFFFFF;
  --surface-soft: #F9FAFB;
  --surface-muted: #F2F4F7;
  --border: #E5E7EB;
  --border-strong: #D0D5DD;

  --text: #111827;
  --text-soft: #344054;
  --muted: #667085;
  --muted-2: #98A2B3;

  --primary: #008C8C;
  --primary-hover: #007777;
  --primary-soft: #E6F7F6;

  --success: #12B76A;
  --success-soft: #ECFDF3;

  --warning: #F79009;
  --warning-soft: #FFFAEB;

  --danger: #F04438;
  --danger-soft: #FEF3F2;

  --info: #2E90FA;
  --info-soft: #EFF8FF;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  --shadow-card: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-popover: 0 12px 32px rgba(16, 24, 40, 0.14);
}
```

## Typography

- Font: Inter, Geist veya Manrope
- Page title: `28px / 36px / 700`
- Section title: `18px / 28px / 700`
- Body: `14px / 20px / 400`
- Small: `12px / 18px / 500`
- KPI value: `30px / 38px / 700`
- Table header: `11px / 16px / 700 / uppercase`

## AppShell

```txt
AppShell
 ├─ Sidebar
 └─ Main
    ├─ Topbar
    └─ PageContainer
       ├─ PageHeader
       ├─ PageActions
       └─ PageContent
```

## PageContainer

```css
.page-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 32px 64px;
}
```

## Component rules

### Button

Variants:

- primary
- secondary
- ghost
- danger
- warning
- link

Sizes:

- sm: 32px
- md: 40px
- lg: 48px

Rules:

- Sayfa başına maksimum 1 primary action.
- Danger action confirmation ister.
- Disabled action neden disabled açıklamalı.

### Card

```txt
border: 1px solid var(--border)
radius: 16px
shadow: var(--shadow-card)
padding: 20px / 24px
```

### DataTable

Her tablo desteklemeli:

- loading skeleton
- empty state
- error state
- pagination
- search/filter
- row action menu
- responsive compact mode

Para kolonları sağ hizalı ve tabular number olmalı.

### StatusBadge

Status text kısa olmalı:

- Scheduled
- Checked in
- In chair
- Completed
- Draft
- Issued
- Partial
- Paid
- Submitted
- Approved
- Rejected
- Low stock
- Critical

Renk tek başına anlam taşımaz. Badge içinde metin şart.

## Empty states

Boş ekranlar “bozuk” görünmemeli.

Örnek:

```txt
No patients waiting
Checked-in patients will appear here when they arrive.
[Open appointments]
```

## Error states

Admin:

```txt
Couldn’t load invoices
The server returned an error. Try again.
[Retry]
```

Kiosk/TV:

```txt
This display is temporarily unavailable.
Please ask the front desk for help.
```

## Kiosk UX

- Büyük touch targets: minimum 48px
- Formlar adım adım
- Dil seçimi görünür
- Hasta ekranında teknik hata yok
- Gerekli alanlar net
- Signature capture büyük alan

## TV Queue UX

- Saat: 64px
- Başlık: 48px
- Now serving code: 72px
- Waiting row: 36px
- Bottom ticker: 22px
- Reconnect durumunda son başarılı veri gösterilir

## Accessibility

- Contrast minimum WCAG AA
- Form label her zaman görünür
- Error message field altında
- Keyboard navigation admin panelde çalışmalı
- Kiosk butonları eldivenle dokunmaya uygun olmalı
