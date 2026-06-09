# App Information Architecture

## Ana yüzeyler

```txt
/apps
  /admin-web
  /staff-mobile
  /patient-portal
  /kiosk
  /queue-display
```

## Admin Web Sidebar

### Overview

- Dashboard
- Reports

### Clinical

- Appointments
- Queue
- Waitlist
- Patients
- Dental Charts
- Treatment Records
- Consent Records

### Billing & Finance

- Invoices
- Payments
- HMO Claims
- HMO Providers
- A/R Aging

### Operations

- Inventory
- Notifications
- Compliance

### Administration

- Staff
- Roles & Permissions
- Settings
- Audit Logs

## Mobile Staff App

Bottom tabs:

- Today
- Queue
- Patients
- Chart
- More

Mobile staff app tüm admin özelliklerini taşımamalı. Sahada hızlı işler:

- Bugünkü randevular
- Patient lookup
- Treatment note
- Chart quick update
- Queue status
- Payment balance quick view

## Patient Portal

- Book appointment
- Manage appointment
- Intake form
- Medical history
- Consent signing
- Payment summary
- Clinic information

## Kiosk

- Welcome
- Check in
- New patient intake
- Existing patient lookup
- Medical history update
- Consent signing
- Staff login shortcut

## TV Queue Display

- Now serving
- Waiting patients by code
- Clinic announcements
- Clock
- Reconnect status

## Module boundaries

```txt
/modules
  /auth
  /clinics
  /staff
  /patients
  /medical-history
  /consents
  /dental-chart
  /appointments
  /queue
  /waitlist
  /treatments
  /billing
  /hmo
  /philhealth
  /inventory
  /notifications
  /compliance
  /audit
  /reports
```

## Navigation permission rules

Frontend navigation role'a göre filtrelenebilir, fakat gerçek güvenlik backend permission kontrolüdür.

Örnek:

- Receptionist: appointments, queue, patients, payments limited
- Dentist: patients, charts, treatments, appointments read
- Billing: invoices, payments, HMO claims
- Admin: all

## Route naming

```txt
/admin/dashboard
/admin/appointments
/admin/queue
/admin/waitlist
/admin/patients
/admin/patients/:patientId
/admin/patients/:patientId/chart
/admin/patients/:patientId/treatments
/admin/invoices
/admin/invoices/:invoiceId
/admin/hmo/claims
/admin/hmo/providers
/admin/settings
/kiosk/:clinicSlug
/queue-display/:displayToken
```

## Page header standard

Her admin sayfası şu bilgileri taşımalı:

- Title
- One-line description
- Primary action
- Secondary actions if needed
- Date/filter context if relevant

## Search standard

Arama şu alanları desteklemeli:

- Patient name
- Phone
- Appointment number
- Invoice OR number
- Claim number
- Tooth/procedure keyword where relevant

## Cross-links

Hasta detay sayfasından:

- Appointment oluştur
- Dental chart aç
- Treatment record ekle
- Invoice oluştur
- Consent iste
- HMO claim başlat

Invoice detaydan:

- Patient profile
- Appointment
- Treatment record
- HMO claim
- Payment ledger

Appointment detaydan:

- Check-in
- Start treatment
- Complete
- Generate invoice
- Send reminder
