# 03 — Supabase Backend Rules

> Source basis: Bu paket, kullanıcının paylaştığı klinik kağıt formları ve PDA Dental Chart PDF'indeki Patient Information, Medical History, Informed Consent, Dental Record Chart ve Treatment Record yapısından; ayrıca daha önce hazırlanan DentQL redesign notlarından türetilmiştir. Gerçek hasta isim/telefon verileri dokümanlara taşınmamıştır.
> Compliance note: Philippines Data Privacy Act, HMO ve PhilHealth/eClaims alanları ürün/teknik plan düzeyindedir. Canlı kullanım öncesi Philippines legal/compliance danışmanı ve güncel resmi entegrasyon dokümanları ile doğrulanmalıdır.

## Supabase parçaları

- Supabase Auth: staff login, profile mapping.
- Postgres: clinical, operational, finance data.
- RLS: exposed schema için ana güvenlik katmanı.
- Storage: consent PDFs, x-rays, attachments, claim documents.
- Realtime: queue, selected appointment changes, dashboard lightweight updates.
- Edge Functions: SMS, PDF generation, claim exports, token validation, scheduled dispatch.
- RPC / database functions: permission checks, invoice totals, dashboard aggregates, state transitions.

## Altın kurallar

1. `service_role` key browser'a girmez.
2. Public/anonym token ham tablolara erişmez; narrow RPC/Edge Function kullanır.
3. Finance/clinical state transition backend RPC ile yapılır.
4. RLS policy yazılmadan tablo frontend'e açılmaz.
5. Storage private bucket + RLS policy kullanır.
6. Realtime kanalları branch ve permission sınırıyla çalışır.
7. Edge Functions idempotent yazılır.
8. Audit append-only kabul edilir.

## Migration kuralı

Her modül migration dosyası üç parçaya bölünsün:

```txt
001_tables.sql
002_rls_policies.sql
003_functions_triggers.sql
```

## Audit trigger pattern

Kritik tablolar için trigger ya da RPC içinde audit log yazılır. Delete yerine status/void/cancel yaklaşımı tercih edilir.

## Dashboard aggregate pattern

Frontend 10 endpoint çağırmaz. Branch/date filter ile tek RPC:

```sql
select * from get_dashboard_summary(branch_id, report_date);
```

## Storage bucket önerisi

```txt
patient-documents private
consent-pdfs private
claim-documents private
clinical-images private
public-brand-assets public/controlled
```
