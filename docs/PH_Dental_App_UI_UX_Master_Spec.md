# Philippines Dental App — UI/UX Master Spec

**Version:** 1.0  
**Product type:** Dental clinic operations, patient intake, appointment, queue, treatment charting, billing, HMO/PhilHealth-ready SaaS  
**Backend decision:** Supabase-first backend  
**Primary market:** Philippines dental clinics  
**Primary interface language:** English first, Filipino/Tagalog-ready, Turkish internal notes optional  
**Design goal:** Calm, clinical, fast, trustworthy. No demo-dashboard vibes. No AI slop.

---

## 0. Non-negotiable position

This product is not “a dentist app with cute cards.” It is an operations system for a real clinic where staff handle patient records, dental charts, consent, payments, queues, appointments, inventory, HMO claims, and potentially PhilHealth-related records.

The UI must feel like a clinic’s working table became digital: structured, calm, traceable, and impossible to confuse when the waiting room is full.

The product must avoid the usual AI-generated SaaS mistakes:

- Random gradients with no purpose.
- Generic KPI cards that do not create action.
- Fake charts that are visually busy but operationally useless.
- Inconsistent spacing, border radius, colors, and font sizes.
- Tables with no loading, empty, or error states.
- Medical forms that look pretty but miss real fields.
- Dental charts that ignore actual tooth numbering workflows.
- Payment records that cannot be audited.
- Kiosk screens that show raw technical errors.
- Backend assumptions that break under Supabase Row Level Security.

The app must be designed like a real clinical tool first, then made beautiful. Beauty without workflow is just a screensaver with buttons.

---

## 1. Source context from clinic photos and dental forms

The uploaded clinic photos show several important realities:

1. Many Philippine dental clinics still rely on paper dental records, payment cards, treatment ledgers, and orthodontic treatment sheets.
2. Staff handle stacks of records manually, often during active treatment sessions.
3. Orthodontic records need repeated visits, procedure notes, payments, balances, and next appointment tracking.
4. Paper dental charts include patient information, medical history, informed consent, intraoral examination, tooth charting, legend codes, treatment records, and signatures.
5. A mobile/kiosk app is already conceptually present in the reference images: appointment booking, queue management, treatment planning, bill/HMO claims, patient records, billing, and support.

The UI must therefore respect paper habits while improving speed, search, safety, and auditability. Do not fight the clinic’s workflow; digitize it with discipline.

---

## 2. Product personality

### 2.1 Personality keywords

- Clinical
- Organized
- Filipino clinic-friendly
- Trustworthy
- Fast
- Ledger-aware
- Low-drama
- Audit-ready
- Patient-safe
- Staff-friendly

### 2.2 What the product should feel like

A receptionist should open the app and instantly understand:

- Who is waiting.
- Who is next.
- Which appointment is late.
- Which patient owes money.
- Which treatment record needs updating.
- Which HMO claim is stuck.
- Which inventory item is dangerously low.

A dentist should open the patient profile and instantly understand:

- Chief complaint.
- Medical risks.
- Allergies.
- Tooth condition.
- Treatment history.
- Current orthodontic/treatment plan.
- Next procedure.
- Clinical notes.

A patient using kiosk/mobile should instantly understand:

- How to check in.
- How to book.
- How much they owe.
- What the clinic needs from them.

### 2.3 What the product must never feel like

- Crypto dashboard.
- Random startup template.
- Hospital ERP from 2009.
- Toy appointment app.
- Pretty but useless Dribbble shot.
- AI-generated “dentist dashboard” with fake charts and vibes only.

---

## 3. User roles and UX priority

### 3.1 Super Admin / Owner

Main jobs:

- Manage clinic profile.
- Manage staff and permissions.
- Review financial reports.
- Review audit logs.
- Configure HMO providers.
- Configure kiosk and queue display.
- Oversee data security.

UX priority:

- Visibility and control.
- Fewer clicks for high-level status.
- Strong confirmation before destructive actions.

### 3.2 Dentist / Orthodontist

Main jobs:

- View daily patients.
- Open patient charts.
- Update diagnosis and treatment notes.
- Mark tooth conditions.
- Review medical history.
- Set next procedures.
- Record clinical completion.

UX priority:

- Fast chart access.
- Big readable patient header.
- Clinical notes that do not feel like accounting forms.
- Tooth chart interactions that are precise.

### 3.3 Receptionist

Main jobs:

- Book appointments.
- Check in patients.
- Manage queue.
- Search patients.
- Update contact details.
- Collect payments.
- Print/send records.

UX priority:

- Speed.
- Keyboard-friendly search.
- Clear queue state.
- Minimal navigation switching.

### 3.4 Billing Staff

Main jobs:

- Create invoices.
- Record payments.
- Track balances.
- Manage HMO claims.
- Export reports.

UX priority:

- Ledger clarity.
- Peso formatting.
- Balance visibility.
- Audit trail.

### 3.5 Patient / Kiosk User

Main jobs:

- Check in.
- Fill/update patient info.
- Confirm consent.
- View appointment/payment status if allowed.

UX priority:

- Large touch targets.
- Plain language.
- No technical errors.
- Minimal typing.

---

## 4. No-AI-Slop design rules

These rules are mandatory. If a screen violates them, redesign it.

### 4.1 Layout rules

1. Every screen must have one primary purpose.
2. Every screen must have one obvious primary action.
3. Content width must be controlled; do not stretch forms across 1920px.
4. Tables must be readable before being pretty.
5. Do not place cards just to fill space.
6. Related actions must stay near the content they affect.
7. Never hide critical actions only inside hover states.
8. Navigation must not change position between screens.
9. Empty states must teach the next action.
10. Error states must be human-readable.

### 4.2 Visual rules

1. Use color for meaning, not decoration.
2. Teal is the primary brand/action color.
3. Red is only for dangerous, rejected, overdue, or failed states.
4. Orange is for warning/pending/attention.
5. Green is for completed/paid/approved/safe.
6. Blue is for information, integration, and neutral system states.
7. Shadows must be subtle. Heavy shadows make the app look cheap.
8. Gradients are prohibited unless specifically approved for marketing pages.
9. Icons must support labels, not replace them.
10. Do not use emoji in clinical/admin UI.

### 4.3 Content rules

1. No Lorem Ipsum.
2. No fake-sounding metrics.
3. No vague CTA like “Manage” when the real action is “Record payment.”
4. Use clinic language: patient, appointment, treatment, tooth, balance, claim, queue.
5. Use short table labels.
6. Use clear status names.
7. All user-facing copy must have i18n fallback.
8. Patient-facing screens must use simpler language than staff screens.
9. Technical error details must not appear on kiosk or TV displays.
10. Medical/legal consent copy must be final-reviewed before launch.

### 4.4 Data rules

1. UI must never assume data exists.
2. Every Supabase query area needs loading, empty, error, and ready states.
3. Money must always show currency.
4. Dates must use Philippine-friendly formatting.
5. Patient names must be searchable but privacy-protected in shared screens.
6. Queue screens should use patient codes or masked names, not full names by default.
7. All critical changes must be auditable.
8. Role permissions must affect navigation, actions, and backend access.
9. Frontend hiding is not security.
10. Supabase RLS is part of the UX contract, not a backend afterthought.

---

## 5. Supabase-first UI/UX implications

Backend is Supabase. That choice changes UI/UX expectations.

### 5.1 Supabase services used by the product

- Supabase Auth for staff login and session management.
- PostgreSQL as source of truth.
- Row Level Security for clinic-scoped and role-scoped access.
- Supabase Storage for uploaded consent forms, dental photos, x-rays, attachments, and signed documents.
- Supabase Realtime for queue updates, appointment status updates, and possibly notification logs.
- Supabase Edge Functions for privileged workflows such as SMS sending, HMO/PhilHealth integrations, payment webhooks, PDF generation, and server-side validation.
- Supabase migrations for schema versioning.
- Generated TypeScript types for safer frontend development.

### 5.2 UI states required because of Supabase

Every data surface must support:

```txt
loading
empty
error
ready
stale
reconnecting
permission_denied
```

Permission-denied is not the same as empty.

Bad:

```txt
No invoices found.
```

Good:

```txt
You do not have access to billing records.
Ask an admin if this looks wrong.
```

### 5.3 Realtime rules

Realtime is useful for:

- Queue display.
- Check-in status.
- Appointment status updates.
- Staff dashboard refresh.
- Notification delivery logs.

Realtime is not a magic wand. The UI must still handle reconnect, stale data, and fallback polling.

Queue screens must show:

```txt
Live
Reconnecting...
Last updated 2 min ago
```

### 5.4 RLS-aware design rules

Because Supabase RLS can block rows silently depending on policies, the UI must distinguish:

- No data exists.
- User has no permission.
- Filter hides the data.
- Network/API failed.
- Session expired.

Each case needs a different message.

### 5.5 Storage-aware design rules

Attachments must show:

- File type.
- Upload status.
- Upload progress.
- Permission status.
- Virus/security scan status if implemented.
- Linked entity: patient, appointment, invoice, claim, consent.

Do not show raw bucket paths to users.

### 5.6 Edge Function UX rules

For actions handled by Edge Functions:

- Show an explicit pending state.
- Prevent double-submit.
- Return a human-readable result.
- Log technical details in audit/system logs.
- Allow retry when safe.

Examples:

- Send SMS reminder.
- Generate PDF record.
- Submit claim.
- Validate claim payload.
- Create signed upload URL.

---

## 6. Information architecture

### 6.1 Main navigation

```txt
Dashboard
Appointments
Queue
Patients
Dental Chart
Treatments
Billing
HMO Claims
Reports
Inventory
Documents
Notifications
Staff
Settings
Kiosk
TV Display
Audit Logs
```

### 6.2 Navigation groups

```txt
Overview
- Dashboard
- Reports

Front Desk
- Appointments
- Queue
- Patients
- Kiosk
- TV Display

Clinical
- Dental Chart
- Treatments
- Orthodontic Records
- Documents

Finance
- Billing
- Payments
- HMO Claims

Operations
- Inventory
- Notifications

Admin
- Staff
- Settings
- Audit Logs
```

### 6.3 Sidebar behavior

Desktop:

- Expanded width: 260px
- Collapsed width: 72px
- Active item uses left border + light teal background
- Icons 20px
- Text 14px
- Group labels 11px uppercase

Mobile/tablet:

- Sidebar becomes drawer.
- Bottom navigation may be used only for patient/kiosk mobile, not staff admin unless heavily simplified.

### 6.4 Route naming

Use clear product routes:

```txt
/dashboard
/appointments
/queue
/patients
/patients/:patientId
/patients/:patientId/chart
/patients/:patientId/treatments
/billing/invoices
/billing/payments
/hmo/claims
/inventory
/reports
/documents
/settings
/kiosk/:clinicSlug
/tv/:displayToken
```

---

## 7. App shell

### 7.1 Admin app shell

```txt
AppShell
├── Sidebar
├── Topbar
│   ├── Clinic switcher
│   ├── Global search
│   ├── Today status
│   ├── Notifications
│   └── User menu
└── Main
    ├── PageHeader
    ├── PageToolbar optional
    └── PageContent
```

### 7.2 Topbar rules

Topbar height:

```txt
64px desktop
56px tablet
```

Topbar must include:

- Current clinic.
- Global patient search.
- User/role.
- Notification icon.
- Connection state if degraded.

Global search placeholder:

```txt
Search patient, phone, OR no., appointment...
```

### 7.3 Page header pattern

Each page uses:

```txt
Title
Short description
Primary action
Secondary actions optional
```

Example:

```txt
Appointments
Schedule visits, manage chair time, and check patients in.
[+ New Appointment]
```

### 7.4 Page container

```css
.page-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 32px 64px;
}
```

For data-heavy pages, max width may be:

```txt
1440px
```

Do not use full viewport width by default.

---

## 8. Visual design system

### 8.1 Color tokens

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
  --primary-active: #005F5F;
  --primary-soft: #E6F7F6;
  --primary-border: #A7E4E0;

  --success: #12B76A;
  --success-soft: #ECFDF3;
  --success-border: #ABEFC6;

  --warning: #F79009;
  --warning-soft: #FFFAEB;
  --warning-border: #FEDF89;

  --danger: #F04438;
  --danger-soft: #FEF3F2;
  --danger-border: #FECDCA;

  --info: #2E90FA;
  --info-soft: #EFF8FF;
  --info-border: #B2DDFF;

  --purple: #7A5AF8;
  --purple-soft: #F4F3FF;

  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-full: 999px;

  --shadow-card: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-popover: 0 12px 32px rgba(16, 24, 40, 0.14);
}
```

### 8.2 Color usage

Primary teal:

- Primary button.
- Active navigation.
- Main progress indicator.
- Patient-safe positive neutral accent.

Green:

- Paid.
- Completed.
- Approved.
- Available.
- Passed compliance.

Orange:

- Pending.
- Waiting.
- Partial payment.
- Low stock.
- Needs attention.

Red:

- Failed.
- Rejected.
- Critical.
- Overdue.
- Void.
- Allergy warning.

Blue:

- Information.
- Integration.
- Submitted claim.
- Realtime/system status.

Gray:

- Draft.
- Disabled.
- Cancelled.
- Archived.

### 8.3 Typography

Recommended fonts:

```txt
Inter
Geist
Manrope
```

Use one font family for the app. No mixing unless marketing site requires it.

Type scale:

```txt
Display / TV patient code: 64-72px / 700
Page title: 28px / 36px / 700
Section title: 18px / 28px / 700
Card title: 14px / 20px / 700
Body: 14px / 20px / 400
Body medium: 14px / 20px / 500
Small: 12px / 18px / 500
Tiny label: 11px / 16px / 700 uppercase
KPI value: 30px / 38px / 700
Table header: 11px / 16px / 700 uppercase
```

### 8.4 Spacing scale

Use an 8px grid.

```txt
4px  micro gap
8px  tight gap
12px field internal gap
16px card internal groups
20px compact card padding
24px standard card padding
32px section gap
48px major page gap
64px page bottom padding
```

### 8.5 Border radius

```txt
Inputs: 10px
Buttons: 10px
Cards: 16px
Modals: 18px
Badges: full pill or 8px depending style
```

### 8.6 Shadows

Cards:

```txt
border + extremely subtle shadow
```

Modals/popovers:

```txt
clear shadow, but not dramatic
```

No glassmorphism. No neon. The clinic is not inside a spaceship.

---

## 9. Component system

### 9.1 Button

Variants:

```txt
primary
secondary
ghost
danger
warning
link
```

Sizes:

```txt
sm: 32px height
md: 40px height
lg: 48px height
kiosk: 56px height minimum
```

Rules:

- One primary button per page header.
- Destructive actions require confirmation.
- Loading button must keep same width where possible.
- Disabled buttons need tooltip or nearby explanation when reason is not obvious.

Labels must be action-specific:

Bad:

```txt
Submit
Manage
Proceed
```

Good:

```txt
Create appointment
Record payment
Submit HMO claim
Check in patient
```

### 9.2 Input

Input states:

```txt
default
focused
filled
error
disabled
readonly
loading
```

Input rules:

- Labels always visible.
- Placeholder is not a label.
- Required fields marked with text or asterisk.
- Errors appear under field.
- Phone field must support PH numbers.
- Currency fields must show ₱.
- Date fields must be keyboard and picker friendly.

### 9.3 Select / Combobox

Use combobox for:

- Patient search.
- Dentist search.
- Procedure search.
- HMO provider search.

Use simple select for:

- Status.
- Gender.
- Role.
- Payment method.

### 9.4 Card

Card anatomy:

```txt
Header optional
Title
Subtitle optional
Content
Footer/actions optional
```

Card style:

```txt
background: white
border: 1px solid var(--border)
radius: 16px
padding: 20-24px
shadow: var(--shadow-card)
```

Rules:

- Do not put a card inside a card unless visually necessary.
- Do not make every metric colorful.
- Use icons only when they improve scanning.

### 9.5 MetricCard

Required fields:

```txt
title
value
supportingText
status optional
trend optional
action optional
```

Examples:

```txt
Waiting Now
4
Avg wait 18 min
```

```txt
Outstanding Balance
₱18,500.00
Across 7 active patients
```

### 9.6 StatusBadge

Status badge must always include text.

Appointment statuses:

```txt
Scheduled
Confirmed
Checked in
In chair
Completed
Cancelled
No-show
```

Invoice statuses:

```txt
Draft
Issued
Partial
Paid
Void
Refunded
```

Claim statuses:

```txt
Draft
Submitted
Under review
Approved
Rejected
Paid
Cancelled
```

Inventory statuses:

```txt
OK
Low
Critical
Expiring soon
Expired
```

### 9.7 DataTable

Mandatory features:

```txt
loading skeleton
empty state
error state
pagination
search/filter support
row actions
keyboard focus
responsive compact mode
```

Column alignment:

```txt
Text: left
Date: left
Status: left or center
Money: right
Numbers: right
Actions: right
```

Row density:

```txt
Standard row height: 56px
Compact row height: 44px
Kiosk/TV: not table-first
```

### 9.8 EmptyState

Props:

```txt
icon
title
description
primaryAction
secondaryAction optional
```

Examples:

```txt
No patients in queue
Checked-in patients will appear here.
[Check in patient]
```

```txt
No treatment records yet
Start by adding today’s procedure or opening the dental chart.
[Add treatment]
```

### 9.9 ErrorState

Admin example:

```txt
Couldn’t load invoices
The server returned an error. Try again.
[Retry]
```

Kiosk example:

```txt
This screen is temporarily unavailable
Please ask the front desk for help.
```

### 9.10 Modal

Use modal for focused creation/edit flows:

- New appointment.
- Record payment.
- Add treatment.
- Change role.
- Confirm delete/void.

Modal rules:

- Title must be specific.
- Primary action bottom-right.
- Cancel/close always available.
- Dangerous modal must require reason where relevant.
- Large clinical forms should use drawer or full page, not tiny modal.

### 9.11 Drawer

Use drawer for contextual details:

- Appointment detail from calendar.
- Patient quick view.
- Invoice preview.
- Claim detail.

Drawer width:

```txt
480px standard
640px for clinical detail
```

### 9.12 Toast

Use toast for non-critical completion messages:

```txt
Payment recorded.
Appointment checked in.
SMS reminder sent.
```

Do not use toast as the only place for critical errors.

---

## 10. Forms and clinical data capture

### 10.1 Form principles

1. Long forms must be sectioned.
2. Save progress automatically where safe.
3. Show completion progress.
4. Use review step before final consent submission.
5. Avoid asking the same patient data twice.
6. Allow staff-assisted entry.
7. Every medical risk answer must be easy to review later.

### 10.2 Patient information form

Sections:

```txt
Basic information
Contact information
Address
Guardian information for minors
Emergency contact optional
Dental insurance / HMO
Referral / reason for consultation
Consent status
```

Fields:

```txt
Last name
First name
Middle name
Birthdate
Age auto-calculated
Sex / Gender
Civil status optional
Phone / mobile
Email
Home address
Occupation
Parent / guardian name for minors
Dental insurance / HMO provider
Reason for dental consultation
```

### 10.3 Medical history form

The form must support yes/no questions and details when yes.

Important fields:

```txt
General health
Under medical treatment
Previous serious illness or surgery
Hospitalization history
Current prescription/non-prescription medication
Tobacco use
Alcohol/drug use
Allergies
Pregnancy/nursing/birth control pills where applicable
Blood type
Blood pressure
Medical conditions checklist
```

Conditions checklist should include:

```txt
High blood pressure
Low blood pressure
Epilepsy / convulsions
AIDS / HIV infection
Sexually transmitted disease
Stomach troubles / ulcers
Fainting seizure
Rapid weight loss
Radiation therapy
Joint replacement / implant
Heart surgery
Heart attack
Thyroid problem
Heart disease
Heart murmur
Hepatitis / liver disease
Rheumatic fever
Hay fever / allergies
Respiratory problems
Tuberculosis
Swollen ankles
Kidney disease
Diabetes
Chest pain
Stroke
Cancer / tumors
Anemia
Angina
Asthma
Emphysema
Bleeding problems
Blood diseases
Head injuries
Arthritis / rheumatism
Other
```

### 10.4 Medical risk UI

Patient header must show medical risks compactly:

```txt
Allergy: Penicillin
Condition: High blood pressure
Pregnancy: Yes
Last updated: May 22, 2026
```

High-risk items must not be buried inside a tab.

### 10.5 Consent form UX

Consent must be handled as a serious legal/medical step.

Sections:

```txt
Treatment to be done
Drugs and medications
Changes in treatment plan
Radiographs / x-rays
Removal of teeth
Crowns / bridges
Endodontics / root canal
Periodontal disease
Fillings
Dentures
General understanding and no-guarantee statement
Signature
Date
```

Rules:

- Consent text must be scrollable and readable.
- Patient must confirm understanding.
- Signature capture must be supported.
- Staff must be able to witness/assist.
- Consent version must be stored.
- Signed PDF/image must be stored in Supabase Storage.
- Signed consent must be linked to patient and appointment/treatment when relevant.

---

## 11. Dental chart / odontogram UX

### 11.1 Purpose

The dental chart is not decoration. It is the clinical map of the mouth.

It must support:

- Permanent teeth.
- Temporary teeth.
- Tooth conditions.
- Restorations and prosthetics.
- Surgery/extraction statuses.
- Tooth-level treatment plans.
- Historical chart snapshots.

### 11.2 Tooth numbering

Use FDI numbering as default, matching Philippine paper chart references:

Permanent:

```txt
18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
```

Temporary:

```txt
55 54 53 52 51 | 61 62 63 64 65
85 84 83 82 81 | 71 72 73 74 75
```

### 11.3 Chart interaction model

Recommended interaction:

1. Select condition/action tool.
2. Select tooth or surface.
3. Confirm or edit details in side panel.
4. Save chart update.
5. Write audit event.

Alternative:

1. Click tooth.
2. Open tooth detail drawer.
3. Add condition/restoration/procedure.

For MVP, tooth-level is enough. For advanced version, support tooth surface-level marking.

### 11.4 Legend codes

Condition codes:

```txt
P  Present tooth
D  Decayed / caries indicated for filling
M  Missing due to caries
MO Missing due to other causes
I  Caries indicated for extraction
Im Impacted tooth
Sp Supernumerary tooth
Rf Root fragment
Un Unerupted
```

Restorations and prosthetics:

```txt
Am Amalgam filling
Co Composite filling
JC Jacket crown
Ab Abutment
Att Attachment
P Pontic
In Inlay
Imp Implant
S Sealants
Rm Removable denture
```

Surgery:

```txt
X Extraction due to caries
XO Extraction due to other causes
```

### 11.5 Dental chart visual states

Each tooth should support:

```txt
normal
selected
has-condition
planned-treatment
completed-treatment
missing
extracted
impacted
alert
```

Visual rules:

- Do not rely only on color. Show code labels/tooltips.
- Selected tooth needs clear outline.
- Missing/extracted teeth must be visually distinct.
- Planned vs completed treatment must be different.
- Historical records should show timestamp and author.

### 11.6 Tooth detail drawer

Drawer contents:

```txt
Tooth number
Current status
Conditions
Restorations
Planned procedures
Completed procedures
Clinical notes
Attachments/x-rays linked to tooth
Audit timeline
```

Actions:

```txt
Add condition
Add treatment plan
Mark completed
Attach file
View history
```

---

## 12. Page-by-page UI/UX specification

## 12.1 Dashboard

### Purpose

Answer: “What needs attention today?”

### Layout

```txt
Header
- Dashboard
- Today’s clinic operations at a glance
- Date selector
- Refresh

KPI row
- Appointments today
- Waiting now
- Outstanding balances
- Pending claims

Main grid
Left 8 columns:
- Today’s schedule
- Queue snapshot

Right 4 columns:
- Action center
- Alerts
- System status

Bottom
- Collections snapshot
- Inventory risk
- Recent activity
```

### Action center examples

```txt
3 patients waiting longer than 20 min
5 partial invoices need follow-up
2 HMO claims are pending approval
1 inventory item is critical
```

### Supabase notes

- Dashboard should use aggregated views or RPC functions where possible.
- Avoid 12 separate client queries.
- Respect clinic_id and role policies.

---

## 12.2 Appointments

### Purpose

Schedule visits, manage chair time, and check patients in.

### Layout

```txt
Header
Toolbar: Day / Week / Month / Today / Dentist / Status / + New appointment
Main: Calendar grid
Right drawer: Selected appointment or day summary
```

### Appointment card fields

```txt
Time
Patient name
Procedure type
Dentist
Status
Payment/balance indicator optional
```

### Appointment statuses

```txt
Scheduled
Confirmed
Checked in
In chair
Completed
Cancelled
No-show
```

### Create appointment flow

```txt
1. Select date/time
2. Search or create patient
3. Select dentist
4. Select appointment type/procedure
5. Add notes
6. Reminder option
7. Confirm
```

### Validation messages

```txt
This dentist already has an appointment at that time.
This patient already has another appointment in this time range.
This time is outside clinic hours.
```

---

## 12.3 Queue

### Purpose

Manage checked-in patients and chair flow.

### Layout

```txt
Header
- Queue
- Manage today’s patient flow
- Check in patient

Columns
- Waiting
- In chair
- Completed today
```

### Queue row

```txt
Patient code/name
Appointment time
Waiting time
Procedure
Dentist
Status
Actions
```

### Actions

```txt
Call patient
Move to chair
Mark completed
Send back to waiting
No-show
```

### Realtime states

```txt
Live
Reconnecting
Last updated
```

---

## 12.4 Patients list

### Purpose

Find and manage patient records.

### Layout

```txt
Header
- Patients
- Search and manage patient profiles
- + New patient

Toolbar
- Search
- HMO filter
- Balance filter
- Last visit filter

Table
- Patient
- Phone
- Last visit
- Medical risk
- Balance
- HMO
- Status
- Actions
```

### Search behavior

Search by:

```txt
Name
Mobile number
Email
Patient code
OR number
Appointment reference
```

### Privacy rule

Do not expose full sensitive patient details in table unless the role allows it.

---

## 12.5 Patient detail

### Purpose

One patient, one complete clinical and financial timeline.

### Header

```txt
Patient name
Patient code
Age / sex
Mobile
Medical risk chips
Balance
Last visit
Primary dentist
```

### Tabs

```txt
Overview
Medical history
Dental chart
Treatment records
Appointments
Billing
Documents
Consents
Audit
```

### Overview cards

```txt
Next appointment
Chief complaint
Medical alerts
Outstanding balance
Latest treatment
Documents missing
```

---

## 12.6 Patient intake / registration

### Purpose

Capture patient info, medical history, and consent digitally.

### UX mode

Two modes:

```txt
Staff-assisted
Patient kiosk/mobile
```

### Stepper

```txt
1. Basic info
2. Contact and address
3. Medical history
4. Dental history
5. Consent
6. Review
```

### Autosave

Autosave drafts when possible.

Draft states:

```txt
Draft saved
Saving...
Could not save
```

---

## 12.7 Dental chart page

### Purpose

View and update current oral condition.

### Layout

```txt
Header: Patient summary + date + chart version
Left: Tool palette / legend
Center: Odontogram
Right: Selected tooth drawer
Bottom: Treatment plan / chart history
```

### Tool palette

```txt
Condition
Restoration
Surgery
Treatment plan
Clear / undo
```

### Save behavior

- Changes are staged.
- User reviews before saving.
- Save creates audit log.
- Previous chart state remains viewable.

---

## 12.8 Treatment records

### Purpose

Replace paper treatment ledgers and orthodontic visit sheets.

### Layout

```txt
Header
- Treatment records
- Track procedures, next visits, payments, and balances
- + Add treatment

Table
Date | Tooth no/s | Procedure | Dentist | Amount charged | Amount paid | Balance | Next appointment | Signature/status
```

### Orthodontic record variant

Fields:

```txt
Date
Procedure
Next procedure / date
Payment
Balance
Dentist/staff signature
Notes
```

### Treatment row actions

```txt
View
Edit
Record payment
Schedule next appointment
Print
```

### Important UX rule

Clinical procedure and payment are connected but not the same thing. The UI must show both without mixing them into one vague “notes” field.

---

## 12.9 Billing / invoices

### Purpose

Track official receipts, invoices, payments, and balances.

### Layout

```txt
Header
- Billing
- Official receipts, payments, and balances
- + New invoice

KPI
- Total billed
- Collected
- Outstanding
- Partial invoices

Filters
- Search
- Status
- Date range
- HMO only

Table
OR no | Patient | Date | Total | Paid | Balance | Status | Actions
```

### Money display

Use:

```txt
₱9,040.00
```

Never:

```txt
9040
PHP 9040 maybe maybe not
```

### Invoice detail

```txt
Left:
- Patient summary
- Treatment/procedure items
- Payment ledger
- Notes/audit

Right sticky panel:
- Total
- Paid
- Balance
- Status
- Record payment
- Print/send
- HMO claim link
```

---

## 12.10 Payments

### Purpose

Make balances and payment history clear.

### Payment methods

```txt
Cash
GCash
Bank transfer
Card
HMO
Other
```

### Record payment modal

Fields:

```txt
Invoice
Amount
Method
Reference no.
Date/time
Received by
Notes
```

Validation:

```txt
Payment cannot exceed balance unless unapplied credit flow exists.
Payment amount must be greater than 0.
Reference number is required for digital methods if clinic setting requires it.
```

---

## 12.11 HMO claims

### Purpose

Track provider reimbursement from draft to paid.

### Layout

```txt
Header
- HMO Claims
- Track provider reimbursements and approvals
- + New claim

KPI
- Draft
- Submitted
- Approved
- Rejected
- Paid

Table
Claim no | Patient | Provider | Requested | Approved | Status | Age | Actions
```

### Claim detail

```txt
Patient
Invoice
Provider
Documents
Requested amount
Approved amount
Status timeline
Rejection reason
Audit log
```

### Status flow

```txt
Draft → Submitted → Under review → Approved → Paid
Draft → Submitted → Rejected
```

---

## 12.12 Reports

### Purpose

Operational reports, not pretty fake charts.

### Report categories

```txt
Finance
- Daily collections
- Outstanding balances
- A/R aging
- HMO claims summary

Clinical
- Treatment volume
- Appointment utilization
- No-show rate

Operations
- Queue wait time
- SMS delivery
- Inventory risk

Compliance
- Consent completion
- Audit exceptions
```

### Report card fields

```txt
Title
Description
Last generated
Primary action
Export option
```

---

## 12.13 Inventory

### Purpose

Avoid running out of clinical supplies.

### Layout

```txt
Header
- Inventory
- Track materials, supplies, and expiry
- + Add item

Risk banner if needed
Filters
Table
```

### Table

```txt
Item | Category | Stock | Min stock | Expiry | Unit cost | Status | Actions
```

### Status rules

```txt
stock = 0 → Critical
stock < minStock → Low
expiry <= 30 days → Expiring soon
expiry < today → Expired
```

---

## 12.14 Documents

### Purpose

Store signed consents, x-rays, dental photos, claims documents, and attachments.

### Layout

```txt
Header
- Documents
- Patient files and clinical attachments
- Upload document

Filters
- Patient
- Type
- Date
- Uploaded by

Table/grid
- File
- Patient
- Type
- Linked record
- Uploaded
- Access
- Actions
```

### Document types

```txt
Consent
X-ray
Dental photo
HMO document
PhilHealth document
Prescription
Treatment attachment
Other
```

### Storage rule

Files live in Supabase Storage. UI must only show safe names and metadata, not raw internal paths.

---

## 12.15 Notifications

### Purpose

Manage SMS reminders and patient communication logs.

### Layout

```txt
Header
- Notifications
- SMS reminders and delivery logs
- Send test SMS

Status card
- Provider status
- Dry run mode
- Failed messages

Scheduled jobs
- Morning reminders
- Appointment confirmations
- Follow-up reminders

Message log table
```

### Message log table

```txt
Recipient | Patient | Kind | Status | Scheduled | Sent | Provider | Actions
```

### Statuses

```txt
Draft
Queued
Sending
Sent
Failed
Cancelled
```

---

## 12.16 Staff

### Purpose

Manage team access.

### Layout

```txt
Header
- Staff
- Manage clinic team access and roles
- Invite staff

Filters
- Search
- Role
- Status

Table
Name | Email | Role | Last login | Status | Actions
```

### Role change UX

Use modal, not inline chaos.

Modal fields:

```txt
Current role
New role
Permission summary
Reason optional/required based on setting
Confirm
```

---

## 12.17 Settings

### Tabs

```txt
Clinic profile
Schedule
Billing
HMO providers
Kiosk & TV display
Notifications
Security
Data export
```

### Clinic profile fields

```txt
Clinic name
Phone
Address
City
Timezone
Currency PHP
Logo
Default language
```

### Kiosk settings

```txt
Kiosk URL
Kiosk token status
Rotate token
Allowed intake fields
Consent version
Theme preview
```

### TV display settings

```txt
Display URL
Token status
Patient name masking
Announcement ticker
Refresh/realtime mode
```

---

## 12.18 Kiosk

### Purpose

Patient-facing check-in and intake.

### Kiosk layout

```txt
Top
- Clinic logo
- Clinic name
- Language selector

Hero
- Welcome to [Clinic]
- How can we help you today?

Cards
- Check in for appointment
- Book or manage visit
- Update patient information
- Staff assistance
```

### Kiosk design rules

- Minimum touch target: 48px, preferably 56px.
- Large text.
- No dense tables.
- No raw errors.
- Timeout and return home after inactivity.
- Staff mode must require authentication.

### Kiosk error

```txt
We can’t load this kiosk right now.
Please ask the front desk for help.
```

---

## 12.19 TV queue display

### Purpose

Waiting-room patient flow display.

### Layout

```txt
Top
- Clinic Live Queue
- Time
- Date

Main
- Now serving
- Waiting

Bottom
- Announcement ticker
- Connection status small
```

### Display rules

- Do not show full sensitive patient information by default.
- Use patient code or masked name.
- Text must be readable from distance.
- Use fallback cached data if connection fails.

### Type sizes

```txt
Now serving code: 72px
Main title: 48px
Queue rows: 32-36px
Ticker: 22px
Clock: 48-64px
```

---

## 13. Mobile responsiveness

### 13.1 Staff mobile

Staff mobile is secondary but must not break.

Priority mobile flows:

```txt
Search patient
View appointment
Check in patient
View patient summary
Record quick note
Record payment
```

### 13.2 Patient mobile

Patient-facing mobile must be excellent.

Priority mobile flows:

```txt
Book appointment
Check in
Fill intake
Sign consent
View appointment confirmation
```

### 13.3 Responsive breakpoints

```txt
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### 13.4 Tables on mobile

Do not squeeze full admin tables into tiny screens. Convert to cards.

Mobile patient row card:

```txt
Patient name
Phone
Last visit
Balance
Status
Actions
```

---

## 14. Accessibility

### 14.1 Minimum requirements

- Keyboard navigation for admin UI.
- Visible focus states.
- Color contrast passes WCAG AA.
- Forms have labels.
- Error messages are associated with fields.
- Buttons have accessible names.
- Modals trap focus.
- Toasts do not contain critical-only information.

### 14.2 Dental chart accessibility

Odontogram must not rely only on visual clicking.

Required alternatives:

- Tooth list/table view.
- Keyboard selectable tooth numbers.
- Text labels for condition codes.
- Screen-reader accessible tooth state summary.

---

## 15. Internationalization

### 15.1 Languages

MVP:

```txt
English
```

Near future:

```txt
Filipino/Tagalog
```

Internal/dev docs may include Turkish, but product UI should be English-first for Philippine clinics unless target clinic requests otherwise.

### 15.2 i18n fallback rule

Never show raw keys.

Bad:

```txt
pages.kiosk.begincta
common.refresh
```

Good:

```txt
Refresh
Begin check-in
```

Recommended helper:

```ts
function t(key: string, fallback: string) {
  const value = i18n.t(key);
  if (!value || value === key) return fallback;
  return value;
}
```

### 15.3 Copy style

Admin:

```txt
Clear, professional, specific.
```

Patient:

```txt
Short, warm, simple.
```

No jokes in patient medical consent, billing, or error states. Keep the witty bits for internal docs, not Auntie signing a consent form.

---

## 16. State management and Supabase UI contract

### 16.1 Query states

Every Supabase-driven component must define:

```txt
loading: skeleton
empty: designed empty state
error: retryable message
permission_denied: role-specific message
ready: content
stale: content with stale indicator
reconnecting: content with reconnecting indicator
```

### 16.2 Mutation states

For create/update/delete actions:

```txt
idle
validating
submitting
success
failed
retrying
```

### 16.3 Optimistic UI

Allowed for:

- Queue reorder.
- Marking local filters.
- Non-critical preference updates.

Not allowed for:

- Payment recorded.
- Invoice voided.
- Claim submitted.
- Consent signed.
- Role changed.
- Medical history changed.

For critical workflows, wait for confirmed backend response.

---

## 17. Supabase RLS and UI permission matrix

### 17.1 Role-to-UI visibility

```txt
Owner/Admin
- Sees everything.

Dentist
- Sees patients, appointments, charts, treatments.
- Limited billing visibility based on clinic setting.
- No staff/security settings.

Receptionist
- Sees appointments, queue, patients, basic billing/payment.
- No audit/security/admin settings.

Billing
- Sees invoices, payments, HMO claims, reports.
- Limited clinical chart access.

Patient/Kiosk
- Only scoped kiosk/intake/check-in actions.
```

### 17.2 UI permission message

```txt
You don’t have access to this area.
Ask a clinic admin if you need this permission.
```

Do not show:

```txt
RLS error
permission denied for table public.invoices
```

---

## 18. Design deliverables checklist

A serious UI/UX phase must produce:

```txt
1. Information architecture map
2. User role matrix
3. User flows
4. Low-fidelity wireframes
5. High-fidelity Figma screens
6. Component library
7. Design tokens
8. Interactive prototype
9. Empty/loading/error states
10. Mobile responsive views
11. Kiosk prototype
12. TV queue prototype
13. Dental chart interaction prototype
14. Consent signing flow
15. Payment/ledger flow
16. HMO claim flow
17. Accessibility checklist
18. Developer handoff notes
```

If any of these are missing, someone will improvise later. Improvisation in medical/billing software is how chaos gets a login screen.

---

## 19. Screen inventory for Figma

### MVP screens

```txt
Login
Forgot password
Dashboard
Appointments day view
New appointment modal
Queue board
Patient list
New patient intake
Patient detail overview
Medical history
Dental chart
Treatment records
Billing invoices
Invoice detail
Record payment modal
HMO claims list
Inventory list
Documents list
Staff list
Settings clinic profile
Kiosk home
Kiosk check-in
TV queue display
Permission denied
404
General error
```

### V1.1 screens

```txt
Reports hub
Advanced appointment calendar week view
Orthodontic treatment timeline
Consent signing review
Document upload drawer
Notification logs
Audit logs
HMO provider settings
Data export
Security settings
```

---

## 20. User flows

### 20.1 New patient + appointment

```txt
Receptionist opens Patients
→ New patient
→ Fill basic info
→ Fill medical history or mark pending
→ Save patient
→ Create appointment
→ Select dentist/time/procedure
→ Confirm
→ Optional SMS reminder
```

### 20.2 Check-in + queue

```txt
Patient arrives
→ Staff searches appointment or patient uses kiosk
→ Check in
→ Patient appears in Queue
→ Staff calls patient
→ Move to In chair
→ Dentist completes treatment
→ Queue marks completed
```

### 20.3 Treatment + payment

```txt
Dentist opens patient
→ Updates dental chart/treatment
→ Adds procedure
→ Billing creates invoice or draft invoice auto-created
→ Patient pays full or partial
→ Payment ledger updated
→ Balance recalculated
```

### 20.4 Orthodontic recurring visit

```txt
Patient checks in
→ Staff opens orthodontic treatment record
→ Dentist logs adjustment/procedure
→ Next procedure/date added
→ Payment recorded if collected
→ Balance updated
→ Next appointment scheduled
```

### 20.5 HMO claim

```txt
Invoice issued
→ HMO eligible selected
→ Claim draft created
→ Documents attached
→ Claim submitted
→ Status updates
→ Approved/rejected
→ Paid/reconciled
```

---

## 21. Data display formats

### 21.1 Currency

```txt
₱1,000.00
```

Use tabular numbers in tables.

### 21.2 Dates

Short:

```txt
May 22, 2026
```

With time:

```txt
May 22, 2026, 2:30 PM
```

Appointments:

```txt
Today, 2:30 PM
Tomorrow, 9:00 AM
```

### 21.3 Phone numbers

Display as entered or normalized PH format based on backend rules.

Recommended display:

```txt
+63 917 123 4567
```

### 21.4 Missing value

Use em dash:

```txt
—
```

Do not use:

```txt
null
undefined
N/A everywhere like confetti
```

---

## 22. Content and microcopy

### 22.1 Primary action labels

```txt
New appointment
Check in patient
Add treatment
Record payment
Submit claim
Upload document
Invite staff
Save changes
```

### 22.2 Confirmation copy

Void invoice:

```txt
Void this invoice?
This action will mark the invoice as void and keep an audit record. You must provide a reason.
```

Delete appointment:

```txt
Cancel this appointment?
The appointment will be marked cancelled. The patient record will remain unchanged.
```

Role change:

```txt
Change staff role?
This changes what the staff member can access in the clinic system.
```

### 22.3 Success messages

```txt
Appointment created.
Patient checked in.
Treatment record saved.
Payment recorded.
Claim submitted.
Document uploaded.
```

### 22.4 Error messages

```txt
Couldn’t save changes. Please try again.
Your session expired. Sign in again to continue.
You don’t have permission to perform this action.
This patient record was updated by another staff member. Refresh before editing.
```

---

## 23. Loading, empty, and error library

### 23.1 Loading skeletons

Use skeletons for:

- Dashboard cards.
- Tables.
- Patient header.
- Dental chart.
- Invoice detail.

Use spinner only for button-level actions.

### 23.2 Empty states

Appointments:

```txt
No appointments today
Create an appointment or switch to another date.
[New appointment]
```

Queue:

```txt
No patients waiting
Checked-in patients will appear here.
[Check in patient]
```

Dental chart:

```txt
No chart recorded yet
Start the patient’s intraoral examination by selecting a tooth.
[Start charting]
```

Invoices:

```txt
No invoices found
Try changing filters or create a new invoice.
[New invoice]
```

HMO claims:

```txt
No claims yet
Create a claim from an eligible invoice.
[Open invoices]
```

### 23.3 Error states

Network:

```txt
Couldn’t connect to the server
Check your connection and try again.
[Retry]
```

Supabase permission:

```txt
Access restricted
Your role does not allow access to this information.
```

Realtime reconnect:

```txt
Reconnecting...
Showing the latest available data.
```

---

## 24. Kiosk and TV safety rules

### 24.1 Kiosk privacy

- Auto-timeout after inactivity.
- Clear form data after completion or timeout.
- Do not expose previous patient data.
- Staff mode behind login.
- Show privacy notice before sensitive intake.

### 24.2 TV privacy

Default queue display should use:

```txt
Patient code
Masked name
Appointment number
```

Avoid full name unless clinic explicitly configures it.

### 24.3 Offline behavior

Kiosk:

```txt
We can’t connect right now. Please ask the front desk for help.
```

TV:

```txt
Reconnecting...
Showing latest queue update.
```

---

## 25. Supabase backend coordination checklist for UI

Even though this is a UI/UX spec, the design must demand the backend fields it needs.

### 25.1 Required common fields

Every major record:

```txt
id
clinic_id
created_at
updated_at
created_by
updated_by optional
status
audit metadata where critical
```

### 25.2 UI-critical backend fields

Patient:

```txt
full_name
birth_date
sex
mobile
email
address
medical_risk_summary
balance_total
last_visit_at
```

Appointment:

```txt
patient_id
dentist_id
start_at
end_at
status
type
source
notes
```

Treatment:

```txt
patient_id
tooth_numbers
procedure
dentist_id
notes
amount_charged
amount_paid
balance
next_appointment_at
```

Invoice:

```txt
or_number
patient_id
status
total
paid_amount
balance
issued_at
```

Queue:

```txt
patient_id
appointment_id
status
checked_in_at
called_at
chair_started_at
completed_at
```

Document:

```txt
patient_id
storage_path internal only
safe_file_name
document_type
linked_entity_type
linked_entity_id
uploaded_by
```

### 25.3 Supabase policy expectation

The UI expects clinic-scoped access:

```txt
Users only see data for clinics they belong to.
Roles determine actions.
Patient/kiosk tokens have narrow scoped access.
TV display tokens are read-only and privacy-filtered.
```

---

## 26. Developer handoff rules

### 26.1 Component naming

Use predictable names:

```txt
AppShell
Sidebar
Topbar
PageHeader
MetricCard
StatusBadge
DataTable
EmptyState
ErrorState
PatientHeader
DentalChart
ToothDrawer
TreatmentRecordTable
PaymentLedger
```

### 26.2 Frontend file structure suggestion

```txt
src/
  app/
  components/
    layout/
    ui/
    data-table/
    forms/
    dental-chart/
    patient/
    billing/
  modules/
    appointments/
    queue/
    patients/
    treatments/
    billing/
    hmo/
    inventory/
    documents/
  lib/
    supabase/
    permissions.ts
    format.ts
    i18n.ts
    errors.ts
  styles/
    tokens.css
    globals.css
```

### 26.3 No hardcoded fake data in production components

Mock data belongs in:

```txt
stories
fixtures
tests
```

Not inside actual page components.

### 26.4 Storybook or component preview

Recommended components to preview:

```txt
Button
Input
Select
Card
MetricCard
StatusBadge
DataTable
EmptyState
ErrorState
PatientHeader
DentalChart
PaymentLedger
QueueCard
KioskCard
TVQueueDisplay
```

---

## 27. QA acceptance criteria

### 27.1 Visual QA

- All pages use same app shell.
- Page headers follow same structure.
- Primary actions are consistent.
- Colors match token meanings.
- No random gradients.
- No raw translation keys.
- No broken alignment.
- No table columns with messy money alignment.
- Mobile views do not overflow.
- Kiosk buttons are large enough.
- TV display is readable from distance.

### 27.2 UX QA

- User understands page purpose in 3 seconds.
- Main action is obvious.
- Empty states suggest next step.
- Errors are human-readable.
- Permission denied is distinct from empty data.
- Patient medical alerts are visible when needed.
- Payment/balance states are clear.
- Dental chart changes are reviewable.
- Consent signing stores version/date/signature.

### 27.3 Supabase QA

- RLS permission failures display correctly.
- Session expiry is handled.
- Realtime reconnect is handled.
- Storage upload errors are handled.
- Edge Function errors are translated into user-friendly messages.
- Critical mutation buttons prevent double-submit.
- No service role key is ever exposed to frontend.

---

## 28. MVP UI priority order

Build in this order:

```txt
1. Design tokens
2. AppShell / Sidebar / Topbar
3. PageHeader
4. Button / Input / Select / Card / Badge
5. DataTable with states
6. Auth screens
7. Dashboard
8. Patients list/detail
9. Patient intake
10. Appointments
11. Queue
12. Dental chart
13. Treatment records
14. Billing/invoices/payments
15. Kiosk
16. TV queue
17. HMO claims
18. Documents
19. Settings
20. Reports
```

Reason:

You cannot build a clean product by starting with flashy dashboards. Build the boring bones first. The skeleton wins. Always.

---

## 29. Design review checklist

Before accepting any screen, ask:

1. What job does this screen do?
2. What is the primary action?
3. What happens when there is no data?
4. What happens when Supabase returns an error?
5. What happens when the user lacks permission?
6. What happens on mobile?
7. Is money formatted correctly?
8. Are patient risks visible where needed?
9. Can the user recover from mistakes?
10. Is this screen actually useful in a busy clinic?

If the answer is vague, the screen is not done.

---

## 30. Final product standard

The final UI/UX standard is simple:

A receptionist should be faster than paper.  
A dentist should trust the chart.  
A patient should not feel lost.  
An owner should see the money.  
A developer should not guess.  
Supabase should protect the data, not be bypassed because the UI was lazy.

This is the bar. Anything below it is not “MVP”; it is future rework wearing a hoodie.

---

## 31. References to verify during implementation

These topics must be checked against official current documentation during engineering:

- Supabase Row Level Security.
- Supabase Auth and API keys.
- Supabase Storage access control.
- Supabase Realtime authorization.
- Supabase Edge Functions.
- Supabase local development and migrations.
- Philippine data privacy requirements.
- Clinic-specific HMO/PhilHealth workflow requirements.

Do not ship regulated or privacy-sensitive workflows based only on assumptions.
