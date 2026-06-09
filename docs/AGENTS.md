# AGENTS.md

You are working on a Philippines-based dental clinic management system.

## Non-negotiables

- Use TypeScript strict.
- Do not use real patient data in seeds, tests, screenshots, logs, or examples.
- Do not log PHI/PII.
- Enforce permissions in the backend, not only in the frontend.
- Every critical mutation must create an audit log event.
- Money must be stored as integer minor units, never float.
- Use `Asia/Manila`, `en-PH`, and `PHP` defaults.
- Kiosk and queue screens must never show raw technical errors.
- Every data UI must handle loading, empty, error, and ready states.
- Do not overwrite medical history or dental chart silently; version it.

## Build order

1. Auth + clinic context
2. Design system
3. Patients
4. Medical history + consent
5. Dental chart
6. Appointments + queue
7. Treatments
8. Invoices + payments
9. HMO tracking
10. Reports + audit UI

## Code organization

Keep domain logic out of components. Use module boundaries:

- schema
- types
- service
- repository
- api/controller
- permissions
- audit

## Done means

- Typecheck passes.
- Permission checks exist.
- Audit events exist when required.
- UI states are complete.
- Tests or smoke checks are added.
- No PHI/PII appears in logs or seeds.
