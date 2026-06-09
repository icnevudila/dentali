# Backend Architecture

## Önerilen stack

- Node.js + TypeScript
- NestJS veya Fastify
- PostgreSQL
- Prisma veya Drizzle
- Redis for cache/rate-limit/queue
- S3-compatible object storage
- OpenTelemetry/logging with PII redaction

## Module structure

```txt
src/
  modules/
    auth/
    clinics/
    staff/
    patients/
    medical-history/
    consents/
    dental-chart/
    appointments/
    queue/
    waitlist/
    treatments/
    billing/
    hmo/
    philhealth/
    inventory/
    notifications/
    compliance/
    audit/
    reports/
  common/
    api-response.ts
    errors.ts
    permissions.ts
    validation.ts
    logging.ts
    crypto.ts
    time.ts
```

## Her modül içinde

```txt
api/controller.ts
schema.ts
service.ts
repository.ts
permissions.ts
audit.ts
types.ts
```

## API response standard

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-06-09T12:00:00Z"
  }
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient not found.",
    "details": {}
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-06-09T12:00:00Z"
  }
}
```

## Auth model

### Staff/admin

- Secure HTTP-only session cookie
- Role and permission claims resolved server-side
- Session invalidation on deactivation

### Kiosk

- Scoped token
- Clinic-bound
- Limited actions: check-in, intake, consent, appointment request
- No broad patient search without verification

### Queue display

- Read-only token
- No full patient names by default
- Display code preferred

## Permission examples

```txt
patients.read
patients.write
patients.medical_history.read
patients.medical_history.write
consents.manage
dental_chart.read
dental_chart.write
appointments.read
appointments.write
queue.manage
billing.read
billing.write
hmo.read
hmo.write
staff.manage
settings.manage
audit.read
```

## Audit log

Audit required for:

- Patient created/updated
- Medical history updated
- Consent signed/voided
- Dental chart updated
- Treatment record created/updated/deleted
- Appointment status changed
- Invoice created/issued/voided
- Payment recorded/refunded
- HMO claim submitted/approved/rejected/paid
- Staff role changed
- Clinic settings changed

Audit fields:

```txt
id
clinicId
actorUserId
action
entityType
entityId
beforeJson
afterJson
reason
ipAddress
userAgent
createdAt
```

## Business transaction rules

- Payment recording must be DB transaction.
- Invoice balance recalculated server-side.
- Dental chart update creates version/event, not silent overwrite.
- Appointment status transition validated server-side.
- Claim status transition validated server-side.

## Background jobs

- Appointment reminders
- SMS dispatch retry
- Daily report snapshots
- Inventory expiring alerts
- HMO aging alerts
- Data retention review

## Logging rules

Log:

- requestId
- route
- clinicId
- actorUserId
- status code
- timing

Do not log:

- raw medical notes
- consent body with signature data
- patient full address
- raw phone/email when not needed
- claim payload
- auth tokens

## Rate limits

- Login
- Kiosk patient lookup
- Staff invite
- SMS test
- Claim sync
- Export endpoints

## Error taxonomy

```txt
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
CONFLICT
STATE_TRANSITION_INVALID
RATE_LIMITED
INTEGRATION_UNAVAILABLE
INTERNAL_ERROR
```

## Deployment notes

- Staging and production must use separate DB/storage.
- Production seed must never contain real patient examples.
- Backups encrypted.
- Restore procedure tested.
