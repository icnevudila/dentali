# Core Workflows

## 1. New patient intake

```txt
Patient arrives
→ Reception opens kiosk/tablet intake
→ Patient fills profile
→ Medical history completed
→ Data privacy/treatment consent signed
→ Reception verifies identity
→ Patient record becomes active
```

System requirements:

- Autosave draft
- Required fields validation
- Guardian flow for minors
- Signature capture
- Audit event for consent

## 2. Appointment booking

```txt
Staff selects date/time
→ Selects patient or creates patient
→ Selects dentist/chair/procedure type
→ System checks conflicts
→ Appointment scheduled
→ Optional SMS reminder queued
```

Validation:

- Dentist cannot be double-booked unless admin override.
- Appointment must be within clinic hours unless override.
- End time must be after start time.
- Patient cannot have overlapping appointments.

## 3. Check-in and queue

```txt
Patient arrives
→ Reception/kiosk checks appointment
→ Queue display code generated
→ Status: checked_in
→ Queue entry: waiting
→ Staff calls patient
→ Status: in_chair
→ Treatment completed
```

Queue display must use code-first privacy.

## 4. Dental chart update

```txt
Dentist opens patient chart
→ Selects tooth
→ Marks condition/restoration/surgery
→ Adds notes
→ Saves chart version
→ Audit event created
```

Rules:

- Do not overwrite old chart silently.
- Show latest chart by default.
- Older versions accessible to permitted users.

## 5. Treatment record

```txt
Dentist records procedure
→ Tooth number/s selected
→ Clinical note added
→ Fee added or linked to invoice
→ Next appointment recommended
```

Rules:

- Treatment can exist before invoice.
- Invoice item can reference treatment.
- Changing paid treatment requires reason.

## 6. Invoice and payment

```txt
Treatment completed
→ Invoice draft generated
→ Items reviewed
→ Invoice issued
→ Payment recorded
→ Balance recalculated
→ If balance is 0, status paid
```

Server-side rules:

- Balance calculated by backend.
- Payment cannot exceed balance unless unapplied credit is supported.
- Void requires reason.
- Issued invoice edits are restricted.

## 7. HMO claim

```txt
Invoice issued
→ HMO provider selected
→ Claim draft created
→ Staff verifies documents
→ Claim submitted
→ Provider approves/rejects
→ Approved claim marked paid when reimbursement arrives
```

Status flow:

```txt
draft → submitted → under_review → approved → paid
submitted → rejected
```

## 8. Orthodontic adjustment flow

```txt
Patient has active ortho plan
→ Adjustment appointment
→ Procedure notes added
→ Payment/installment recorded
→ Next adjustment scheduled
→ Balance updated
```

This must support repeated monthly/periodic rows like old orthodontic record sheets.

## 9. Waitlist to appointment

```txt
Patient added to waitlist
→ Slot opens
→ Reception contacts patient
→ Patient accepts
→ Appointment created
→ Waitlist entry marked booked
```

Rules:

- Waitlist status: waiting/contacted/booked/cancelled/expired
- Booked entry must store appointmentId

## 10. Kiosk error flow

```txt
Kiosk config fails
→ Show safe message
→ Log requestId server-side
→ Staff can retry
```

Patient never sees raw technical errors.

## 11. Queue display reconnect flow

```txt
Queue API success
→ Cache payload
→ Network fails
→ Show cached queue with Reconnecting badge
→ Retry with backoff
→ Restore live mode
```

## 12. Daily closeout

```txt
End of day
→ Dashboard collections reviewed
→ Payments exported
→ Open balances listed
→ HMO pending claims reviewed
→ Audit exceptions checked
```

MVP report outputs:

- Daily collection summary
- Outstanding balances
- Appointments completed/no-show
- HMO pending claims
