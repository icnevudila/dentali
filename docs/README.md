# Philippines Multi-Branch Dental App — 24 Module A-Z Pack

Bu paket, Filipinler merkezli multi-branch dental clinic operating system için 24 modüllük A-Z planı içerir.

Backend varsayımı: **Supabase-first**.

Frontend varsayımı: React / Next.js + Tailwind veya benzeri component tabanlı UI.

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## İçerik

- `00-master/`: master ürün, modül haritası, Supabase, multi-branch, UI/UX ve AI agent kuralları.
- `01-foundation/`: organization, auth, staff, settings.
- `02-patient-clinical/`: patient registry, intake, medical history, consent, dental chart, treatment plan, clinical notes, ortho.
- `03-operations/`: appointments, waitlist, queue, kiosk, TV display, notifications.
- `04-billing-claims/`: procedures, invoices, HMO, PhilHealth readiness.
- `05-control-intelligence/`: inventory, compliance, audit, reports.
- `screens/`: her modül için örnek ekran PNG wireframe/mockup.

## Modül listesi

| No | Modül | Faz | MD | Örnek ekran |
|---:|---|---|---|---|
| 01 | Organization & Multi-Branch | MVP Foundation | `01-foundation/01_ORGANIZATION_MULTI_BRANCH.md` | `screens/01_ORGANIZATION_MULTI_BRANCH.png` |
| 02 | Auth, Roles & Permissions | MVP Foundation | `01-foundation/02_AUTH_ROLES_PERMISSIONS.md` | `screens/02_AUTH_ROLES_PERMISSIONS.png` |
| 03 | Staff & Team Management | MVP Foundation | `01-foundation/03_STAFF_TEAM.md` | `screens/03_STAFF_TEAM.png` |
| 04 | Settings & Configuration | MVP Foundation | `01-foundation/04_SETTINGS_CONFIGURATION.md` | `screens/04_SETTINGS_CONFIGURATION.png` |
| 05 | Patient Registry | MVP Clinical Core | `02-patient-clinical/05_PATIENT_REGISTRY.md` | `screens/05_PATIENT_REGISTRY.png` |
| 06 | Patient Intake | MVP Clinical Core | `02-patient-clinical/06_PATIENT_INTAKE.md` | `screens/06_PATIENT_INTAKE.png` |
| 07 | Medical History | MVP Clinical Core | `02-patient-clinical/07_MEDICAL_HISTORY.md` | `screens/07_MEDICAL_HISTORY.png` |
| 08 | Consent & Legal Forms | MVP Clinical Core | `02-patient-clinical/08_CONSENT_FORMS.md` | `screens/08_CONSENT_FORMS.png` |
| 09 | Dental Chart / Odontogram | MVP Clinical Core | `02-patient-clinical/09_DENTAL_CHART_ODONTOGRAM.md` | `screens/09_DENTAL_CHART_ODONTOGRAM.png` |
| 10 | Treatment Plan | MVP Clinical Core | `02-patient-clinical/10_TREATMENT_PLAN.md` | `screens/10_TREATMENT_PLAN.png` |
| 11 | Clinical Notes & Visit Timeline | Phase 2 Clinical Depth | `02-patient-clinical/11_CLINICAL_NOTES_TIMELINE.md` | `screens/11_CLINICAL_NOTES_TIMELINE.png` |
| 12 | Orthodontic Treatment Record | Phase 2 Specialty | `02-patient-clinical/12_ORTHODONTIC_RECORD.md` | `screens/12_ORTHODONTIC_RECORD.png` |
| 13 | Appointments | MVP Operations | `03-operations/13_APPOINTMENTS.md` | `screens/13_APPOINTMENTS.png` |
| 14 | Waitlist | Phase 2 Operations | `03-operations/14_WAITLIST.md` | `screens/14_WAITLIST.png` |
| 15 | Check-in & Queue | Phase 2 Operations | `03-operations/15_CHECKIN_QUEUE.md` | `screens/15_CHECKIN_QUEUE.png` |
| 16 | Kiosk / Patient Tablet | Phase 2 Patient Facing | `03-operations/16_KIOSK_TABLET.md` | `screens/16_KIOSK_TABLET.png` |
| 17 | TV Queue Display | Phase 2 Patient Facing | `03-operations/17_TV_QUEUE_DISPLAY.md` | `screens/17_TV_QUEUE_DISPLAY.png` |
| 18 | Notifications / SMS | Phase 2 Operations | `03-operations/18_NOTIFICATIONS_SMS.md` | `screens/18_NOTIFICATIONS_SMS.png` |
| 19 | Procedure Catalog & Pricing | MVP Billing Support | `04-billing-claims/19_PROCEDURE_CATALOG_PRICING.md` | `screens/19_PROCEDURE_CATALOG_PRICING.png` |
| 20 | Invoices, Payments & Ledger | MVP Billing Core | `04-billing-claims/20_INVOICES_PAYMENTS_LEDGER.md` | `screens/20_INVOICES_PAYMENTS_LEDGER.png` |
| 21 | HMO Claims | Phase 2 Billing | `04-billing-claims/21_HMO_CLAIMS.md` | `screens/21_HMO_CLAIMS.png` |
| 22 | PhilHealth / eClaims Readiness | Phase 3 Compliance/Risk | `04-billing-claims/22_PHILHEALTH_ECLAIMS.md` | `screens/22_PHILHEALTH_ECLAIMS.png` |
| 23 | Inventory & Supplies | Phase 2 Operations Control | `05-control-intelligence/23_INVENTORY_SUPPLIES.md` | `screens/23_INVENTORY_SUPPLIES.png` |
| 24 | Compliance, Audit & Reports | MVP Audit + Phase 2 Reports | `05-control-intelligence/24_COMPLIANCE_AUDIT_REPORTS.md` | `screens/24_COMPLIANCE_AUDIT_REPORTS.png` |

## Kullanım kuralı

AI coding agent'a önce şu sırayla ver:

1. `00-master/05_AI_AGENT_RULES.md`
2. `00-master/04_UI_UX_MASTER_RULES.md`
3. `00-master/03_SUPABASE_BACKEND_RULES.md`
4. İlgili modül MD'si
5. İlgili ekran PNG'si

Kural net: **MD yoksa kod yok. RLS yoksa merge yok. Loading/empty/error/permission state yoksa ekran kabul yok.**
