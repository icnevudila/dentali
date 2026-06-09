# Page by Page Requirements

## Dashboard

Purpose: “Bugün klinikte ne oluyor?” sorusuna 3 saniyede cevap.

KPI cards:

- Today’s appointments
- Waiting now
- In chair
- Payments collected
- Outstanding balance
- Pending HMO claims

Sections:

- Today schedule
- Queue status
- Action center
- Billing snapshot
- Alerts

Primary action: `New appointment`

## Appointments

Purpose: Receptionist hızlı randevu oluşturur ve doktor/chair zamanını görür.

Features:

- Day/week/month view
- Dentist filter
- Chair filter optional
- Drag/reschedule optional v2
- Appointment drawer
- Check-in action
- Complete action
- No-show action

## Queue

Purpose: Check-in olmuş hastaları yönetmek.

Columns:

- Code
- Patient
- Appointment time
- Waiting time
- Status
- Chair/dentist
- Actions

Actions:

- Call
- Mark in-chair
- Complete
- Remove

## Waitlist

Purpose: İptal boşluklarını hızlı doldurmak.

Columns:

- Patient
- Phone
- Preferred date/time
- Urgency
- Queued since
- Status
- Actions

## Patients list

Purpose: Hasta arama ve hızlı profil erişimi.

Columns:

- Name
- Phone
- Last visit
- Open balance
- HMO
- Status
- Actions

Search:

- Name
- Phone
- OR number
- Appointment code

## Patient detail

Tabs:

- Overview
- Medical History
- Dental Chart
- Treatments
- Appointments
- Invoices
- Consents
- Documents
- Audit

Header actions:

- New appointment
- Add treatment
- Create invoice
- Request consent

## Medical History

Purpose: Kağıt formu dijital, versiyonlu ve okunur hale getirmek.

UI:

- Sectioned questionnaire
- Yes/no segmented controls
- Conditional note fields
- Conditions checklist
- Blood type / blood pressure
- Reviewed by dentist

## Dental Chart

Purpose: Odontogram üzerinden tooth-level kayıt.

UI:

- Permanent and temporary teeth layout
- Tooth condition legend
- Tooth drawer
- Surface selector
- Restoration/prosthetic selector
- Surgery selector
- Notes
- Version history

## Treatment Records

Purpose: Klinik ve ödeme geçmişini tek tabloda göstermek.

Columns:

- Date
- Tooth no/s
- Procedure
- Dentist
- Amount charged
- Amount paid
- Balance
- Next appointment

## Invoices

Purpose: Resmi receipt, ödeme ve bakiye takibi.

KPI:

- Invoices
- Billed
- Collected
- Outstanding

Columns:

- OR No
- Patient
- Issued date
- Total
- Paid
- Balance
- Status
- Actions

## Invoice detail

Left:

- Patient summary
- Invoice items
- Payment ledger
- Notes
- Audit trail

Right sticky panel:

- Balance summary
- Add payment
- HMO claim link
- Print/send/void

## HMO Claims

Purpose: HMO geri ödeme sürecini takip etmek.

Columns:

- Claim no
- Patient
- Provider
- Requested
- Approved
- Status
- Age
- Actions

Runbook:

- Submit drafts
- Follow up aging claims
- Record approved payments

## HMO Providers

Columns:

- Provider
- Code
- Contact
- Email
- SLA days
- Status
- Actions

## Reports

Reports:

- Daily collections
- Outstanding balances
- No-show rate
- Revenue by procedure
- HMO aging
- Patient visits
- Dentist productivity

## Kiosk

Cards:

- Check in for appointment
- New patient intake
- Update medical history
- Staff workstation

Rules:

- Huge buttons
- Simple language
- Session timeout
- Safe error state

## Queue Display

Sections:

- Now serving
- Waiting
- Clock
- Clinic announcement ticker

Do not show raw patient medical or financial data.

## Settings

Tabs:

- Clinic profile
- Hours
- Staff
- Roles
- Kiosk
- Queue display
- Notifications
- Billing
- Security

## Audit Logs

Filters:

- User
- Entity type
- Date range
- Action

Columns:

- Time
- Actor
- Action
- Entity
- Reason
- IP/device
