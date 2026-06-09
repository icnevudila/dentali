# Prompts for AI Coding Agents

Bu promptları Cursor/Claude/ChatGPT gibi araçlara task bazlı ver.

## 1. Repo bootstrap prompt

```txt
You are building a Philippines-based dental clinic management system.
Before coding, read AGENTS.md and all markdown files in /docs/product.
Use TypeScript strict, Next.js admin web, PostgreSQL, and a backend with clear service/repository boundaries.
Do not invent patient data. Do not log PHI/PII.
Start by creating the app shell, design tokens, API response types, permission helpers, and audit log model.
Return a short implementation plan before editing files.
```

## 2. Patient module prompt

```txt
Build the patient module.
Requirements:
- Patient CRUD
- Search by name/phone
- Patient detail page with tabs
- Backend clinic scoping
- Permission checks
- Audit events for create/update
- Loading/empty/error states in UI
- No real patient seed data
Read 04_PATIENT_RECORD_REQUIREMENTS.md, 09_DATABASE_SCHEMA.md, and 10_API_CONTRACTS.md first.
```

## 3. Medical history prompt

```txt
Implement versioned medical history for patients.
Use a schema-driven questionnaire with yes/no/unknown answers and conditional notes.
Save each submission as a new version.
Show latest version by default and version history for permitted users.
Add audit log events.
Do not overwrite old medical history.
```

## 4. Consent prompt

```txt
Implement consent records with signature capture.
Consent must store type, version, body text, signed by, signer role, signedAt, and signature asset reference.
Assets must be private.
Void requires reason and audit log.
Before invasive treatment, show warning if required consent is missing.
```

## 5. Odontogram prompt

```txt
Build an MVP odontogram component using FDI numbering.
Support permanent and primary teeth.
User can select a tooth, set condition code, choose restoration/surgery codes, set surfaces, and add notes.
Save chart as versioned dental_chart_versions record.
Include legend and responsive layout.
```

## 6. Appointment + queue prompt

```txt
Implement appointment scheduling and queue check-in.
Appointments must prevent dentist double-booking and outside-hours booking unless admin override exists.
Check-in creates a queue entry with displayCode.
Queue display endpoint must expose display codes, not full patient details.
Queue display UI must cache last successful response and show reconnecting instead of raw errors.
```

## 7. Billing prompt

```txt
Implement invoices and payments.
Use integer minor units for PHP.
Invoice totals and balances must be calculated server-side in a DB transaction.
Payment cannot exceed balance unless unapplied credit is explicitly implemented.
Void requires reason.
Add audit events for invoice issued, payment recorded, and invoice voided.
```

## 8. HMO prompt

```txt
Implement HMO providers and HMO claims.
MVP is tracking only, not external integration.
Provider CRUD, claim draft from invoice, status transitions, requested/approved amounts, rejection reason, paid date.
Enforce claim state flow server-side.
Add HMO aging report endpoint.
```

## 9. Kiosk prompt

```txt
Build patient-facing kiosk flow.
Use scoped kiosk token.
Support check-in, new patient intake, medical history update, and consent signing.
Do not expose full patient search.
All errors must be patient-safe. Never show HTTP status, stack trace, undefined, or translation keys.
Auto-timeout inactive sessions.
```

## 10. QA prompt

```txt
Create tests for the critical dental clinic workflow:
create patient -> medical history -> consent -> appointment -> check-in -> chart update -> treatment -> invoice -> payment -> audit log.
Also test unauthorized cross-clinic access, invalid invoice payment, invalid claim transition, and queue API failure.
```

## 11. Refactor prompt

```txt
Refactor without changing behavior.
Keep module boundaries intact.
Do not move business logic into UI components.
Do not remove audit or permission checks.
After refactor, run typecheck and relevant tests.
Summarize files changed and risks.
```

## 12. Design system prompt

```txt
Implement the UI design system from 05_UI_UX_SYSTEM.md.
Create Button, Card, Input, StatusBadge, MetricCard, EmptyState, ErrorState, DataTable, PageHeader, and AppShell.
Every component must support accessible labels and responsive behavior.
Do not use random colors; use tokens only.
```
