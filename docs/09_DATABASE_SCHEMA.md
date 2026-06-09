# Database Schema Draft

Database: PostgreSQL

Money fields use integer minor units: PHP centavos.

## clinics

```sql
CREATE TABLE clinics (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  locale TEXT NOT NULL DEFAULT 'en-PH',
  currency TEXT NOT NULL DEFAULT 'PHP',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  encrypted_profile_json JSONB,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, email)
);
```

## patients

```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birth_date DATE,
  sex TEXT,
  civil_status TEXT,
  primary_phone TEXT,
  email TEXT,
  address TEXT,
  occupation TEXT,
  company TEXT,
  guardian_name TEXT,
  guardian_relationship TEXT,
  referral_source TEXT,
  consultation_reason TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_clinic_name ON patients (clinic_id, last_name, first_name);
CREATE INDEX idx_patients_clinic_phone ON patients (clinic_id, primary_phone);
```

## medical_history_versions

```sql
CREATE TABLE medical_history_versions (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  version_no INT NOT NULL,
  answers_json JSONB NOT NULL,
  blood_type TEXT,
  blood_pressure TEXT,
  reviewed_by_user_id UUID REFERENCES users(id),
  signed_by_name TEXT,
  signed_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, version_no)
);
```

## consent_records

```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,
  body_text TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  signed_by_name TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  signature_asset_id UUID,
  witnessed_by_user_id UUID REFERENCES users(id),
  signed_at TIMESTAMPTZ NOT NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## dental_chart_versions

```sql
CREATE TABLE dental_chart_versions (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  version_no INT NOT NULL,
  dentition TEXT NOT NULL,
  findings_json JSONB NOT NULL,
  periodontal_json JSONB,
  occlusion_json JSONB,
  appliances_json JSONB,
  tmd_json JSONB,
  recorded_by_user_id UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, version_no)
);
```

## appointments

```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  dentist_id UUID REFERENCES users(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  appointment_type TEXT,
  source TEXT NOT NULL DEFAULT 'staff',
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_clinic_start ON appointments (clinic_id, start_at);
CREATE INDEX idx_appointments_dentist_start ON appointments (dentist_id, start_at);
```

## queue_entries

```sql
CREATE TABLE queue_entries (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  display_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_queue_clinic_status ON queue_entries (clinic_id, status, checked_in_at);
```

## treatments

```sql
CREATE TABLE treatments (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  dentist_id UUID REFERENCES users(id),
  treatment_date DATE NOT NULL,
  tooth_nos TEXT[] NOT NULL DEFAULT '{}',
  procedure_code TEXT,
  procedure_name TEXT NOT NULL,
  clinical_notes TEXT,
  amount_charged_minor INT NOT NULL DEFAULT 0,
  amount_paid_minor INT NOT NULL DEFAULT 0,
  balance_minor INT NOT NULL DEFAULT 0,
  next_appointment_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## invoices

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  or_no TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal_minor INT NOT NULL DEFAULT 0,
  discount_minor INT NOT NULL DEFAULT 0,
  tax_minor INT NOT NULL DEFAULT 0,
  total_minor INT NOT NULL DEFAULT 0,
  paid_minor INT NOT NULL DEFAULT 0,
  balance_minor INT NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_clinic_issued ON invoices (clinic_id, issued_at);
CREATE INDEX idx_invoices_clinic_status ON invoices (clinic_id, status);
```

## invoice_items

```sql
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES treatments(id),
  procedure_code TEXT,
  description TEXT NOT NULL,
  tooth_no TEXT,
  qty INT NOT NULL DEFAULT 1,
  unit_price_minor INT NOT NULL DEFAULT 0,
  discount_minor INT NOT NULL DEFAULT 0,
  total_minor INT NOT NULL DEFAULT 0
);
```

## payments

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  invoice_id UUID REFERENCES invoices(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  method TEXT NOT NULL,
  amount_minor INT NOT NULL,
  reference_no TEXT,
  paid_at TIMESTAMPTZ NOT NULL,
  received_by_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'posted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## hmo_providers / hmo_claims

```sql
CREATE TABLE hmo_providers (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  email TEXT,
  default_sla_days INT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE hmo_claims (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  invoice_id UUID REFERENCES invoices(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  provider_id UUID REFERENCES hmo_providers(id),
  claim_no TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  requested_amount_minor INT NOT NULL DEFAULT 0,
  approved_amount_minor INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_json JSONB,
  after_json JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (clinic_id, entity_type, entity_id, created_at);
```

## assets

```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
