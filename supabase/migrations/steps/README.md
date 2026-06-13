# Supabase SQL — dentali. uygulama rehberi

Projede **üç yol** var: adım adım, parça parça toplu, veya tek mega dosya.

Her SQL çalıştırdıktan sonra: **Settings → API → Reload schema**

---

## Yol A — Adım adım (hata ayıklama için en iyi)

Büyük dosya tek seferde patlarsa `supabase/migrations/steps/` altındaki dosyaları **sırayla** çalıştır.

| Sıra | Dosya | Ne yapar |
|------|-------|----------|
| 0 | `00_diagnose.sql` | Eksik tablo/kolon/RPC listesi (sadece kontrol) |
| 1 | `01_prerequisites.sql` | `fields` kolonu, tablolar, extension |
| 2 | `02_search_patients.sql` | `/patients` listesi ve arama RPC |
| 3 | `03_consent_templates.sql` | DRG/PDA form şablonları |
| 4 | `04_consent_signing_rpcs.sql` | Public `/sign/[token]` imza RPC'leri |
| 5 | `05_dedupe_consent_templates.sql` | Çift şablon temizliği (consent açılmıyorsa) |
| 6 | `06_full_paper_consent_forms.sql` | Kağıt formlar — uzun metin + yes/no + select |
| 7 | `07_multi_branch_tenant.sql` | Multi-branch — org izolasyonu, şube RPC, RLS |

**Adım 6 ve 7** başında `ONKOSUL` bloğu vardır. Yine de önce `01_prerequisites.sql` çalıştırmak en güvenlisi.

### Sık hatalar

| Hata | Çözüm |
|------|--------|
| `column "fields" does not exist` | `01_prerequisites.sql` veya güncel `06_...sql` |
| `function user_is_org_admin() does not exist` | güncel `07_...sql` |
| `no unique constraint matching ON CONFLICT` (42P10) | önce `_APPLY_HOTFIX_ON_CONFLICT_42P10.sql`, sonra güncel bundle |
| `rpc:create_org_branch` MISSING | `_APPLY_MULTI_BRANCH.sql` veya `_APPLY_HOTFIX_CREATE_ORG_BRANCH.sql` |
| `relation organization_audit_logs does not exist` | güncel `07_...sql` |

Hata alırsan: hangi **dosya numarası** + **tam hata metni** sohbete yapıştır.

---

## Yol B — Toplu parçalar (önerilen — 2–3 dosya)

Önce bundle'ları üret:

```bash
npm run db:bundle:all
```

Sonra Supabase SQL Editor'da **sırayla**:

| Sıra | Dosya | Boyut (yaklaşık) | İçerik |
|------|-------|------------------|--------|
| 1 | `supabase/migrations/_APPLY_PATIENT_COMPLETE.sql` | ~79 KB | Hasta, arama, consent şablonları, kağıt formlar, `/sign` RPC (step 01–06 + ek migration'lar) |
| 2 | `supabase/migrations/_APPLY_MULTI_BRANCH.sql` | ~9 KB | Org/şube tenant modeli (step 07) |
| 3 | `supabase/migrations/_APPLY_CONSENT_SIGNING.sql` | ~15 KB | **Yalnızca** 1–2 sonrası `/sign/[token]` hâlâ bozuksa (genelde gerekmez — step 04 zaten 1'de) |

Her dosyadan sonra **Reload schema**.

---

## Yol C — Tek mega dosya (en hızlı)

```bash
npm run db:bundle:master
```

Çıktı: `supabase/migrations/_APPLY_MASTER.sql` (~88 KB)

- Hasta modülü + consent + multi-branch **tek yapıştırma**
- `/sign` RPC'leri patient bundle içinde olduğu için consent-signing ayrıca eklenmez

SQL Editor'da **bir kez** çalıştır → **Reload schema**.

---

## Yol D — Tüm migration geçmişi (sıfır / tam kurulum)

Zaten `supabase db push` kullanıyorsan buna gerek yok.

```bash
npm run db:bundle:idempotent
```

Çıktı: `supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql` — tüm timestamp'li migration dosyaları, idempotent.

---

## Bundle komutları özeti

| Komut | Çıktı dosyası |
|-------|----------------|
| `npm run db:bundle:patient` | `_APPLY_PATIENT_COMPLETE.sql` |
| `npm run db:bundle:multi-branch` | `_APPLY_MULTI_BRANCH.sql` |
| `npm run db:bundle:consent-signing` | `_APPLY_CONSENT_SIGNING.sql` |
| `npm run db:bundle:all` | Yukarıdaki üçünü üretir |
| `npm run db:bundle:master` | `_APPLY_MASTER.sql` (patient + multi-branch) |
| `npm run db:bundle:idempotent` | `_APPLY_ALL_IDEMPOTENT.sql` |

---

## Hangi yolu seçmeliyim?

| Durum | Yol |
|-------|-----|
| İlk kez kuruyorum, hızlı olsun | **C** — `_APPLY_MASTER.sql` |
| Adım adım kontrol istiyorum | **A** — `steps/01` … `07` |
| Patient çalışıyor, sadece şube eksik | Sadece `_APPLY_MULTI_BRANCH.sql` |
| `/sign/...` linki hata veriyor | `_APPLY_CONSENT_SIGNING.sql` veya step `04` |
