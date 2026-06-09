# 22 — PhilHealth / eClaims Readiness

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

![Example screen](../../screens/22_PHILHEALTH_ECLAIMS.png)

## 1. Module purpose

PhilHealth/eClaims için readiness checklist, claim metadata, documents, encryption/payload referansları ve sync log altyapısını hazırlar.

## 2. Phase and priority

**Phase:** Phase 3 Compliance/Risk

Priority logic:

- MVP modülleri veri omurgasını kurar.
- Phase 2 modülleri operasyonu hızlandırır.
- Phase 3 modülleri regülasyon ve entegrasyon riskinden dolayı ayrı sertleştirilir.

## 3. Primary user roles

- Admin
- Billing Staff
- Owner

## 4. Screens in this module

- PhilHealth readiness dashboard
- Claim checklist
- Claim detail
- Failed syncs
- Settings/security
- Batch export log

## 5. UI/UX direction

Bu modül demo değil risk ekranı gibi durmalı: checklist, missing fields, sync log, masked payload refs.

### Layout contract

```txt
AppShell
 ├─ Sidebar
 └─ Main
    ├─ Topbar: active branch + sync/session state
    └─ PageContainer
       ├─ PageHeader: title, description, primary action
       ├─ ActionBar / FilterBar
       ├─ MainContent
       └─ Drawer / RightPanel when detail is selected
```

### Component requirements

- PageHeader
- BranchSwitcher awareness
- FilterBar when list/table exists
- DataTable with loading/empty/error states
- StatusBadge for all operational states
- DetailDrawer for edit/review actions
- ConfirmationDialog for destructive or financial/legal actions
- AuditDrawer when module touches critical records

## 6. Required UI states

### Loading

Skeleton layout mirrors final layout. Do not use a lonely spinner on a blank page.

### Empty

Empty state must explain what is missing and offer next action.

Example:

```txt
No records yet.
Create the first record for this branch or switch branch.
```

### Error

Admin/staff screen can show human-readable error + retry. Do not expose stack traces.

### Permission denied

Show role/branch access reason in plain language.

### Saving / retrying

Any write action must show `saving`, `saved`, `failed`, and optional retry.

### Offline / reconnecting

Use for kiosk, queue, TV, realtime or critical workflows. Show last successful data when safe.

## 7. Core workflows

1. Create claim record → required fields checklist
2. Validate documents → mark ready
3. Generate encrypted/export payload via Edge Function
4. Submit/sync → response stored masked
5. Failed sync → retry queue

## 8. Supabase tables

- `philhealth_claims`
- `philhealth_claim_documents`
- `philhealth_sync_logs`
- `encrypted_payload_refs`
- `audit_logs`

### Table scope decisions

- Use `organization_id` on every tenant-owned table.
- Use `branch_id` on branch-scoped operational records.
- Use `created_by`, `updated_by`, `created_at`, `updated_at` for auditability.
- Avoid hard delete for clinical, financial, legal, or audit-sensitive records.

## 9. RLS policy rules

Highly sensitive. Admin/Billing only. Payload plaintext DBde tutulmaz; documents private storage.

### Baseline policy pattern

```sql
-- Example only. Module implementation must adjust table and permission key.
create policy "authorized branch members can read"
on <table_name>
for select
to authenticated
using (
  organization_id = public.current_user_org_id()
  and (
    branch_id is null
    or public.user_has_branch_access(branch_id)
  )
);
```

### Write policy rule

Write operations should additionally check module permission:

```sql
public.has_permission('<module.permission>', branch_id)
```

## 10. RPC / database functions

- `get_philhealth_readiness(claim_id)`
- `mark_philhealth_document_verified(doc_id)`

### RPC rules

- Use RPC for state transitions.
- Use RPC for multi-table writes.
- Use RPC for financial totals.
- Use RPC for branch-scoped dashboards.
- Keep RPC idempotent when called by Edge Functions or retrying UI.

## 11. Edge Functions

- `validate-philhealth-claim`
- `generate-philhealth-payload`
- `submit-philhealth-claim`

### Edge Function rules

- Never expose `service_role` to browser.
- Store secrets in Supabase secrets.
- Log request id, actor id, branch id, and safe error code.
- Do not log PHI, payment secrets, or raw PhilHealth/HMO payloads.

## 12. Events emitted

- `philhealth.claim_created`
- `philhealth.validated`
- `philhealth.submitted`
- `philhealth.sync_failed`

Events should be logged to audit where critical and optionally published to realtime where operationally useful.

## 13. Connected modules

- Patients
- Consent
- Documents
- Invoices
- Audit
- Settings

## 14. Module-to-module contract

This module must not duplicate data owned by connected modules. It may cache display summaries, but source of truth remains in the owning module.

Cross-module calls should use:

- foreign keys for persistent relationships
- RPC for state transitions
- events/audit for observability
- storage links for documents, never public raw files unless explicitly public

## 15. Audit log rules

Audit required for:

- create/update/delete or status transition of critical records
- permission/role/branch changes
- patient PHI updates
- clinical chart/note changes
- consent signing/voiding
- invoice/payment/claim actions
- settings/token changes

Audit fields:

```txt
id
organization_id
branch_id
actor_user_id
action
entity_type
entity_id
before_json
after_json
ip_address
user_agent
created_at
```

## 16. Validation rules

- Validate on frontend for UX, backend for truth.
- Required fields depend on role, branch, and status.
- Branch-scoped records require active branch.
- Finalized/locked records cannot be edited without a new version or void/reason flow.

## 17. Testing checklist

- [ ] Plaintext sensitive payload loglanmaz
- [ ] Ready olmadan submit yok
- [ ] Failed sync retry idempotent
- [ ] Loading, empty, error, permission, saving states exist.
- [ ] RLS denies unauthorized branch access.
- [ ] Audit log is written for critical operations.
- [ ] Mobile/tablet layout does not break.
- [ ] No raw technical error appears on patient-facing views.

## 18. AI implementation rules for this module

Before coding, AI agent must output:

```txt
Component tree:
Supabase tables touched:
RLS policies required:
RPC/Edge functions required:
UI states covered:
Module relationships:
Risks and assumptions:
```

AI must not invent new visual language outside the UI/UX master spec.

## 19. Example screen file

`/screens/22_PHILHEALTH_ECLAIMS.png`

This is a direction-lock mockup/wireframe, not final Figma.
