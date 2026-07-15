# Medical History OCR Import (v2) — Design

**Date:** 2026-07-15  
**Status:** Approved for spec; implementation plan pending user review of this file  
**Owner surface:** `src/app/(dashboard)/patients/[id]/medical-history`

## Problem

Clinics often hold legacy **paper medical / anamnesis forms**. Staff retype allergies, medications, and conditions into dentQL. We want a **scan → draft → human confirm → versioned save** path without a native app.

## Goals

- Import from **camera photo** or **file upload** (image/PDF).
- Prefer the clinic’s **standard printed form** in MVP (layout hints in the prompt).
- Never silently overwrite medical history; always create a **new version** via existing `create_medical_history_version`.
- Keep PHI out of client/server logs; kiosk-style user-facing errors for failures.

## Non-goals (MVP)

- Native iOS/Android app
- Bulk import queue / batch desk
- Guaranteed handwriting accuracy on arbitrary third-party forms
- HMO / PhilHealth / ID card OCR (follow-up)
- Auto-creating new patients from a form
- Org-wide “force OCR” settings

## Decisions locked

| Topic | Choice |
|-------|--------|
| Placement | Patient → Medical History → “Import from paper” |
| Capture | Camera + file upload |
| Form priority | Clinic standard printed form first; mixed forms later |
| Architecture | Supabase Storage + Edge Function + vision model |
| Persist | Human review required; then `create_medical_history_version` |
| Permission | `patients.medical_history.write` |

## Architecture

```
[Medical History UI]
      │ 1. upload image/PDF
      ▼
[Supabase Storage: medical-history-imports]
      │ 2. invoke with storage path + patient/branch ids
      ▼
[Edge Function: medical-history-ocr]
      │ 3. download object, call vision provider, parse JSON
      ▼
[UI draft editor]
      │ 4. staff edits fields, Save
      ▼
[RPC create_medical_history_version]
      │ 5. audit event medical_history.ocr_import
      ▼
[patient_medical_histories new version]
```

### Modules (boundaries)

| Unit | Responsibility |
|------|----------------|
| `ocr-import-ui` (page section / drawer) | Capture, show draft, edit, save/cancel |
| `medical-history-ocr-service` (client) | Upload to storage, call Edge Function, map errors |
| Edge Function `medical-history-ocr` | AuthZ, storage read, provider call, structured output validation |
| Existing `medical-history-service` | `saveMedicalHistory` / version RPC unchanged except optional `source` metadata if RPC already allows notes |
| Audit | Event on successful save (and optionally on OCR request start without PHI body) |

## Data model

### Storage

- Bucket: `medical-history-imports` (private).
- Path: `{organization_id}/{branch_id}/{patient_id}/{uuid}.{ext}`
- RLS / policies: authenticated staff with `patients.medical_history.write` for that branch/org; no anon access.
- Retain originals for audit/dispute; retention policy deferred (document “keep indefinitely until ops sets TTL”).

### Draft shape (Edge Function response)

```ts
type MedicalHistoryOcrDraft = {
  allergies: string[]
  medications: string[]
  conditions: string[]
  notes: string | null
  confidence: {
    overall: number // 0–1
    allergies?: number
    medications?: number
    conditions?: number
    notes?: number
  }
  warnings: string[] // e.g. "low_contrast", "partial_page"
  source_storage_path: string
}
```

- Empty arrays allowed.
- Model free-text that does not map cleanly goes into `notes` with a warning, never invented patient identity fields.

### Persistence

On confirm, call existing:

```ts
saveMedicalHistory({
  patientId,
  organizationId,
  userId,
  branchId,
  allergies,
  medications,
  conditions,
  notes,
})
```

Optional (if easy without RPC break): append a one-line provenance in `notes` such as  
`[Imported from paper scan YYYY-MM-DD; staff-reviewed]`  
— only if product agrees; otherwise provenance lives only in audit + storage path.

### Audit

- Action: `medical_history.ocr_import`
- Payload (no raw OCR text, no image bytes): `patient_id`, `branch_id`, `storage_path`, `version`, `field_counts`, `overall_confidence`
- Actor: authenticated user id

## Edge Function contract

- **Auth:** JWT required; verify `patients.medical_history.write` for `branch_id`.
- **Input:** `{ patient_id, branch_id, organization_id, storage_path }`
- **Output:** `MedicalHistoryOcrDraft` or typed error `{ code, message }` where `message` is staff-safe.
- **Provider:** configurable env (e.g. OpenAI-compatible vision or Anthropic); secret only on Edge.
- **Prompt:** instruct extraction into the four fields; include optional clinic form field labels (config/env or small JSON in repo, not PHI).
- **Limits:** max file size ~8 MB; accept `image/jpeg`, `image/png`, `image/webp`, `application/pdf` (PDF: first 1–2 pages in MVP).
- **Timeouts / failure:** return friendly error; do not leave half-saved history versions.

## UI / UX

1. Button **Import from paper** on medical history (visible if write permission).
2. Sheet/modal: take photo or choose file → upload progress → “Reading form…” → draft form pre-filled.
3. Show confidence: if `overall < 0.6`, amber banner: review carefully.
4. Side-by-side optional: thumbnail of upload + editable fields (desktop); stacked on mobile.
5. **Save as new version** / **Discard** (discard does not delete storage object in MVP; soft-ok, or delete on discard if cheap).
6. Loading / empty / error / ready states required; never show raw provider errors.

## Security & privacy

- No PHI in `console.log`, toast internals, or Edge request logs of response body.
- Storage paths are UUID-based; listings limited by policy.
- Function uses service role only for storage download after AuthZ of the caller.
- Do not send the file to a third party without a clinic-level decision; document which provider is wired in env.

## Testing / acceptance

- Unit: draft JSON schema validation (reject extra dangerous keys / wrong types).
- Service smoke: upload mock path → mock Edge response → UI binds fields.
- Manual: photo of blank clinic form + filled form; confirm new `version` increments; audit row present; latest history banner/allergies update.
- Permission denied path for user without `patients.medical_history.write`.

## Rollout

1. Migration: bucket + policies (+ optional `ocr_import` audit action allow-list if needed).
2. Edge Function + secrets.
3. Client service + UI on medical-history page.
4. Staging smoke with synthetic (non-real) patient form images only.
5. Docs: short ops note for env keys (no secrets in git).

## Follow-ups (explicitly later)

- Mixed third-party / handwriting-heavy forms
- Multi-page >2, batch imports
- HMO/ID card OCR
- Retention TTL + purge job

## Open implementation choices (not blockers)

- Exact vision vendor SDK (pick when implementing based on existing clinic AI keys, if any).
- Whether provenance line is appended to `notes` vs audit-only (default: **audit-only** unless UI needs visible badge).
