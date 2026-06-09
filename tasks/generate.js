const fs = require('fs');
const path = require('path');

const tasks = [
  {
    name: '00_SCAFFOLDING.md',
    content: '# Wave 0: Proje Scaffolding\n\n## Backend / Database\n- [ ] Supabase Client (client.ts, server.ts, middleware.ts) kurulumu\n- [ ] `.env.local` ayarları\n\n## UI Bileşenleri\n- [ ] Tailwind CSS ve Design Tokens konfigürasyonu\n- [ ] Generic UI Bileşenleri (Button, Card, DataTable, StatusBadge vb.)\n- [ ] Layout Bileşenleri (AppShell, Sidebar, Topbar)\n\n## Frontend Ekranları\n- [ ] Next.js projesinin başlatılması\n- [ ] Boş Dashboard şablonu\n'
  },
  {
    name: '01_ORGANIZATION_MULTI_BRANCH.md',
    content: '# Modül 01: Organization & Multi-Branch\n\n## Backend / Database\n- [ ] `organizations` tablosuna eksik alanların eklenmesi\n- [ ] `branches` ve `branch_settings` tablolarının güncellenmesi\n- [ ] RLS poliçelerinin yazılması (org_id ve branch_id tabanlı)\n- [ ] RPC: `current_user_org_id()` ve `user_has_branch_access()`\n\n## UI Bileşenleri\n- [ ] `BranchSwitcher` bileşeni\n- [ ] `useBranch` hook\'unun oluşturulması\n\n## Frontend Ekranları\n- [ ] `/settings/organization` sayfası\n- [ ] `/settings/branches` sayfası\n'
  },
  {
    name: '02_AUTH_ROLES_PERMISSIONS.md',
    content: '# Modül 02: Auth, Roles & Permissions\n\n## Backend / Database\n- [ ] `roles`, `permissions`, `role_permissions` tabloları\n- [ ] `staff_branch_assignments` tablosu\n- [ ] RPC: `has_permission(permission_key, branch_id)`\n- [ ] Seed data: Varsayılan roller ve izinlerin eklenmesi\n\n## UI Bileşenleri\n- [ ] `useAuth` ve `usePermission` hook\'ları\n\n## Frontend Ekranları\n- [ ] `/login` sayfası (Supabase Auth)\n- [ ] `/settings/roles` sayfası\n'
  },
  {
    name: '03_STAFF_TEAM.md',
    content: '# Modül 03: Staff & Team Management\n\n## Backend / Database\n- [ ] `profiles` ve `staff_profiles` tabloları\n- [ ] RLS poliçelerinin yazılması\n\n## UI Bileşenleri\n- [ ] Personel listesi için özel DataTable\n\n## Frontend Ekranları\n- [ ] `/settings/staff` sayfası\n- [ ] `/settings/staff/invite` sayfası\n'
  },
  {
    name: '04_SETTINGS_CONFIGURATION.md',
    content: '# Modül 04: Settings & Configuration\n\n## Backend / Database\n- [ ] `organization_settings` tablosu\n- [ ] `clinic_hours` tablosu\n- [ ] RPC: `get_effective_settings`\n\n## UI Bileşenleri\n- [ ] Saat aralığı seçici bileşeni (TimeRangePicker)\n\n## Frontend Ekranları\n- [ ] `/settings/branches/[id]` (Şube ayarları) sayfası\n'
  },
  {
    name: '05_PATIENT_REGISTRY.md',
    content: '# Modül 05: Patient Registry\n\n## Backend / Database\n- [ ] `patients`, `patient_contacts`, `patient_identifiers` tabloları\n- [ ] `documents` tablosu (Hasta dosyaları)\n- [ ] RPC: `search_patients`\n- [ ] RPC: `detect_duplicate_patient`\n- [ ] RPC: `merge_patients`\n\n## UI Bileşenleri\n- [ ] `PatientSearchBar` (Debounced)\n- [ ] `DuplicateDetectionDialog`\n- [ ] `MergeDialog`\n\n## Frontend Ekranları\n- [ ] `/patients` sayfası (Liste)\n- [ ] `/patients/new` sayfası (Ekleme)\n- [ ] `/patients/[id]` sayfası (Hasta Detayı)\n'
  },
  {
    name: '06_PATIENT_INTAKE.md',
    content: '# Modül 06: Patient Intake\n\n## Backend / Database\n- [ ] `patient_intakes` tablosu\n- [ ] `patient_insurance_profiles` tablosu\n- [ ] RPC: `finalize_patient_intake`\n\n## UI Bileşenleri\n- [ ] `IntakeWizard` (Çok adımlı form bileşeni)\n\n## Frontend Ekranları\n- [ ] `/patients/[id]/intake` sayfası\n'
  },
  {
    name: '07_MEDICAL_HISTORY.md',
    content: '# Modül 07: Medical History\n\n## Backend / Database\n- [ ] `medical_histories`, `patient_conditions`, `patient_allergies`, `patient_medications` tabloları\n- [ ] RPC: `create_medical_history_version`\n- [ ] RPC: `calculate_medical_risk_flags`\n\n## UI Bileşenleri\n- [ ] `MedicalAlertBanner` (Uyarı afişi)\n- [ ] Koşul ve Alerji satır içi düzenleyicileri\n\n## Frontend Ekranları\n- [ ] `/patients/[id]/medical-history` sayfası\n'
  },
  {
    name: '08_CONSENT_FORMS.md',
    content: '# Modül 08: Consent & Legal Forms\n\n## Backend / Database\n- [ ] `consent_templates`, `consent_forms`, `consent_signatures` tabloları\n- [ ] RPC: `lock_signed_consent`\n\n## UI Bileşenleri\n- [ ] `ConsentViewer` (HTML şablon gösterici)\n- [ ] `ConsentSignaturePad` (İmza tuvali)\n\n## Frontend Ekranları\n- [ ] `/patients/[id]/consents` sayfası\n'
  },
  {
    name: '09_DENTAL_CHART_ODONTOGRAM.md',
    content: '# Modül 09: Dental Chart / Odontogram\n\n## Backend / Database\n- [ ] `dental_charts`, `tooth_records`, `tooth_findings`, `chart_versions` tabloları\n- [ ] RPC: `upsert_tooth_finding`\n- [ ] RPC: `create_chart_version`\n\n## UI Bileşenleri\n- [ ] `FDIOdontogram` (İnteraktif SVG diş şeması)\n- [ ] `ToothDrawer` (Diş detay paneli)\n\n## Frontend Ekranları\n- [ ] `/patients/[id]/chart` sayfası\n'
  },
  {
    name: '10_TREATMENT_PLAN.md',
    content: '# Modül 10: Treatment Plan\n\n## Backend / Database\n- [ ] `treatment_plans`, `treatment_plan_items` tabloları\n- [ ] RPC: `approve_treatment_plan`\n- [ ] RPC: `calculate_treatment_estimate`\n\n## UI Bileşenleri\n- [ ] `TreatmentPlanBuilder` (Sürükle bırak plan oluşturucu)\n\n## Frontend Ekranları\n- [ ] `/patients/[id]/treatment-plan` sayfası\n'
  },
  {
    name: '13_APPOINTMENTS.md',
    content: '# Modül 13: Appointments\n\n## Backend / Database\n- [ ] `appointments`, `provider_availability` tabloları\n- [ ] RPC: `create_appointment_validated`\n- [ ] RPC: `get_day_schedule`\n\n## UI Bileşenleri\n- [ ] `AppointmentCalendar` (Takvim)\n- [ ] `TimeSlotPicker` (Saat seçici)\n\n## Frontend Ekranları\n- [ ] `/appointments` sayfası\n- [ ] `/appointments/new` sayfası\n'
  },
  {
    name: '19_PROCEDURE_CATALOG_PRICING.md',
    content: '# Modül 19: Procedure Catalog & Pricing\n\n## Backend / Database\n- [ ] `procedure_categories`, `procedures`, `procedure_prices` tabloları\n- [ ] RPC: `get_effective_procedure_price`\n\n## UI Bileşenleri\n- [ ] `ProcedureCatalogTable`\n- [ ] `PricingEditor`\n\n## Frontend Ekranları\n- [ ] `/settings/procedures` sayfası\n'
  },
  {
    name: '20_INVOICES_PAYMENTS.md',
    content: '# Modül 20: Invoices, Payments & Ledger\n\n## Backend / Database\n- [ ] `invoices`, `invoice_items`, `payments`, `ledger_entries` tabloları\n- [ ] RPC: `record_payment`\n- [ ] RPC: `void_invoice`\n- [ ] RPC: `get_patient_balance`\n\n## UI Bileşenleri\n- [ ] `InvoiceTable` ve `InvoiceDetail`\n- [ ] `PaymentForm`\n- [ ] `PaymentLedger`\n\n## Frontend Ekranları\n- [ ] `/billing` sayfası\n- [ ] `/billing/[id]/pay` sayfası\n'
  },
  {
    name: '24_COMPLIANCE_AUDIT_MVP.md',
    content: '# Modül 24: Compliance, Audit & Reports (MVP)\n\n## Backend / Database\n- [ ] Kritik tablolar için audit trigger\'larının oluşturulması\n- [ ] `dashboard_snapshots` tablosu\n- [ ] RPC: `get_dashboard_summary`\n\n## UI Bileşenleri\n- [ ] `DashboardMetrics` (Metrik kartları)\n- [ ] `AuditLogViewer`\n\n## Frontend Ekranları\n- [ ] `/` (Dashboard sayfası)\n- [ ] `/admin/audit` sayfası\n'
  }
];

const targetDir = path.join(__dirname);
tasks.forEach(t => {
  fs.writeFileSync(path.join(targetDir, t.name), t.content, 'utf8');
});

console.log('Task files generated successfully.');
