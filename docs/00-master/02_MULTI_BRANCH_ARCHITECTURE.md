# 02 — Multi-Branch Architecture

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## Scope modeli

```txt
organization
  └── branches
        ├── appointments
        ├── visits
        ├── invoices
        ├── queue
        ├── inventory
        └── compliance
```

## Hasta modeli

```txt
patients = organization-level
patient_intakes = branch-level draft + organization-level final link
medical_history = organization-level current + branch-level verification context
visits = branch-level
invoices = branch-level
reports = branch-level + organization aggregate
```

## Her operasyon tablosunda standart alanlar

```sql
id uuid primary key default gen_random_uuid(),
organization_id uuid not null references organizations(id),
branch_id uuid references branches(id),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
created_at timestamptz default now(),
updated_at timestamptz default now()
```

## Branch switcher davranışı

- Aktif branch global app context'te tutulur.
- Branch değişince branch-scoped query cache temizlenir.
- URL branch parametresi desteklenebilir ama RLS yerine geçmez.
- Unauthorized branch seçilirse permission denied state gösterilir.

## RLS pattern

```sql
create policy "branch members can read branch rows"
on appointments for select
to authenticated
using (
  organization_id = public.current_user_org_id()
  and public.user_has_branch_access(branch_id)
);
```

## Organization-level vs branch-level rapor

- Branch Manager: kendi branch aggregate.
- Owner/Admin: all branches aggregate + drilldown.
- Dentist: kendi schedule/clinical scope.
- Billing Staff: yetkili branch billing scope.
