# Modül Bazlı UI/UX + Backend Entegrasyon Planı

> Kaynak: `docs/00-master/*`, `docs/01-foundation/*` … `docs/05-control-intelligence/*`, `docs/13_PAGE_BY_PAGE_REQUIREMENTS.md`, `docs/AGENTS.md`  
> Güncelleme: 2026-06-09  
> Amaç: Her modülü **sırayla** bitirmek — önce backend (migration + RLS + RPC), sonra UI, sonra entegrasyon + kabul testi.

---

## Nasıl kullanılır?

Her modül için aynı sıra:

1. **MD oku** → ilgili `docs/**/XX_MODULE.md` + `docs/screens/XX_*.png`
2. **Backend** → `supabase/migrations/` (tablo, RLS, RPC, seed permissions)
3. **Domain layer** → `src/lib/<module>/` (types, validators, service functions)
4. **UI** → routes + components (loading / empty / error / permission denied / saving)
5. **Entegrasyon** → Supabase client/server, branch context, audit log
6. **Kabul** → modül MD’sindeki checklist + smoke test

**Kural (docs/README.md):** MD yoksa kod yok. RLS yoksa merge yok. State eksikse ekran kabul yok.

---

## Durum göstergeleri

| Simge | Anlam |
|-------|--------|
| ⬜ | Başlanmadı |
| 🟡 | UI iskelet / mock |
| 🟠 | Backend kısmi |
| 🟢 | Entegre + kabul edildi |

---

## Mevcut snapshot (2026-06-09)

| Alan | Durum |
|------|--------|
| App shell | 🟡 Sidebar, Topbar, BranchSwitcher, login |
| Supabase foundation | 🟠 org, branches, profiles, roles, audit, staff_profiles, clinic_hours |
| Dental chart DB | 🟠 dental_charts, tooth_findings (RLS + triggers var) |
| Patients DB | ⬜ `patients` tablosu yok |
| Permissions | 🟡 `usePermission()` her şeye `true` dönüyor |
| Patient UI | 🟡 mock data |
| Odontogram UI | 🟡 anatomik SVG + drawer, mock findings |
| Appointments / Billing | ⬜ |

---

## Önerilen uygulama sırası (modül modül)

Modül bağımlılıklarına göre **9 dalga**. Her dalgada modül modül git.

```
Dalga A — Foundation (01–04)     ← ÖNCE BUNLAR
Dalga B — Patient core (05–08)
Dalga C — Clinical chart (09–10)
Dalga D — Operations MVP (13, 19)
Dalga E — Billing core (20)
Dalga F — Audit yatay (24 MVP)
Dalga G — Phase 2 ops (14–18, 11–12, 21, 23)
Dalga H — Phase 3 (22)
```

---

# DALGA A — Foundation

---

## Modül 01 — Organization & Multi-Branch

| | |
|---|---|
| **MD** | `docs/01-foundation/01_ORGANIZATION_MULTI_BRANCH.md` |
| **Faz** | MVP Foundation |
| **Durum** | UI 🟡 · Backend 🟠 · Entegrasyon ⬜ |

### Ekranlar & rotalar

| Ekran | Route | Durum |
|-------|-------|-------|
| Organization overview | `/settings/organization` | 🟡 statik form |
| Branch list | `/settings/branches` | 🟡 |
| Branch profile | `/settings/branches/[id]` | ⬜ |
| Branch switcher | Topbar `BranchSwitcher` | 🟡 local store |
| Setup wizard (ilk branch yok) | `/onboarding` | ⬜ |

### Backend

- [x] `organizations`, `branches`, `branch_settings`, `staff_branch_assignments`, `audit_logs`
- [x] `current_user_org_id()`, `user_has_branch_access()`
- [ ] `get_branch_context()` RPC
- [ ] `branch_settings` key-value şeması (timezone, currency override)
- [ ] Branch deactivate (soft) + audit event
- [ ] Migration: `organizations` wave1 kolonları prod’a uygulandı mı kontrol

### UI/UX

- [ ] PageHeader + Save → gerçek Supabase update
- [ ] Loading skeleton (form layout mirror)
- [ ] Empty: “No branches yet” + CTA
- [ ] Error + permission denied (Owner/Admin only write)
- [ ] Branch değişince stale data temizleme (query invalidate)

### Entegrasyon katmanı

- [ ] `src/lib/org/org-service.ts` — CRUD
- [ ] `useBranch()` → Supabase `staff_branch_assignments` fetch
- [ ] `branch-store` persist + server sync

### Kabul kriterleri

- [ ] Owner org + ilk branch oluşturabilir
- [ ] Branch switcher sadece atanmış branch’leri gösterir
- [ ] Branch değişince hasta/randevu listesi yenilenir
- [ ] `branch.created` audit log yazılır

---

## Modül 02 — Auth, Roles & Permissions

| | |
|---|---|
| **MD** | `docs/01-foundation/02_AUTH_ROLES_PERMISSIONS.md` |
| **Faz** | MVP Foundation |
| **Durum** | UI 🟡 · Backend 🟠 · Entegrasyon ⬜ |

### Ekranlar & rotalar

| Ekran | Route | Durum |
|-------|-------|-------|
| Login | `/login` | 🟡 |
| Roles & permissions | `/settings/roles` | 🟡 statik |
| Session / unauthorized | middleware redirect | 🟠 |

### Backend

- [x] `profiles`, `roles`, `permissions`, `role_permissions`
- [ ] `permissions` seed (modül bazlı key’ler: `patients.read`, `chart.write`, …)
- [ ] `has_permission(key, branch_id)` RPC
- [ ] `get_my_permissions()`, `get_my_branch_ids()`
- [ ] `session_audit_logs` tablosu + login/logout trigger
- [ ] RLS: profiles org-scoped read/write

### UI/UX

- [ ] Login: loading, invalid credentials, account disabled
- [ ] Protected routes: `(dashboard)/layout` server-side session check
- [ ] Permission denied component (modül genel)
- [ ] Roles sayfası: role → permission matrix (read-only receptionist vs dentist)

### Entegrasyon katmanı

- [ ] `usePermission()` → `get_my_permissions()` RPC
- [ ] `<PermissionGate permission="..." />` wrapper
- [ ] JWT custom claims veya profile join (tercih: RPC, dokümana uygun)

### Kabul kriterleri

- [ ] Yetkisiz kullanıcı `/settings/roles` yazamaz
- [ ] `permission.denied` audit (opsiyonel log)
- [ ] Logout session temizler

---

## Modül 03 — Staff & Team Management

| | |
|---|---|
| **MD** | `docs/01-foundation/03_STAFF_TEAM.md` |
| **Faz** | MVP Foundation |
| **Durum** | UI 🟡 · Backend 🟠 · Entegrasyon ⬜ |

### Ekranlar & rotalar

| Ekran | Route | Durum |
|-------|-------|-------|
| Staff list | `/settings/staff` | 🟡 |
| Staff detail / branch assignment | `/settings/staff/[id]` | ⬜ |
| Invite staff modal | `/settings/staff` | ⬜ |

### Backend

- [x] `staff_profiles`, `staff_branch_assignments`
- [ ] Edge Function `invite-staff` (doküman)
- [ ] RPC: assign_staff_to_branch(profile_id, branch_id, role_id)
- [ ] Deactivate staff (is_active) + audit

### UI/UX

- [ ] DataTable: name, role, branches, status
- [ ] Invite flow: email → pending state
- [ ] Branch assignment multi-select
- [ ] Empty / error / saving states

### Entegrasyon

- [ ] `src/lib/staff/staff-service.ts`
- [ ] Staff list branch-filtered (admin sees all)

### Kabul

- [ ] Admin staff invite + branch atayabilir
- [ ] Dentist sadece kendi profilini düzenleyebilir (alan kısıtlı)

---

## Modül 04 — Settings & Configuration

| | |
|---|---|
| **MD** | `docs/01-foundation/04_SETTINGS_CONFIGURATION.md` |
| **Faz** | MVP Foundation |
| **Durum** | UI 🟡 · Backend 🟠 · Entegrasyon ⬜ |

### Ekranlar & rotalar

| Ekran | Route | Durum |
|-------|-------|-------|
| Settings hub | `/settings` layout | 🟡 |
| Organization settings | `/settings/organization` | 🟡 |
| Branch settings | `/settings/branches/[id]` | ⬜ |
| Clinic hours | `/settings/branches/[id]/hours` | ⬜ |
| Notification templates | `/settings/notifications` | ⬜ (Phase 2 prep) |

### Backend

- [x] `organization_settings`, `clinic_hours`, `branch_settings`
- [ ] `public_tokens` (kiosk/TV için — Phase 2’de aktif)
- [ ] `notification_templates` migration
- [ ] Default PHP, Asia/Manila seed on org create

### UI/UX

- [ ] Currency display ₱ (read-only MVP)
- [ ] Clinic hours weekly grid
- [ ] Form validation (zod)
- [ ] Saved / failed toast

### Kabul

- [ ] Branch hours appointments modülüne kaynak olur
- [ ] Settings değişikliği audit log

---

# DALGA B — Patient Clinical Core

---

## Modül 05 — Patient Registry

| | |
|---|---|
| **MD** | `docs/02-patient-clinical/05_PATIENT_REGISTRY.md` |
| **Faz** | MVP Clinical Core |
| **Durum** | UI 🟡 mock · Backend ⬜ · Entegrasyon ⬜ |
| **Bağımlılık** | 01–04 tamamlanmış olmalı |

### Ekranlar & rotalar

| Ekran | Route | Durum |
|-------|-------|-------|
| Patient list | `/patients` | 🟡 mock table |
| Patient profile | `/patients/[id]` | 🟡 |
| Patient edit | `/patients/[id]/edit` | 🟡 |
| Duplicate review | `/patients/duplicates` | ⬜ |
| Documents tab | `/patients/[id]/documents` | ⬜ |

### Backend

- [ ] Migration: `patients`, `patient_contacts`, `patient_identifiers`, `patient_branch_links`
- [ ] RLS: org-level patient, branch link for visits
- [ ] RPC: `search_patients(query, branch_id)`
- [ ] RPC: `detect_duplicate_patient(payload)`
- [ ] RPC: `merge_patients(master_id, duplicate_id)` (admin only)
- [ ] Storage bucket: `patient-documents` + RLS

### UI/UX

- [ ] PatientSearchBar → debounced RPC search (name, phone, ID)
- [ ] PatientTable → gerçek data + pagination
- [ ] Profile: quick facts, alerts placeholder, branch visit history
- [ ] Empty: “Register first patient”
- [ ] Permission: reception create, dentist read

### Entegrasyon

- [ ] `src/lib/patients/patient-service.ts`
- [ ] `src/lib/validations/patient.ts` → Supabase insert
- [ ] Mock `PatientTable` kaldır

### Kabul

- [ ] Yeni hasta kaydı + audit `patient.created`
- [ ] Duplicate uyarısı (aynı phone)
- [ ] Branch context hasta aramasında filtre

---

## Modül 06 — Patient Intake

| | |
|---|---|
| **MD** | `docs/02-patient-clinical/06_PATIENT_INTAKE.md` |
| **Faz** | MVP Clinical Core |
| **Durum** | UI 🟡 `/patients/new` · Backend ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| New patient / intake wizard | `/patients/new` |
| Intake review (existing) | `/patients/[id]/intake` |

### Backend

- [ ] `patient_intakes`, `patient_insurance_profiles`
- [ ] RPC: complete_intake → patients + contacts atomik yaz
- [ ] Kağıt form alanları: emergency contact, referral, reason for consultation

### UI/UX

- [ ] Multi-step FormSection (personal → contact → insurance → review)
- [ ] Progress indicator
- [ ] Draft save (local veya DB)
- [ ] Kiosk intake ile aynı schema (Modül 16 prep)

### Kabul

- [ ] Intake bitince patient registry’de görünür
- [ ] Required field validation (en-PH phone normalize)

---

## Modül 07 — Medical History

| | |
|---|---|
| **MD** | `docs/02-patient-clinical/07_MEDICAL_HISTORY.md` |
| **Faz** | MVP Clinical Core |
| **Durum** | ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| Medical history form | `/patients/[id]/medical-history` |
| Version history | `/patients/[id]/medical-history/versions` |

### Backend

- [ ] `medical_histories`, `medical_history_versions`
- [ ] `patient_conditions`, `patient_allergies`, `patient_medications`
- [ ] RPC: save_medical_history_version (append-only, no silent overwrite)
- [ ] RLS: clinical write, reception read summary

### UI/UX

- [ ] MedicalAlertBanner (chart + appointment’ta görünür)
- [ ] Allergy / medication / pregnancy / conditions checklist
- [ ] Risk flags: anticoagulant, diabetes, etc.
- [ ] Compare versions drawer

### Kabul

- [ ] Yeni versiyon eskiyi silmez
- [ ] Chart açılınca alert banner görünür

---

## Modül 08 — Consent & Legal Forms

| | |
|---|---|
| **MD** | `docs/02-patient-clinical/08_CONSENT_FORMS.md` |
| **Faz** | MVP Clinical Core |
| **Durum** | UI 🟡 `/patients/[id]/consents/[formId]` · Backend ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| Consent list | `/patients/[id]/consents` |
| Sign consent | `/patients/[id]/consents/[formId]` |
| Template admin | `/settings/consent-templates` |

### Backend

- [ ] `consent_templates`, `consent_forms`, `consent_signatures`
- [ ] Storage: signed PDF/image
- [ ] RPC: sign_consent(form_id, signature_payload)
- [ ] DPA / informed consent / treatment consent types

### UI/UX

- [ ] ConsentSignaturePad component
- [ ] Read-only legal text + checkbox acknowledge
- [ ] Signed state badge on patient profile
- [ ] Permission denied for unsigned treatment (Treatment Plan hook)

### Kabul

- [ ] İmza saklanır + audit
- [ ] Void consent admin only + reason

---

# DALGA C — Clinical Chart

---

## Modül 09 — Dental Chart / Odontogram

| | |
|---|---|
| **MD** | `docs/02-patient-clinical/09_DENTAL_CHART_ODONTOGRAM.md` |
| **Faz** | MVP Clinical Core |
| **Durum** | UI 🟡 anatomik SVG · Backend 🟠 · Entegrasyon ⬜ |

### Ekranlar

| Ekran | Route | Durum |
|-------|-------|-------|
| Patient chart | `/patients/[id]/chart` | 🟡 mock findings |
| Tooth detail (deep link) | `/patients/[id]/tooth/[toothId]` | 🟡 |

### Backend

- [x] `dental_charts`, `tooth_findings`, audit events
- [ ] `tooth_records`, `tooth_surface_records`, `chart_versions` (MD tam set)
- [x] RLS policies (002)
- [x] Triggers (003)
- [ ] RPC: `upsert_tooth_finding(payload)`
- [ ] RPC: `get_patient_odontogram(patient_id, branch_id)`
- [ ] RPC: `create_chart_version(...)`

### UI/UX

- [x] AnatomicOdontogramChart (zip SVG, FDI 32)
- [x] ToothDetailDrawer + surface map
- [ ] Primary teeth: ayrı arch veya ikinci SVG
- [ ] MedicalAlertBanner entegrasyonu
- [ ] Unsaved changes → PatientChartHeader save → RPC batch
- [ ] Chart version history UI
- [ ] Permission: reception read-only summary

### Entegrasyon

- [ ] `src/lib/dental/chart-service.ts`
- [ ] chart page mock setTimeout kaldır
- [ ] `InteractiveOdontogram.tsx` legacy — deprecate / kaldır

### Kabul

- [ ] Diş bulgusu DB’ye yazılır + audit
- [ ] Branch context enforced
- [ ] Loading / error / permission denied

---

## Modül 10 — Treatment Plan

| | |
|---|---|
| **MD** | `docs/02-patient-clinical/10_TREATMENT_PLAN.md` |
| **Faz** | MVP Clinical Core |
| **Durum** | ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| Treatment plan builder | `/patients/[id]/treatment-plan` |
| Plan item from chart | chart drawer → “Add to plan” |

### Backend

- [ ] `treatment_plans`, `treatment_plan_items`, `approvals`
- [ ] Link: tooth_finding_id → plan item
- [ ] RPC: approve_plan, convert_plan_to_invoice_draft
- [ ] Procedure catalog FK (Modül 19)

### UI/UX

- [ ] TreatmentPlanBuilder component
- [ ] Priority, estimated price, status badges
- [ ] Patient approval capture
- [ ] Empty: “Add from chart findings”

### Kabul

- [ ] Chart finding → plan item provenance
- [ ] Onaylı plan invoice’a dönüşebilir

---

# DALGA D — Operations MVP

---

## Modül 13 — Appointments

| | |
|---|---|
| **MD** | `docs/03-operations/13_APPOINTMENTS.md` |
| **Faz** | MVP Operations |
| **Durum** | ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| Calendar | `/appointments` |
| Day schedule | `/appointments?date=` |
| Appointment drawer | inline |

### Backend

- [ ] `appointments`, `provider_availability`
- [ ] Uses `clinic_hours` (Modül 04)
- [ ] RPC: `create_appointment_validated`, `get_day_schedule`
- [ ] Status flow: scheduled → confirmed → checked_in → completed / cancelled / no_show

### UI/UX

- [ ] Day/week view (MVP: day list yeterli)
- [ ] Dentist filter, patient search
- [ ] Conflict validation mesajı
- [ ] Check-in action (Modül 15 hook)

### Kabul

- [ ] Randevu oluştur + branch scope
- [ ] Dashboard “Today’s appointments” KPI beslenir

---

## Modül 19 — Procedure Catalog & Pricing

| | |
|---|---|
| **MD** | `docs/04-billing-claims/19_PROCEDURE_CATALOG_PRICING.md` |
| **Faz** | MVP Billing Support |
| **Durum** | ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| Procedure catalog | `/settings/procedures` |
| Branch price overrides | `/settings/procedures/pricing` |

### Backend

- [ ] `procedure_categories`, `procedures`, `procedure_prices`, `price_history`
- [ ] Branch override column
- [ ] Dental code + tooth_required flag

### UI/UX

- [ ] Tabular spec sheet (catalog)
- [ ] Search by code/name
- [ ] Used by Treatment Plan + Invoice line items

### Kabul

- [ ] Fiyat PHP minor units (integer centavos)
- [ ] Price change audit

---

# DALGA E — Billing Core

---

## Modül 20 — Invoices, Payments & Ledger

| | |
|---|---|
| **MD** | `docs/04-billing-claims/20_INVOICES_PAYMENTS_LEDGER.md` |
| **Faz** | MVP Billing Core |
| **Durum** | ⬜ |

### Ekranlar

| Ekran | Route |
|-------|-------|
| Invoice list | `/billing/invoices` |
| Invoice detail | `/billing/invoices/[id]` |
| Record payment | drawer |
| Patient balance | `/patients/[id]/billing` |

### Backend

- [ ] `invoices`, `invoice_items`, `payments`, `payment_methods`, `ledger_entries`
- [ ] **Money: integer minor units only**
- [ ] RPC: `recalculate_invoice_totals`, `record_payment`, `void_invoice`, `get_patient_balance`
- [ ] Ledger append-only

### UI/UX

- [ ] PaymentLedger component
- [ ] Partial payment, void with reason
- [ ] Patient profile unpaid balance chip

### Kabul

- [ ] Treatment plan → invoice draft
- [ ] Payment → ledger → balance doğru
- [ ] Void audit + no hard delete

---

# DALGA F — Audit (yatay, erken başla kısmi)

---

## Modül 24 — Compliance, Audit & Reports (MVP kısmı)

| | |
|---|---|
| **MD** | `docs/05-control-intelligence/24_COMPLIANCE_AUDIT_REPORTS.md` |
| **Faz** | MVP Audit + Phase 2 Reports |
| **Durum** | Backend 🟠 tablo var · UI ⬜ |

### MVP scope (şimdi)

- [ ] AuditDrawer component (kritik kayıtlarda “View history”)
- [ ] `/settings/audit` read-only log viewer
- [ ] Her modül mutation’ında `audit_logs` insert standardı

### Phase 2

- [ ] Compliance cycles, report exports, dashboard snapshots
- [ ] Financial / operational reports

---

# DALGA G — Phase 2 (sıra önerisi)

| Sıra | Modül | Not |
|------|-------|-----|
| G1 | 15 Check-in & Queue | Appointments sonrası |
| G2 | 17 TV Queue Display | public token + Realtime |
| G3 | 16 Kiosk / Tablet | public token + intake |
| G4 | 18 Notifications / SMS | Edge Functions |
| G5 | 14 Waitlist | Appointments |
| G6 | 11 Clinical Notes & Timeline | Visit model |
| G7 | 12 Orthodontic Record | Specialty |
| G8 | 21 HMO Claims | Invoice sonrası |
| G9 | 23 Inventory & Supplies | Ops control |

---

# DALGA H — Phase 3

## Modül 22 — PhilHealth / eClaims Readiness

- [ ] `philhealth_claims`, sync logs, encrypted payload refs
- [ ] Legal/compliance review gate
- [ ] Feature flag default OFF

---

# Modül başına standart checklist (kopyala-yapıştır)

```markdown
## Modül XX — NAME

### 1. Okuma
- [ ] MD okundu
- [ ] Screen PNG incelendi

### 2. Backend
- [ ] Migration yazıldı
- [ ] RLS enable + policies
- [ ] RPC / triggers
- [ ] Permission keys seed

### 3. Domain
- [ ] types + zod validators
- [ ] service layer (no Supabase in components)

### 4. UI
- [ ] Routes
- [ ] Components (docs component list)
- [ ] loading / empty / error / permission / saving

### 5. Entegrasyon
- [ ] Branch context
- [ ] Audit log on write
- [ ] usePermission guards

### 6. Test
- [ ] Smoke: happy path
- [ ] Smoke: permission denied
- [ ] Smoke: branch isolation
```

---

# Cross-cutting (her modülde tekrar etme)

| Konu | Standart |
|------|----------|
| Locale | `en-PH`, `Asia/Manila`, `PHP` |
| Branch | Her operasyonel ekranda active branch görünür |
| PHI | Log/seed/screenshot’ta gerçek hasta yok |
| Para | Integer minor units |
| Versiyonlama | Medical history, chart — silent overwrite yok |
| Hasta-facing | Kiosk/TV — raw error yasak |

---

# İlk 3 sprint önerisi (modül modül)

### Sprint 1 — Foundation bitir (01–04)
1. Modül 02 `has_permission` + gerçek `usePermission`
2. Modül 01 branch switcher Supabase sync
3. Modül 03–04 staff + settings CRUD

### Sprint 2 — Patient pipeline (05–08)
1. Modül 05 patients migration + list/profile
2. Modül 06 intake wizard entegrasyon
3. Modül 07 medical history + banner
4. Modül 08 consent sign

### Sprint 3 — Chart + plan (09–10)
1. Modül 09 RPC entegrasyon (mock kaldır)
2. Modül 10 treatment plan builder
3. Modül 24 audit drawer (yatay)

---

# Dosya referansları

| Modül | MD | Task checklist | Screen |
|-------|-----|----------------|--------|
| 01 | `docs/01-foundation/01_ORGANIZATION_MULTI_BRANCH.md` | `tasks/01_ORGANIZATION_MULTI_BRANCH.md` | `docs/screens/01_*.png` |
| 02 | `docs/01-foundation/02_AUTH_ROLES_PERMISSIONS.md` | `tasks/02_AUTH_ROLES_PERMISSIONS.md` | `02_*.png` |
| … | … | `tasks/XX_*.md` (15 modül var, 11–18, 21–23 task MD eklenecek) | `docs/screens/` |

---

**Sonraki adım:** Dalga A — Modül 01 veya 02’den başla. Her modül bitince bu dosyada durum simgesini güncelle.
