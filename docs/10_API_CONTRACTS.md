# API Contracts

## General response

```ts
type ApiMeta = {
  requestId: string
  timestamp: string
}

type ApiError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type ApiResponse<T> =
  | { ok: true; data: T; meta: ApiMeta }
  | { ok: false; error: ApiError; meta: ApiMeta }
```

## Auth

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Dashboard

```txt
GET /api/dashboard/summary?date=YYYY-MM-DD
GET /api/dashboard/action-center
GET /api/dashboard/sync-status
```

Response:

```json
{
  "date": "2026-06-09",
  "appointments": { "total": 12, "checkedIn": 3, "completed": 2 },
  "queue": { "waiting": 4, "avgWaitMinutes": 18 },
  "billing": { "collectedMinor": 250000, "outstandingMinor": 410000 },
  "hmo": { "pending": 8, "requestedTotalMinor": 4200000 },
  "alerts": { "critical": 2, "warning": 5 }
}
```

## Patients

```txt
GET    /api/patients?search=&page=&limit=
POST   /api/patients
GET    /api/patients/:patientId
PATCH  /api/patients/:patientId
GET    /api/patients/:patientId/timeline
```

Create patient request:

```json
{
  "firstName": "Test",
  "lastName": "Patient",
  "birthDate": "2000-01-01",
  "sex": "female",
  "primaryPhone": "+639000000000",
  "address": "Sample City, Philippines"
}
```

## Medical history

```txt
GET  /api/patients/:patientId/medical-history/latest
POST /api/patients/:patientId/medical-history
GET  /api/patients/:patientId/medical-history/versions
```

## Consents

```txt
GET  /api/patients/:patientId/consents
POST /api/patients/:patientId/consents
POST /api/consents/:consentId/void
```

## Dental chart

```txt
GET  /api/patients/:patientId/dental-chart/latest
POST /api/patients/:patientId/dental-chart
GET  /api/patients/:patientId/dental-chart/versions
```

Create/update chart request:

```json
{
  "dentition": "mixed",
  "findings": [
    {
      "toothNo": "11",
      "condition": "PRESENT",
      "restorations": [],
      "surgeries": [],
      "surfaces": [],
      "note": ""
    }
  ],
  "periodontal": { "screening": "none" },
  "occlusion": { "classMolar": "class_i" }
}
```

## Appointments

```txt
GET    /api/appointments?from=&to=&dentistId=&status=
POST   /api/appointments
GET    /api/appointments/:appointmentId
PATCH  /api/appointments/:appointmentId
POST   /api/appointments/:appointmentId/check-in
POST   /api/appointments/:appointmentId/start
POST   /api/appointments/:appointmentId/complete
POST   /api/appointments/:appointmentId/cancel
```

Business errors:

- `APPOINTMENT_OVERLAP`
- `OUTSIDE_CLINIC_HOURS`
- `INVALID_STATUS_TRANSITION`

## Queue

```txt
GET  /api/queue/today
POST /api/queue/check-in
POST /api/queue/:queueEntryId/call
POST /api/queue/:queueEntryId/complete
GET  /api/queue/display?token=
GET  /api/queue/events?token=
```

Queue display response must not expose full patient information by default:

```json
{
  "clinicName": "Sample Dental Clinic",
  "nowServing": [{ "displayCode": "A-014", "chair": "Chair 1" }],
  "waiting": [{ "displayCode": "A-015", "status": "waiting" }],
  "serverTime": "2026-06-09T12:00:00+08:00"
}
```

## Treatments

```txt
GET  /api/patients/:patientId/treatments
POST /api/patients/:patientId/treatments
GET  /api/treatments/:treatmentId
PATCH /api/treatments/:treatmentId
POST /api/treatments/:treatmentId/void
```

## Invoices

```txt
GET  /api/invoices?search=&status=&from=&to=&page=
POST /api/invoices
GET  /api/invoices/:invoiceId
PATCH /api/invoices/:invoiceId
POST /api/invoices/:invoiceId/items
POST /api/invoices/:invoiceId/issue
POST /api/invoices/:invoiceId/payments
POST /api/invoices/:invoiceId/void
GET  /api/invoices/export.csv
```

Payment request:

```json
{
  "method": "cash",
  "amountMinor": 100000,
  "referenceNo": "",
  "paidAt": "2026-06-09T10:30:00+08:00"
}
```

Payment business errors:

- `PAYMENT_EXCEEDS_BALANCE`
- `INVOICE_VOIDED`
- `INVOICE_NOT_ISSUED`

## HMO

```txt
GET  /api/hmo/providers
POST /api/hmo/providers
PATCH /api/hmo/providers/:providerId

GET  /api/hmo/claims?status=&providerId=&search=
POST /api/hmo/claims
GET  /api/hmo/claims/:claimId
POST /api/hmo/claims/:claimId/submit
POST /api/hmo/claims/:claimId/approve
POST /api/hmo/claims/:claimId/reject
POST /api/hmo/claims/:claimId/mark-paid
```

Claim status flow:

```txt
draft -> submitted -> under_review -> approved -> paid
draft -> submitted -> rejected
```

## Kiosk

```txt
GET  /api/kiosk/config?slug=
POST /api/kiosk/patient-lookup
POST /api/kiosk/check-in
POST /api/kiosk/intake
POST /api/kiosk/consent
POST /api/kiosk/staff-login
```

Kiosk errors must be user-safe:

```json
{
  "ok": false,
  "error": {
    "code": "KIOSK_TEMPORARILY_UNAVAILABLE",
    "message": "We can’t load this kiosk right now. Please ask the front desk for help."
  }
}
```

## Reports

```txt
GET  /api/reports/catalog
POST /api/reports/run
GET  /api/reports/:reportId/export.csv
```

## Audit

```txt
GET /api/audit-logs?entityType=&entityId=&from=&to=
```
