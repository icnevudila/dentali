# Project Rules (rules.md)

## Core Technical Rules (from AGENTS.md)

- **TypeScript strict** – `tsconfig.json` must enable `strict` mode. No `any`; use `unknown` with proper validation.
- **No real patient data** – Seeds, tests, screenshots, logs, or any example must never contain real PHI/PII.
- **Privacy** – Never log PHI/PII. All logs must redact sensitive fields (names, phone numbers, addresses, medical notes, signatures).
- **Backend permission enforcement** – Every API endpoint must validate the user’s role/permission; frontend hiding is not sufficient.
- **Audit logging** – Every critical mutation (create/update/delete of patients, medical history, consents, dental chart, appointments, invoices, payments, HMO claims, staff/role changes, settings) must generate an entry in `audit_logs` with before/after snapshots.
- **Money representation** – Store all monetary values as **integer minor units** (PHP centavos). Never use floating‑point numbers for financial calculations.
- **Locale & timezone defaults** – `Asia/Manila` timezone, `en-PH` locale, currency `PHP`.
- **Error handling on patient‑facing screens** – Kiosk, queue TV, and any patient‑visible UI must never display raw technical errors; show friendly messages instead.
- **UI state handling** – Every data‑driven UI component must implement **loading, empty, error, ready** states (and for Supabase: stale, reconnecting, permission_denied).
- **Versioned records** – Medical history, consent, dental chart, and treatment records must be **versioned**, never silently overwritten.

## UI/UX Design Rules (from PH_Dental_App_UI_UX_Master_Spec.md)

### No‑AI‑Slop Rules
- No random gradients or decorative colors without purpose.
- No generic KPI cards; each must drive an actionable insight.
- Tables must be readable **before** they are pretty; include proper headers and pagination.
- Empty states must **teach** the next action; error states must be human‑readable.
- Dental chart must follow the FDI tooth‑numbering system and support surface‑level interaction.
- Payment records must be auditable and display currency symbols.

### Visual Rules
- **Primary brand color**: Teal (`#008C8C`). Used for primary buttons, active navigation, progress indicators.
- **Status colors**: Red = danger/rejected/overdue, Orange = warning/pending, Green = completed/paid/approved, Blue = informational/system, Gray = draft/disabled.
- Shadows must be subtle; no heavy drop shadows.
- Gradients are prohibited except for approved marketing pages.
- Icons always accompanied by a text label – never replace labels with icons.
- No emoji in clinical or admin interfaces.

### Layout Rules
1. Each screen has **one primary purpose** and **one obvious primary action**.
2. Content width is limited (max‑width 1280 px for most pages; up to 1440 px for data‑heavy tables).
3. Related actions stay near the content they affect; never hide critical actions behind hover only.
4. Navigation layout must stay consistent across screens (sidebar, top‑bar, page header).
5. Tables must have pagination, sortable columns, and clearly visible loading/empty/error states.

### Component Rules
- **Button**: Variants – primary, secondary, ghost, danger, warning, link. Sizes – sm (32 px), md (40 px), lg (48 px), kiosk (≥56 px). Only one primary button per page header.
- **Input**: Always label visible, placeholder not a label, required fields marked, errors displayed under the field. Phone input must support Philippine numbers, currency inputs show `₱`.
- **Select/Combobox**: Used for patient search, dentist search, procedure selection.
- **DataTable**: Must support loading skeleton, empty state, error state, pagination, search/filter, row actions, responsive compact mode. Money columns right‑aligned.
- **StatusBadge**: Color + text; never rely on color alone.
- **Modal**: Confirm destructive actions, show pending state for Edge Function calls, prevent double submit.

### Supabase‑First UX Implications
- Every data surface must handle the following supersets of UI states:
  ```txt
  loading
  empty
  error
  ready
  stale
  reconnecting
  permission_denied
  ```
- Distinguish *no data* vs *no permission* with clear messages.
- Realtime updates (queue, appointment status) must display **Live / Reconnecting** indicators and fallback to polling if needed.
- Storage uploads show file type, progress, permission status, and no raw bucket paths.
- Edge Function actions show pending state, prevent double‑click, and return human‑readable results.

## Project‑Specific Rules
- **Repository location**: All source code lives under `c:\Users\TP2\Documents\2026 yeni dişçi`.
- **Naming**: Follow kebab‑case for file names, PascalCase for classes/types, camelCase for functions/variables.
- **Folder structure** per module: `schema → types → service → repository → api/controller → permissions → audit`.
- **Testing**: Every critical mutation must have unit tests; end‑to‑end tests must cover the 12 core workflows.
- **Accessibility**: WCAG AA contrast, focus states, keyboard navigation, large touch targets (≥48 px) for kiosk.
- **Data retention**: Audit logs retained per legal requirements (e.g., 7 years). Configurable via settings.
- **Deployment**: Docker‑compose with Supabase services; environment variables must not contain secrets in code.

---
*These rules should be referenced by developers throughout the codebase to ensure compliance with the product’s non‑negotiables and design philosophy.*

## Localization / Internationalization
- Default locale: `en-PH`. The UI must support English (`en`), Turkish (`tr`), and Filipino (`fil`) languages.
- All user‑facing strings go through an i18n system; each key must have translations for the three locales with English fallback.
- Do not expose raw translation keys in the UI.
- Dates, times, numbers, and currency must be formatted according to the active locale using `Intl`.

## Module‑Specific Requirements

- **Billing / Invoices Module**
  - Must provide **PDF export** for individual invoices and invoice summaries.
  - Must provide **Excel/CSV export** for financial reports (payments, balances, aging).  
  - Export endpoints enforce the same permission checks as the UI view and never expose PHI/PII beyond the authorized user.

- **Dental Chart Module**
  - Must include the **Visual Odontogram** component (FDI numbering, interactive editing, versioned saves).
  - Must support **PNG and PDF export** of the odontogram, including the legend and hiding UI controls.
  - Export respects the design‑system colors (`--primary-soft`, status colors) and maintains a minimum 48 px touch target on tablet.

- **Queue / Dashboard Module**
  - Must allow **CSV export** of the current queue data for administrative purposes, with columns localized and `exported_at` timestamp.
  - Export respects Supabase RLS; users without permission see a permission‑denied message instead of data.

- **Reports Module**
  - All generated reports (daily collections, HMO aging, productivity) must be available as **PDF** and **Excel** where applicable.
  - Report export follows the same locale (`en-PH`) and currency formatting rules.

These module‑specific rules complement the general **Export Formats** and **Visual Odontogram Component** sections already defined earlier in this document.
## Export Formats
- **PDF Export**: All printable views (Invoices, Treatment summaries, Patient charts) must support PDF export with vector graphics where possible. PDFs must embed fonts and use the `en-PH` locale for dates and currency. No PHI/PII is exposed beyond what the user is authorized to see.
- **Excel/CSV Export**: Tabular data (appointments, payments, HMO claims, audit logs) must be exportable as XLSX and CSV. Column headers must be human‑readable, localized, and include an explicit `exported_at` timestamp in ISO format. Sensitive columns (e.g., full patient address) must be omitted for users without the required permission.
- **Export Security**: Export endpoints must enforce the same permission checks as the corresponding UI view. Files are generated server‑side and streamed; no temporary files are written to the client’s filesystem.

## Visual Odontogram Component
- The odontogram must render the **FDI tooth‑numbering** system for both permanent and primary dentition.
- Each tooth is interactive: clicking selects the tooth, opening a side‑drawer to edit condition, restoration, surgery, surface selection, and notes.
- All changes are saved as a **versioned dental_chart** record; the UI never overwrites previous versions silently.
- The component must be responsive: on tablets the tooth grid scales to fit the screen, maintaining a minimum touch target of 48 px.
- Visual styling follows the design system colors: surface highlights use `--primary-soft`, selected tooth uses `--primary` background, and condition badges use status colors (green → present, red → extracted, orange → caution, etc.).
- Exporting the odontogram as an image (PNG) or PDF is required for patient records; the export must include the legend and hide any UI controls.
