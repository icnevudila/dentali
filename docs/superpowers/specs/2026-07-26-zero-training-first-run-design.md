# Zero-training first-run

**Status:** Implemented (2026-07-26) — branch `feat/zero-training-first-run`  
**Goal:** Clinic can complete first patient → appointment → payment path without staff training or hunting Workflow settings.

## Product rules

1. New orgs/branches ship with **workflow automations ON** (safe clinical defaults).
2. After onboarding, a **≤3 step first-run** guides: confirm clinic → optional invite/add staff → add first patient (primary CTA).
3. Empty lists teach with **one sentence + one primary button** (no multi-option walls).
4. No long docs; dismissible one-shot tips only if needed.
5. Stub banners (PayMongo etc.) stay small — not blocking.

## Non-goals

- DICOM gateway  
- Live PayMongo/PhilHealth accounts  
- Full product tour library / video  

## Implementation sketch

- DB/service: ensure `branch_workflow_settings` defaults enable check-in / served / plan→invoice (and related) on branch create  
- UI: first-run card or wizard on dashboard until dismissed / first patient exists  
- Patients + Appointments empty states → single CTA  

## Success

Owner finishes onboarding and creates first patient in &lt;5 minutes without opening Settings → Workflow.
