# QA Test Plan

## 1. Smoke tests for every page

For each admin page:

- Page loads without crash
- Loading state visible
- Empty state visible
- Error state visible
- Main action visible
- Mobile/tablet layout does not break
- Permission denied state works

## 2. Auth and permission tests

- Unauthenticated user cannot access admin.
- Receptionist cannot manage staff roles.
- Dentist cannot void invoice without permission.
- Billing staff cannot edit medical history unless allowed.
- Kiosk token cannot access admin endpoint.
- Queue display token is read-only.

## 3. Patient workflow e2e

Scenario:

1. Create patient.
2. Add medical history.
3. Sign consent.
4. Create appointment.
5. Check in patient.
6. Call patient from queue.
7. Add dental chart finding.
8. Add treatment record.
9. Generate invoice.
10. Record payment.
11. Verify audit log.

Expected:

- Patient timeline shows all events.
- Invoice balance is correct.
- Audit log has patient, consent, chart, invoice, payment events.

## 4. Appointment validation tests

- Double-book same dentist same time should fail.
- Appointment outside clinic hours should fail unless override.
- Cancelling appointment updates queue if checked in.
- Completing appointment can prompt invoice generation.

## 5. Dental chart tests

- Tooth selection works.
- Condition code saves.
- Surface selection saves.
- Chart version increments on save.
- Old version remains readable.
- Non-permitted user cannot edit.

## 6. Consent tests

- Patient can sign consent.
- Consent signature asset saved private.
- Consent can be voided with reason.
- Invasive treatment without consent shows warning.

## 7. Billing tests

- Invoice totals calculated server-side.
- Payment reduces balance.
- Overpayment fails unless unapplied credit is implemented.
- Paid invoice cannot be edited without correction flow.
- Void requires reason.
- Export respects permission.

## 8. HMO tests

- Claim draft can be created from invoice.
- Claim can transition draft → submitted.
- Submitted claim can be approved or rejected.
- Approved claim can be marked paid.
- Invalid transitions fail.

## 9. Kiosk tests

- Valid token loads config.
- Invalid token shows safe error.
- API down shows safe error.
- Patient lookup requires enough info.
- Session times out.
- Draft intake does not disappear on temporary network failure.

## 10. Queue display tests

- 0 waiting patients shows calm empty state.
- 1 now serving displays large code.
- Many waiting rows remain readable.
- API 503 shows cached data + reconnecting.
- Raw HTTP error never appears.

## 11. Security tests

- Changing patientId in URL cannot access another clinic.
- Logs do not contain raw medical history.
- Export endpoints require permission.
- Rate limit triggers on repeated failed login.
- Sensitive assets require signed/private URL.

## 12. Performance targets

- Dashboard first load under 2.5s on normal broadband.
- Patient search responds under 500ms for common queries.
- Queue display poll/reconnect does not spam backend.
- Dental chart interaction feels instant.

## 13. Accessibility checks

- Keyboard navigation works in admin.
- Color contrast passes AA.
- Form errors are screen-reader friendly.
- Kiosk buttons are at least 48px high.
- Focus states visible.

## 14. Regression checklist before release

- Typecheck
- Unit tests
- E2E critical flow
- DB migration dry run
- Backup restore test for production-like data
- PII log scan
- Manual kiosk test
- Manual queue display test
