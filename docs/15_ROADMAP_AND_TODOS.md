# Roadmap and TODOs

## Phase 0 — Discovery and hard decisions

Goal: Sis perdesini kaldırmak.

Tasks:

- Confirm product name.
- Confirm web/mobile priority.
- Confirm whether first release is single clinic or multi-clinic.
- Confirm HMO scope: tracking only or integration.
- Confirm PhilHealth scope: hidden feature flag or active module.
- Confirm consent text with local legal/compliance support.
- Define core procedure catalog.
- Define role matrix.

Output:

- Final MVP scope
- Confirmed stack
- Confirmed data model

## Sprint 1 — Foundation

Tasks:

- Repo setup
- TypeScript strict
- Auth skeleton
- Clinic context
- AppShell
- Design tokens
- Button/Card/Input/Table components
- API response wrapper
- Error handling
- Permission helper
- Audit log table

Acceptance:

- Admin shell works.
- User can login/logout.
- Protected route works.
- Component system visible.

## Sprint 2 — Patients and intake

Tasks:

- Patient CRUD
- Patient search
- Patient detail shell
- Medical history form
- Consent form
- Signature capture
- Patient timeline

Acceptance:

- New patient can be registered.
- Medical history version saved.
- Consent signed and visible.
- Audit logs created.

## Sprint 3 — Dental chart and treatment

Tasks:

- Odontogram component
- Tooth condition legend
- Tooth drawer
- Chart versioning
- Treatment record CRUD
- Ortho treatment table

Acceptance:

- Dentist can record tooth finding.
- Chart version history works.
- Treatment record links to patient.

## Sprint 4 — Appointments and queue

Tasks:

- Appointment calendar
- Conflict validation
- Check-in flow
- Queue management
- Queue display route
- Reconnect/cache state

Acceptance:

- Appointment created.
- Patient checked in.
- Queue display shows code.
- API failure does not show raw error.

## Sprint 5 — Billing

Tasks:

- Invoice list
- Invoice detail
- Invoice items
- Payment ledger
- Balance calculation
- Void flow
- Daily collections report

Acceptance:

- Invoice generated from treatment.
- Payment updates balance.
- Void requires reason.
- Money format correct.

## Sprint 6 — HMO

Tasks:

- HMO provider CRUD
- Claim draft from invoice
- Claim status flow
- Aging report
- Reconciliation export

Acceptance:

- Claim lifecycle works.
- Invalid transitions blocked.
- Provider report export works.

## Sprint 7 — Kiosk and patient portal

Tasks:

- Kiosk config
- Patient lookup
- Intake form on tablet
- Consent signing on kiosk
- Staff override
- Session timeout

Acceptance:

- Patient can check in on kiosk.
- Kiosk handles network failure safely.
- No full patient list exposed.

## Sprint 8 — Operations polish

Tasks:

- Notifications/SMS skeleton
- Reports hub
- Audit log UI
- Settings
- Data export
- Security review
- Accessibility pass

Acceptance:

- Clinic can run daily operations.
- Audit and privacy controls visible.
- Staff training flow ready.

## Backlog — v2 ideas

- AI-assisted note summary
- OCR import from old paper forms
- Patient mobile app
- Multi-branch patient sync
- Inventory
- Advanced analytics
- PhilHealth eClaims connector
- Online payment integration
- Dental imaging integration
- QR check-in

## Top 10 immediate TODOs

1. Decide app name and repo stack.
2. Build auth + clinic context.
3. Create database schema migration.
4. Build patient CRUD.
5. Build medical history versioning.
6. Build consent signing.
7. Build odontogram MVP.
8. Build appointment + check-in.
9. Build invoice + payment ledger.
10. Build audit log and permission checks.

## Risk register

| Risk | Severity | Mitigation |
|---|---:|---|
| Real patient data leak | Critical | Encryption, RBAC, audit, PII redaction |
| Billing math wrong | Critical | Minor units, transactions, tests |
| Kiosk exposes patient search | High | Scoped token, lookup verification |
| Dental chart too slow to use | High | Paper-like UI, minimal clicks |
| HMO workflow varies by clinic | Medium | Configurable provider/status model |
| PhilHealth scope unclear | High | Feature flag, legal/compliance validation |
| AI agent invents architecture | Medium | Keep `AGENTS.md` strict |
