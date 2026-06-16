# Functional Flow Audit — 2026-06-16

Scope: screens, user-facing functions, operational workflow links, and route-state coverage.
Out of scope for this pass: deploy, infra, secret wiring, deep DB correctness, external vendor go-live steps.

## Current status

- Core route coverage is broad. Internal modules are present across dashboard, patient, billing, queue, waitlist, kiosk, display, portal, inventory, reports, and settings surfaces.
- Earlier cross-flow gaps are mostly closed in code:
  - intake completion redirects to patient profile: `src/app/(dashboard)/patients/new/page.tsx`
  - consent deep links exist from patient and queue flows
  - appointments page links forward into queue and waitlist
  - treatment plan and billing pages link into HMO / workflow follow-up paths
  - queue checkout exposes note creation
- The newer encounter-based visit flow is now threaded through queue, patient visits, treatment plan, billing, and dentist workspace.

## Verified strong areas

- `Patients -> Visits -> Notes / Chart / Plan / Billing`
  - encounter-aware links exist
  - patient visit workspace can open queue, plan, and visit detail paths
- `Appointments -> Check-in -> Queue`
  - queue link and waitlist follow-up link exist on appointments
- `Queue -> Consent / Notes / Billing`
  - consent deep link and note creation CTA exist
- `Treatment plan -> Billing / HMO`
  - HMO draft deep links exist from plan and invoice detail
- `Dashboard attention -> operational modules`
  - attention rules target billing, queue, waitlist, dentist, and workflow settings

## Remaining functional gaps

### 1. Route-state coverage is uneven

Some screens rely on parent boundaries or inline state, but not all had their own route-level fallbacks. This increases the chance of rough transitions or generic crash handling on busy clinic paths.

Priority screens:

- `/dentist`
- `/lab-cases`
- `/reports` and child report flows
- `/patients/[id]/visits`

Action started in this pass:

- added route-level error/loading coverage for dentist, lab cases, reports, and patient visits

### 2. Workflow automation visibility was inconsistent

Workflow toggles already affect appointments, queue, billing, and encounter closeout behavior, but the shortcut to automation settings was only consistently visible on a subset of screens.

Action started in this pass:

- added `WorkflowSettingsLink` visibility to:
  - dentist workspace
  - billing board
  - patient visits page

### 3. Encounter flow has stronger code than test coverage

The new encounter-based journey is implemented across:

- queue check-in / reuse
- patient visits timeline
- carry-forward into notes and treatment plans
- billing closeout automation

But coverage is still lighter than the surface area:

- lightweight script exists: `scripts/verify-encounter-journey.ts`
- dedicated end-to-end flow confidence is still behind the feature breadth

Recommendation:

- add one focused E2E path: `appointment -> check-in -> queue -> note/plan -> invoice -> paid -> encounter closed`

### 4. Workflow discoverability is still operationally selective

Even after this pass, the workflow chip is not yet surfaced on every automation-sensitive screen. Next useful additions would be:

- patient profile main page
- reports closeout
- notifications settings

## Practical next batch

1. Add one full encounter E2E journey spec.
2. Surface workflow chip on remaining automation-sensitive screens.
3. Continue route-level state coverage pass for lower-priority child routes if needed.
4. Run a browser walkthrough for:
   - appointments
   - queue
   - dentist
   - patient visits
   - billing
   - reports

## Files touched in this pass

- `src/lib/showcase/load-showcase-data.ts`
- `scripts/verify-attention-rules.ts`
- `src/app/(dashboard)/dentist/page.tsx`
- `src/app/(dashboard)/billing/page.tsx`
- `src/app/(dashboard)/patients/[id]/visits/page.tsx`
- new route-state files under `src/app/(dashboard)/dentist`, `lab-cases`, `reports`, and `patients/[id]/visits`
