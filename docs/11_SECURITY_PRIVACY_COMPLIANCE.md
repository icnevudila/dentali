# Security, Privacy and Compliance

## Core principle

Bu uygulama sağlık ve hasta verisi işler. Güvenlik “sonradan eklenen feature” değil, veri modelinin kemiğidir.

## Data categories

### Personal information

- Name
- Phone
- Email
- Address
- Birthdate
- Occupation
- Guardian info

### Sensitive health data

- Medical history
- Allergies
- Dental chart
- Treatment notes
- X-ray/radiograph references
- Consent records
- Claim payloads

### Financial data

- Invoice
- Payment ledger
- HMO claim amounts
- Balance

## Access control

Use RBAC first. Later ABAC can be added.

Roles:

- Admin
- Dentist
- Receptionist
- Billing Staff
- Read-only Auditor

Permission examples:

```txt
patients.read
patients.write
patients.sensitive.read
medical_history.write
consents.manage
dental_chart.write
billing.write
hmo.write
audit.read
settings.manage
```

## Backend enforcement

Every protected route must check:

1. Authenticated user
2. Clinic membership
3. Permission
4. Entity belongs to clinic
5. Optional row-level rule

Frontend hiding is UX only. Backend is the lock.

## Encryption

Encrypt at rest:

- Medical history JSON
- Consent signature assets
- Sensitive claim payloads
- Staff encrypted profile data

Hash or normalize for search separately when required.

## Logging redaction

Never log raw:

- Medical notes
- Full address
- Consent signature
- Claim payload
- Token
- Password
- Full phone where unnecessary

Use masked display:

```txt
+639******123
j***@example.com
```

## Audit events

Required audit events:

- patient.created
- patient.updated
- medical_history.created
- consent.signed
- consent.voided
- dental_chart.updated
- treatment.created
- treatment.updated
- appointment.status_changed
- invoice.issued
- invoice.voided
- payment.recorded
- payment.refunded
- hmo_claim.submitted
- hmo_claim.approved
- hmo_claim.rejected
- staff.role_changed
- settings.updated

## Consent policy

Before invasive procedure, system should check:

- Medical history exists
- Relevant consent exists
- Consent not voided
- Consent version is current or accepted by clinic policy

## Kiosk privacy

- No full patient list search.
- Patient lookup requires at least two factors: phone + birthdate, or appointment code + birthdate.
- Auto-logout after inactivity.
- Screen must not leave full medical history visible after completion.

## Queue display privacy

Default display should use queue codes, not full patient names.

Example:

```txt
Now serving: A-014
Waiting: A-015, A-016, A-017
```

## Data retention

Define clinic-configurable retention:

- Active patient records: retain while active and legally required
- Audit logs: long retention, tamper-resistant
- Temporary kiosk drafts: auto-delete after successful submit or timeout
- Failed upload temp files: short retention

## Incident response checklist

1. Identify affected system
2. Disable compromised token/session
3. Preserve audit logs
4. Determine affected patient records
5. Notify owner/admin
6. Prepare regulatory/legal review
7. Patch root cause
8. Document lessons learned

## Security test requirements

- User cannot access other clinic data by changing ID.
- Receptionist cannot change roles.
- Dentist cannot void invoice unless permitted.
- Queue token cannot call admin endpoints.
- Kiosk token cannot export patient data.
- Logs do not contain PHI/PII.

## Legal note

This document is product planning, not legal advice. Before production launch in the Philippines, validate Data Privacy Act obligations, NPC registration/reporting duties, HMO contracts, PhilHealth scope and local consent wording with qualified local counsel or compliance advisor. Boring? Yes. Necessary? Absolutely.
