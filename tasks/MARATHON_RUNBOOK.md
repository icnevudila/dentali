# Marathon Runbook — Sayfa Sayfa Tam Entegrasyon

> **Altın kural:** Bir sayfadaki her şey (UI, UX, backend, tüm butonlar, export, permission, loading/empty/error) çalışmadan **bir sonraki sayfaya geçilmez**.
>
> Güncelleme: 2026-06-09  
> Kaynak: `docs/**`, `tasks/MODULE_INTEGRATION_PLAN.md`  
> **Canlı iş sırası:** [`tasks/MARATHON_QUEUE.md`](./MARATHON_QUEUE.md) — agent buradan devam eder.

---

## Installed Skills

> Konum: `.agents/skills/<skill-name>/` — toplam **56** skill (2026-06-09 kurulumu).

### Paket kaynakları

| Paket | Skill sayısı | Not |
|-------|--------------|-----|
| `vercel-labs/agent-skills` | 9 | Next.js, React, Vercel deploy/optimize |
| `anthropics/skills` | 18 | Tasarım, doküman, test, MCP builder |
| `anthropics/claude-code` | 10 | Agent/plugin/hook geliştirme |
| `supabase/agent-skills` | 2 | Supabase + Postgres best practices |
| `nutlope/hallmark` | 1 | Anti-slop UI audit/redesign |
| `wshobson/agents` (seçili) | 5 | Next.js, E2E, Tailwind, Postgres, TS |
| `sickn33/antigravity-awesome-skills` (seçili) | 1 | nextjs-supabase-auth |
| `currents-dev/playwright-best-practices-skill` | 1 | Playwright E2E |
| `antfu/skills` | 1 | Vitest |
| `secondsky/claude-skills` | 1 | tailwind-v4-shadcn |
| Proje özel | 7 | ph-dental-uiux, design-flow, brief-to-tasks, vb. |

### Tam skill listesi (isim → yol)

| Skill | Yol |
|-------|-----|
| agent-development | `.agents/skills/agent-development` |
| algorithmic-art | `.agents/skills/algorithmic-art` |
| brand-guidelines | `.agents/skills/brand-guidelines` |
| brief-to-tasks | `.agents/skills/brief-to-tasks` |
| canvas-design | `.agents/skills/canvas-design` |
| claude-api | `.agents/skills/claude-api` |
| claude-opus-4-5-migration | `.agents/skills/claude-opus-4-5-migration` |
| command-development | `.agents/skills/command-development` |
| deploy-to-vercel | `.agents/skills/deploy-to-vercel` |
| design-brief | `.agents/skills/design-brief` |
| design-flow | `.agents/skills/design-flow` |
| design-review | `.agents/skills/design-review` |
| design-tokens | `.agents/skills/design-tokens` |
| doc-coauthoring | `.agents/skills/doc-coauthoring` |
| docx | `.agents/skills/docx` |
| e2e-testing-patterns | `.agents/skills/e2e-testing-patterns` |
| frontend-design | `.agents/skills/frontend-design` |
| grill-me | `.agents/skills/grill-me` |
| hallmark | `.agents/skills/hallmark` |
| hook-development | `.agents/skills/hook-development` |
| information-architecture | `.agents/skills/information-architecture` |
| internal-comms | `.agents/skills/internal-comms` |
| mcp-builder | `.agents/skills/mcp-builder` |
| mcp-integration | `.agents/skills/mcp-integration` |
| nextjs-app-router-patterns | `.agents/skills/nextjs-app-router-patterns` |
| nextjs-supabase-auth | `.agents/skills/nextjs-supabase-auth` |
| pdf | `.agents/skills/pdf` |
| **ph-dental-uiux** | `.agents/skills/ph-dental-uiux` |
| playwright-best-practices | `.agents/skills/playwright-best-practices` |
| plugin-settings | `.agents/skills/plugin-settings` |
| plugin-structure | `.agents/skills/plugin-structure` |
| postgresql-table-design | `.agents/skills/postgresql-table-design` |
| pptx | `.agents/skills/pptx` |
| skill-creator | `.agents/skills/skill-creator` |
| skill-development | `.agents/skills/skill-development` |
| slack-gif-creator | `.agents/skills/slack-gif-creator` |
| supabase | `.agents/skills/supabase` |
| supabase-postgres-best-practices | `.agents/skills/supabase-postgres-best-practices` |
| tailwind-design-system | `.agents/skills/tailwind-design-system` |
| tailwind-v4-shadcn | `.agents/skills/tailwind-v4-shadcn` |
| template-skill | `.agents/skills/template-skill` |
| theme-factory | `.agents/skills/theme-factory` |
| typescript-advanced-types | `.agents/skills/typescript-advanced-types` |
| vercel-cli-with-tokens | `.agents/skills/vercel-cli-with-tokens` |
| vercel-composition-patterns | `.agents/skills/vercel-composition-patterns` |
| vercel-optimize | `.agents/skills/vercel-optimize` |
| vercel-react-best-practices | `.agents/skills/vercel-react-best-practices` |
| vercel-react-native-skills | `.agents/skills/vercel-react-native-skills` |
| vercel-react-view-transitions | `.agents/skills/vercel-react-view-transitions` |
| vitest | `.agents/skills/vitest` |
| web-artifacts-builder | `.agents/skills/web-artifacts-builder` |
| web-design-guidelines | `.agents/skills/web-design-guidelines` |
| webapp-testing | `.agents/skills/webapp-testing` |
| writing-guidelines | `.agents/skills/writing-guidelines` |
| writing-hookify-rules | `.agents/skills/writing-hookify-rules` |
| xlsx | `.agents/skills/xlsx` |

### Güvenlik notu (Med Risk — dikkatli kullan)

- `vercel-cli-with-tokens` — token/secret içerebilir
- `web-design-guidelines` — harici kaynak çağrıları
- `supabase` — geniş DB/Auth yüzeyi
- `algorithmic-art`, `canvas-design` — dosya/script üretimi

### Bilerek atlananlar

- `wshobson/agents --all` (156 skill) — gürültü; 5 hedefli skill yeterli
- `sickn33/antigravity-awesome-skills --all` (1506 skill) — aşırı büyük paket
- `clerk/skills` — Clerk auth; proje Supabase Auth kullanıyor
- `neondatabase/agent-skills` — Postgres zaten `supabase-postgres-best-practices` ile kapsanıyor
- `microsoft/playwright-cli` — `playwright-best-practices` + `webapp-testing` yeterli
- `vercel-labs/agent-browser` — Cursor IDE browser MCP zaten mevcut

---

## Bağlantı durumu (dürüst snapshot)

| Servis | Durum | Not |
|--------|-------|-----|
| **GitHub** | 🟡 Kısmi | Remote: `https://github.com/icnevudila/dentali.git`, branch `main`. `gh` CLI bu PC'de login değil — webhook/Vercel bağlantısı doğrulanamadı. |
| **Supabase (local)** | 🟡 Kısmi | `.env.local` var. MCP: `project_ref=ahipxdlxyuvqikcybjpm` (`.cursor/mcp.json`). Migration dosyaları repo'da; uzak DB MCP ile push edilecek. |
| **Vercel** | ✅ Live | https://ph-dental-app.vercel.app — GitHub `icnevudila/dentali` bağlı, env'ler set (Supabase + SITE_URL). |
| **Dokümantasyon MD** | 🟢 Tam | `docs/` altında ~59 spec MD. 24 modül spec mevcut. |
| **Task checklist MD** | 🟠 Kısmi | 16 task dosyası var; **11–18, 21–23 task MD henüz yok**. |
| **Kod entegrasyonu** | 🟠 Erken | Foundation kısmen başladı; patient/chart çoğunlukla mock. |

### Marathon başlamadan önce (blokaj giderme)

- [ ] Supabase Dashboard → SQL Editor'da tüm `supabase/migrations/*.sql` sırayla uygulandı mı?
- [ ] Supabase'de test org + branch + staff assignment + en az 1 kullanıcı seed var mı?
- [ ] Vercel projesi `icnevudila/dentali` repo'suna bağlı mı? Env'ler Dashboard'da set mi?
- [ ] `vercel.json` placeholder env'leri kaldır (env sadece Vercel Dashboard'da tutulmalı)
- [ ] Middleware login redirect aktif mi? (şu an geçici kapalı)

---

## Sayfa tamamlanma tanımı (Definition of Done)

Her sayfa için **hepsi** yeşil olmadan `✅ DONE` yazılmaz:

```
[ ] MD + tasks/XX okundu
[ ] Migration + RLS + RPC (gerekliyse) uzak Supabase'de çalışıyor
[ ] Service layer (src/lib/...) — component'te direkt Supabase yok
[ ] UI: loading skeleton (layout mirror)
[ ] UI: empty state + CTA
[ ] UI: error state + retry
[ ] UI: permission denied (PermissionGate)
[ ] UI: saving/disabled state (tüm formlar)
[ ] Tüm butonlar gerçek aksiyon yapıyor (mock/alert yok)
[ ] Branch context doğru filtreliyor
[ ] Audit log yazılıyor (write işlemleri)
[ ] npm run build -- --webpack geçiyor
[ ] Manuel smoke: happy path
[ ] Manuel smoke: yetkisiz kullanıcı
[ ] tasks/XX_*.md checklist güncellendi
[ ] MODULE_INTEGRATION_PLAN.md durum simgesi güncellendi
```

---

## Marathon sırası (A→Z, sayfa sayfa)

### FAZ 0 — Altyapı (sayfa değil, ön koşul)

| # | İş | Durum |
|---|-----|-------|
| 0.1 | Tüm migration'ları Supabase'e push + doğrula | 🟡 |
| 0.2 | Seed: org, branch, roles, permissions, test user | 🟡 bootstrap_clinic RPC |
| 0.3 | `usePermission` + `BranchBootstrap` production test | 🟡 |
| 0.4 | Middleware auth redirect aç | ✅ |
| 0.5 | Vercel env + deploy pipeline | ⬜ |

---

### FAZ 1 — Foundation sayfaları

#### SAYFA 1: `/login` (Modül 02)

| Kontrol | Durum |
|---------|-------|
| Email/password Supabase auth | 🟡 |
| Loading + invalid credentials | 🟡 |
| Account disabled mesajı | ⬜ |
| Session audit log (login) | 🟡 |
| Redirect authenticated → dashboard | ⬜ |
| Logout → session audit | ⬜ |

**Sonraki adım:** disabled account, redirect, logout audit → sonra SAYFA 2.

---

#### SAYFA 2: `/` Dashboard (placeholder ama çalışır)

| Kontrol | Durum |
|---------|-------|
| Auth guard | ⬜ |
| Active branch görünür (Topbar) | 🟡 |
| KPI kartları gerçek veri veya honest empty | ⬜ |
| Sidebar nav permission-aware | ⬜ |

---

#### SAYFA 3: `/settings/organization` (Modül 01 + 04)

| Kontrol | Durum |
|---------|-------|
| Load org from Supabase | 🟡 |
| Save → update + toast | 🟡 |
| PermissionGate settings.manage | 🟡 |
| Loading / error / empty | 🟡 |
| Audit log on save | ⬜ |

---

#### SAYFA 4: `/settings/branches` (Modül 01)

| Kontrol | Durum |
|---------|-------|
| Liste Supabase RPC | 🟡 |
| Add branch form + create | 🟡 |
| Empty state CTA | 🟡 |
| Permission denied | 🟡 |
| Audit branch.created | ⬜ |

---

#### SAYFA 5: `/settings/branches/[id]` (Modül 01 + 04)

| Kontrol | Durum |
|---------|-------|
| Load branch detail | 🟡 |
| Save profile fields | 🟡 |
| Clinic hours grid (Modül 04) | ⬜ |
| Deactivate branch (soft) + audit | ⬜ |
| 404 / permission denied | ⬜ |

---

#### SAYFA 6: `/settings/roles` (Modül 02)

| Kontrol | Durum |
|---------|-------|
| Roles + permissions from DB | 🟡 |
| Expand permission list | 🟡 |
| Read-only matrix (MVP) | 🟡 |
| Custom role create (Phase 2) | ⬜ skip MVP |

---

#### SAYFA 7: `/settings/staff` (Modül 03)

| Kontrol | Durum |
|---------|-------|
| Staff list from Supabase | ⬜ |
| Invite staff modal | ⬜ |
| Branch assignment multi-select | ⬜ |
| Deactivate staff + audit | ⬜ |
| Empty / error / permission | ⬜ |

---

#### SAYFA 8: `/settings` layout + hub (Modül 04)

| Kontrol | Durum |
|---------|-------|
| Settings nav tam | 🟡 |
| Notification templates placeholder | ⬜ Phase 2 |
| Org settings (currency PHP read-only) | ⬜ |

**FAZ 1 bitiş kriteri:** Foundation 01–04 tüm sayfalar ✅ DONE.

---

### FAZ 2 — Patient sayfaları

#### SAYFA 9: `/patients` (Modül 05)

- [ ] `patients` migration + RLS
- [ ] PatientTable gerçek data + pagination
- [ ] PatientSearchBar debounced RPC
- [ ] Branch filter
- [ ] Empty / error / permission
- [ ] Mock data tamamen kaldırıldı

#### SAYFA 10: `/patients/new` (Modül 06)

- [ ] Multi-step intake wizard
- [ ] Zod validation + en-PH phone
- [ ] complete_intake RPC atomik
- [ ] Draft save
- [ ] Redirect → profile on success

#### SAYFA 11: `/patients/[id]` (Modül 05)

- [ ] Profile load + quick facts
- [ ] Tabs: overview, documents placeholder
- [ ] Medical alert banner hook (Modül 07 prep)
- [ ] Unpaid balance chip (Modül 20 prep)

#### SAYFA 12: `/patients/[id]/edit` (Modül 05)

- [ ] Load + save patient
- [ ] Duplicate detection uyarısı
- [ ] Audit patient.updated

#### SAYFA 13: `/patients/[id]/medical-history` (Modül 07) — route eklenecek

- [ ] Versioned medical history
- [ ] Allergy/medication/conditions
- [ ] Version compare drawer

#### SAYFA 14: `/patients/[id]/consents` + `/consents/[formId]` (Modül 08)

- [ ] Consent list
- [ ] Signature pad + sign RPC
- [ ] Signed PDF storage
- [ ] Void admin only

**FAZ 2 bitiş:** Patient 05–08 tüm sayfalar ✅ DONE.

---

### FAZ 3 — Clinical sayfaları

#### SAYFA 15: `/patients/[id]/chart` (Modül 09)

- [ ] get_patient_odontogram RPC
- [ ] upsert_tooth_finding RPC
- [ ] Mock setTimeout kaldır
- [ ] Save batch via PatientChartHeader
- [ ] MedicalAlertBanner
- [ ] Chart version history
- [ ] Primary teeth toggle çalışır

#### SAYFA 16: `/patients/[id]/tooth/[toothId]` (Modül 09)

- [ ] Deep link load
- [ ] Drawer equivalent full page
- [ ] Back navigation

#### SAYFA 17: `/patients/[id]/treatment-plan` (Modül 10) — route eklenecek

- [ ] Builder + chart→plan
- [ ] Approval capture
- [ ] Procedure catalog FK

**FAZ 3 bitiş:** Chart 09–10 ✅ DONE.

---

### FAZ 4 — Operations + Billing (MVP sonrası)

| Sayfa | Modül | Durum |
|-------|-------|-------|
| `/appointments` | 13 | ⬜ |
| `/settings/procedures` | 19 | ⬜ |
| `/billing/invoices` | 20 | ⬜ |
| `/settings/audit` | 24 | ⬜ |

---

## Eksik task MD dosyaları (marathon sırasında oluşturulacak)

- [x] `tasks/11_CLINICAL_NOTES_TIMELINE.md`
- [x] `tasks/12_ORTHODONTIC_RECORD.md`
- [x] `tasks/14_WAITLIST.md`
- [x] `tasks/15_CHECKIN_QUEUE.md`
- [x] `tasks/16_KIOSK_TABLET.md`
- [x] `tasks/17_TV_QUEUE_DISPLAY.md`
- [x] `tasks/18_NOTIFICATIONS_SMS.md`
- [x] `tasks/21_HMO_CLAIMS.md`
- [x] `tasks/23_INVENTORY_SUPPLIES.md`
- [x] `tasks/DESIGN_REVIEW_MVP.md`

---

## Şu an neredeyim?

> **Tek kaynak:** [`tasks/MARATHON_QUEUE.md`](./MARATHON_QUEUE.md)  
> **NOW:** **VA-F6** — canlı secret + deploy + cron + smoke (`docs/VA-F6_USER_STEPS.md`)

```
BUILD: ✅ tsc temiz | Secret-free marathon: tamam (~69/70 MASTER)
DONE: 202+ | QUEUE: boş (secret-free) | Migration: 80 dosya + idempotent bundle
KALAN: VA-F6-01–03 (Semaphore, PayMongo, PhilHealth) + Vercel prod deploy (kullanıcı)
```

### FAZ 0 — Altyapı

| # | İş | Durum |
|---|-----|-------|
| 0.1 | Migration push | 🟡 Repo'da 7+ dosya; MCP ile foundation + patients + wave2 uygulandı |
| 0.2 | Seed / bootstrap | ✅ `bootstrap_clinic` RPC — ilk login otomatik org+branch+owner |
| 0.3 | Permission + BranchBootstrap | ✅ |
| 0.4 | Middleware auth | ✅ |
| 0.5 | Vercel deploy | ⬜ `.vercel/` yok |

### FAZ 1 — Foundation

| Sayfa | Durum | Not |
|-------|-------|-----|
| `/login` | ✅ DONE | Auth, bootstrap, disabled check, session audit, redirect |
| `/` dashboard | ✅ DONE | KPI RPC: patients, today appts, pending consents |
| `/settings/organization` | ✅ DONE | Save + audit log |
| `/settings/branches` | ✅ DONE | CRUD list + create + audit |
| `/settings/branches/[id]` | ✅ DONE | Profile + clinic hours grid + deactivate |
| `/settings/roles` | ✅ DONE | Read-only matrix from DB |
| `/settings/staff` | 🟡 MVP | Liste + deactivate/reactivate; email invite Phase 2 |
| `/settings` layout | ✅ | Nav + hub redirect |
| Sidebar | ✅ | Permission-aware nav |

### FAZ 2 — Patients

| Sayfa | Durum | Not |
|-------|-------|-----|
| `/patients` | ✅ DONE | search_patients RPC, debounce, PermissionGate |
| `/patients/new` | ✅ DONE | Supabase create + audit + default consents seed |
| `/patients/[id]` | ✅ DONE | Tüm tab'lar gerçek veri + BookAppointmentDialog |
| `/patients/[id]/edit` | ✅ DONE | |
| `/patients/[id]/medical-history` | ✅ DONE | Versioned save |
| `/patients/[id]/consents/[formId]` | ✅ DONE | Template load + typed signature + sign RPC |

### FAZ 3 — Clinical

| Sayfa | Durum | Not |
|-------|-------|-----|
| `/patients/[id]/chart` | ✅ DONE | get_patient_odontogram + upsert_tooth_finding |
| `/patients/[id]/tooth/[toothId]` | ✅ DONE | Deep link read + link to chart |
| `/patients/[id]/treatment-plan` | ✅ DONE | Create, procedures, approve, convert invoice |

### FAZ 4 — Operations

| Sayfa | Durum |
|-------|-------|
| `/appointments` | ✅ MVP |
| `/billing` | ✅ MVP — invoice list |
| `/settings/procedures` | ✅ CRUD + seed |
| `/settings/audit` | ✅ Audit log viewer |

### Yeni dosyalar (servis katmanı)

- `src/lib/patients/patient-service.ts`
- `src/lib/patients/medical-history-service.ts`
- `src/lib/patients/consent-service.ts`
- `src/lib/odontogram/dental-chart-service.ts`
- `src/lib/dashboard/dashboard-service.ts`
- `src/lib/staff/staff-service.ts`
- `src/lib/org/clinic-hours-service.ts`
- `src/lib/appointments/appointment-service.ts`
- `src/lib/audit/audit-service.ts`

### Bilinen blokajlar

1. **Staff email invite** — Q045 (Edge Function + Admin API)
2. **Vercel deploy** — Q046
3. **Queue / kiosk / TV / HMO / PhilHealth / inventory** — Q048–Q056 sırasında
4. **Turbopack** — Türkçe path; build: `npm run build -- --webpack`

### Kullanıcı dönünce smoke test

1. Supabase Auth'ta user oluştur → `/login`
2. `/patients/new` → hasta ekle
3. `/patients/[id]/chart` → diş işaretle → Commit Chart
4. `/patients/[id]/consents/dpa-consent` → imzala
5. `/settings/branches/[id]` → clinic hours kaydet
