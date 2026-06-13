# SQL Runbook — A'dan Z'ye (sıfır hata)

Supabase **SQL Editor**'da bu sırayla çalıştırın. Her adımın sonunda beklenen sonuç belirtilmiştir.

| Proje ref (örnek) | `ahipxdlxyuvqikcybjpm` |
|-------------------|-------------------------|
| Migration sayısı | **89** (bundle) |
| Son güncelleme | 2026-06-12 |

---

## Özet tablo

| Adım | Dosya | Zorunlu | Süre | Başarı kriteri |
|------|-------|---------|------|----------------|
| 0 | Yerel bundle | Evet | ~30 sn | `87 files` yazısı |
| 1 | `scripts/runbook/01-extensions.sql` | Evet | ~5 sn | 3 uzantı OK |
| 1b | `scripts/runbook/01b-repair-rpc-drops.sql` | **Artık gerekmez** | — | Preflight bundle içinde |
| 2 | `supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql` | **Evet** | 2–8 dk | Hata yok |
| 3 | `scripts/runbook/02-verify-complete.sql` | Evet | ~5 sn | `overall = PASS` |
| 4 | Uygulama `/onboarding` | Evet* | — | En az 1 branch |
| 5 | `scripts/runbook/03-seed-demo.sql` | Opsiyonel | ~30 sn | JSON + branch_id |
| 6 | `scripts/runbook/04-cron-schedule.sql` | Canlı için | ~10 sn | 7 cron job |
| 7 | `scripts/runbook/05-repair-user.sql` | Gerekirse | ~5 sn | NOTICE mesajı |

\* Adım 4: Demo seed (5) ve dashboard için en az bir klinik/branch gerekir. Migration sonrası uygulamada bir kez giriş + onboarding yeterli.

---

## ADIM 0 — Yerel (SQL Editor değil)

PowerShell proje kökünde:

```powershell
cd "c:\Users\TP2\Documents\2026 yeni dişçi"
npm run db:bundle:idempotent
```

Çıktı: `Wrote ... _APPLY_ALL_IDEMPOTENT.sql (89 files, idempotent)`

> Bundle'ı her migration değişikliğinden sonra yenileyin. SQL Editor'a yapıştırmadan önce güncel bundle kullanın.

---

## ADIM 1 — Uzantılar

**Dosya:** [`scripts/runbook/01-extensions.sql`](../scripts/runbook/01-extensions.sql)

Supabase Dashboard → **SQL Editor** → New query → dosyanın tamamını yapıştır → **Run**.

**Beklenen:** `pgcrypto`, `pg_cron`, `pg_net` — üç satır, `status = OK`.

**Hata alırsanız:** Dashboard → Database → Extensions → üç uzantıyı manuel **Enable** edin, scripti tekrar çalıştırın.

---

## ADIM 1b — RPC imza onarımı (42P13 / 42710) — opsiyonel

**Güncel bundle:** `_APPLY_ALL_IDEMPOTENT.sql` dosyasının **başında** preflight drops vardır (`scripts/bundle-preflight-drops.sql`). **Tek dosyayı Run etmeniz yeterli** — ayrı 01b çalıştırmaya gerek yok.

**Belirti (eski bundle):** `cannot change return type` (`get_org_staff`), `cannot remove parameter defaults` (`get_patient_odontogram`), `policy already exists`.

**Çözüm:** Yerelde `npm run db:bundle:idempotent` → güncel `_APPLY_ALL_IDEMPOTENT.sql` → SQL Editor'da **sadece ADIM 2**.

Manuel onarım gerekirse: [`scripts/runbook/01b-repair-rpc-drops.sql`](../scripts/runbook/01b-repair-rpc-drops.sql)

---

## ADIM 2 — Tüm migration'lar (ANA ADIM)

**Dosya:** [`supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql`](../supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql)

1. Dosyayı editörde açın (~14.000+ satır).
2. **Ctrl+A → Ctrl+C**
3. Supabase SQL Editor → New query → yapıştır → **Run**
4. Tamamlanana kadar bekleyin (timeout olursa Supabase pro plan veya parça parça `db push` kullanın).

**Özellikler:** Idempotent — **aynı dosyayı tekrar çalıştırmak güvenli** (policy/index çakışması önlenir).

**Bu adım şunları kurar (son dalgalar dahil):**

| Migration | İçerik |
|-----------|--------|
| `20260612160000` | Odontogram: `dental_charts`, `tooth_findings`, RPC |
| `20260612200000` | TV display maskeli isim |
| `20260612210000` | Periodontal chart jsonb + RPC |
| `20260612220000` | Recall SMS + owner digest SMS + closeout internal |
| `20260612230000` | Staff phone + owner digest readiness RPC |

**Beklenen:** Yeşil "Success", kırmızı hata yok.

**Sık hatalar:**

| Hata | Çözüm |
|------|--------|
| `permission denied for schema auth` | Normal kullanıcı SQL Editor kullanın; service role gerektiren parça yok |
| Timeout | `npx supabase db push` (CLI link gerekir) veya gece tekrar deneyin |
| `already exists` (nadir) | Bundle güncel değil → ADIM 0 tekrar |

---

## ADIM 3 — Doğrulama

**Dosya:** [`scripts/runbook/02-verify-complete.sql`](../scripts/runbook/02-verify-complete.sql)

SQL Editor'da çalıştırın. **Üç sonuç seti** döner:

1. **Tablolar** — hepsi `OK` (MISSING olmamalı)
2. **RPC'ler** — hepsi `exists` (MISSING olmamalı)
3. **Özet** — `overall = PASS — migration tamam...`

**Alternatif kısa kontrol:** [`scripts/verify-go-live-rpcs.sql`](../scripts/verify-go-live-rpcs.sql) — 30 RPC, hepsi `exists`.

**FAIL ise:** ADIM 2'yi tekrar çalıştırın (idempotent). Hâlâ FAIL → hata mesajını kaydedin.

---

## ADIM 4 — Klinik bootstrap (branch oluşturma)

SQL değil — **uygulama:**

1. `npm run dev` veya production URL
2. Kayıt / giriş
3. `/onboarding` — klinik adı + ilk şube

**Doğrulama (SQL Editor):**

```sql
select id, name, organization_id from public.branches order by created_at;
```

En az **1 satır** dönmeli.

---

## ADIM 5 — Demo veri (opsiyonel)

**Dosya:** [`scripts/runbook/03-seed-demo.sql`](../scripts/runbook/03-seed-demo.sql)

Landing `/welcome` ve ekran görüntüleri için. Idempotent.

**Beklenen:** JSON sonuç — `branch_id`, `hint` (`.env.local` için).

```env
LANDING_SHOWCASE_BRANCH_ID=<branch_id>
```

**Güncel seed gövdesi için (isteğe bağlı):** önce [`scripts/seed-demo-showcase.sql`](../scripts/seed-demo-showcase.sql) çalıştırın (fonksiyonu günceller), sonra `03-seed-demo.sql`.

**Hata:** `branches tablosu boş` → önce ADIM 4.

---

## ADIM 6 — Cron (canlı otomasyon)

**Ön koşul:** Edge Functions deploy + `CRON_SECRET` secret.

**Dosya:** [`scripts/runbook/04-cron-schedule.sql`](../scripts/runbook/04-cron-schedule.sql)

Değiştirin:

- `<PROJECT_REF>` → `ahipxdlxyuvqikcybjpm` (kendi ref'iniz)
- `<CRON_SECRET>` → Edge secret ile **aynı** değer

**Beklenen:** 7 satır `dentali-*` job (aktif).

| Job | UTC | PHT |
|-----|-----|-----|
| slot notifications | */5 | her 5 dk |
| appointment reminders | */15 | her 15 dk |
| daily reminder | 10:00 | 18:00 |
| payment reminder | 02:00 | 10:00 |
| recall reminder | 03:00 | 11:00 |
| closeout email | 12:00 | 20:00 |
| owner digest SMS | 12:30 | 20:30 |

---

## ADIM 7 — Kullanıcı onarımı (gerekirse)

**Belirti:** Giriş var, branch seçilemiyor.

**Dosya:** [`scripts/runbook/05-repair-user.sql`](../scripts/runbook/05-repair-user.sql)

`BURAYA_EMAIL@example.com` → kendi e-postanız.

**Teşhis:** [`scripts/diagnose-auth-user.sql`](../scripts/diagnose-auth-user.sql) (e-postayı değiştirin).

---

## Migration sonrası (SQL dışı)

```bash
# Edge functions
supabase functions deploy

# Typecheck
npx tsc --noEmit

# E2E (env ile)
npm run test:e2e -- e2e/chart.smoke.spec.ts
npm run test:e2e -- e2e/public.smoke.spec.ts
```

Canlı secret'lar: [`docs/VA-F6_USER_STEPS.md`](./VA-F6_USER_STEPS.md)

Smoke: [`docs/GO_LIVE_SMOKE.md`](./GO_LIVE_SMOKE.md)

---

## Hızlı kontrol listesi

- [ ] ADIM 0: bundle 87 dosya
- [ ] ADIM 1: 3 extension OK
- [ ] ADIM 2: `_APPLY_ALL_IDEMPOTENT.sql` hatasız
- [ ] ADIM 3: `overall = PASS`
- [ ] ADIM 4: en az 1 branch
- [ ] (Opsiyonel) ADIM 5: demo seed + `.env.local`
- [ ] (Canlı) ADIM 6: 7 cron job
- [ ] Edge deploy + CRON_SECRET
- [ ] `verify-go-live-rpcs.sql` → tümü `exists`

---

## Dosya haritası

```
scripts/runbook/
  01-extensions.sql      ← Adım 1
  01b-repair-rpc-drops.sql ← Adım 1b (42P13)
  02-verify-complete.sql ← Adım 3
  03-seed-demo.sql       ← Adım 5
  04-cron-schedule.sql   ← Adım 6
  05-repair-user.sql     ← Adım 7

supabase/migrations/
  _APPLY_ALL_IDEMPOTENT.sql  ← Adım 2 (ANA)

scripts/
  verify-go-live-rpcs.sql    ← Kısa RPC kontrolü
  seed-demo-showcase.sql     ← Tam demo fonksiyonu (opsiyonel güncelleme)
  cron-schedule-template.sql ← 04 ile aynı (repo kopyası)
```

---

## Tek satır özet

**Zorunlu minimum:** `01-extensions` → `_APPLY_ALL_IDEMPOTENT.sql` → `02-verify` (PASS) → uygulama onboarding → bitti.

**Tam paket:** + `03-seed-demo` + Edge deploy + `04-cron` + F6 secret'ları.
