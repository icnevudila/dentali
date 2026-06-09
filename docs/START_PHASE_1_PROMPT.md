You are a senior full-stack product engineer building a Philippines-based, multi-branch dental clinic operating system.

The `/docs` folder is the source of truth. Do not invent product behavior, UI patterns, database models, permissions, workflows, colors, spacing, components, or backend architecture outside these documents.

First verify that these files exist:

- `docs/00-master/00_PRODUCT_MASTER_PLAN.md`
- `docs/00-master/01_MODULE_MAP.md`
- `docs/00-master/02_MULTI_BRANCH_ARCHITECTURE.md`
- `docs/00-master/03_SUPABASE_BACKEND_RULES.md`
- `docs/00-master/04_UI_UX_MASTER_RULES.md`
- `docs/00-master/05_AI_AGENT_RULES.md`
- `docs/01-foundation/01_ORGANIZATION_MULTI_BRANCH.md`
- `docs/01-foundation/02_AUTH_ROLES_PERMISSIONS.md`
- `docs/01-foundation/03_STAFF_TEAM.md`
- `docs/01-foundation/04_SETTINGS_CONFIGURATION.md`

If any file is missing, stop and report exactly which file is missing.

If all files exist, read them first.

Backend must be Supabase-first:

- Supabase Auth
- Supabase Postgres
- Row Level Security
- Supabase Storage where needed
- Supabase Realtime where needed
- Supabase Edge Functions only where needed
- SQL migrations must live under `supabase/migrations`
- Do not rely on frontend-only permission checks
- Every sensitive table must have RLS enabled
- Multi-branch access must be enforced at database policy level

Frontend rules:

- Use TypeScript
- Use a clean modular structure
- Use the UI/UX rules from the docs
- Do not create random gradients, random dashboards, random colors, or fake SaaS decoration
- Every screen must support loading, empty, error, permission denied, and success states
- UI must feel like a real clinic operations system, not a generic AI-generated dashboard

Project goal for this task:

Start only Phase 1 Foundation.

Do not implement patient registry, dental chart, appointments, invoices, kiosk, HMO, PhilHealth, inventory, reports, or queue yet.

Implement only:

1. Organization structure
2. Multi-branch structure
3. Supabase Auth profile connection
4. Roles
5. Permissions
6. Staff branch assignment
7. Basic settings foundation
8. Audit log foundation
9. Branch switcher foundation
10. Minimal protected app shell

Required database tables:

- `organizations`
- `branches`
- `profiles`
- `roles`
- `permissions`
- `role_permissions`
- `staff_branch_assignments`
- `branch_settings`
- `audit_logs`

Required backend behavior:

- Users belong to an organization.
- Users may access one or more branches.
- Role alone is not enough; branch assignment matters.
- Owner/Admin can manage organization-level settings.
- Branch Manager can manage assigned branch settings.
- Dentist, Receptionist, Billing Staff, Dental Assistant, Viewer have limited access.
- RLS policies must prevent cross-organization and unauthorized cross-branch access.
- Audit logs must be ready for critical actions.
- Add indexes for `organization_id`, `branch_id`, and common lookup fields.
- Add seed roles and seed permissions.
- Add helper SQL functions only when necessary for permission checks.

Required frontend structure:

Create or adapt this structure:

- `src/app`
- `src/components/app-shell`
- `src/components/ui`
- `src/modules/foundation`
- `src/modules/auth`
- `src/modules/branches`
- `src/lib/supabase`
- `src/lib/permissions`
- `src/lib/audit`
- `src/lib/branch-context`
- `src/styles`

Required frontend components:

- `AppShell`
- `Sidebar`
- `Topbar`
- `BranchSwitcher`
- `ProtectedRoute` or equivalent route guard
- `PermissionGate`
- `PageHeader`
- `Card`
- `Button`
- `Input`
- `StatusBadge`
- `EmptyState`
- `ErrorState`
- `LoadingState`

Required pages:

- Login page
- Basic dashboard placeholder
- Branch selection page
- Staff list placeholder
- Settings placeholder
- Permission denied page

Important implementation order:

1. Inspect the current repo structure.
2. Report what stack already exists.
3. Create a Phase 1 implementation plan.
4. Create Supabase migrations.
5. Create RLS policies.
6. Create seed data.
7. Create Supabase client helpers.
8. Create permission helpers.
9. Create branch context helpers.
10. Create minimal protected frontend shell.
11. Add basic tests or validation checklist.
12. Report every file changed.

Hard rules:

- Do not implement all 24 modules.
- Do not create fake data models outside the docs.
- Do not skip RLS.
- Do not create frontend screens that bypass backend permissions.
- Do not store sensitive patient or clinical data in this phase.
- Do not add patient, appointment, invoice, dental chart, kiosk, or HMO tables yet.
- Do not use placeholder security.
- Do not claim something is complete unless files were actually created or changed.
- If there is ambiguity, make the safest production-grade assumption and document it.

Before writing code, output a concise Phase 1 plan with:

1. Existing repo status
2. Files you will create
3. Supabase tables
4. RLS policy summary
5. Seed roles and permissions
6. Frontend routes/components
7. Risks and assumptions

After the plan, implement Phase 1 Foundation only.
