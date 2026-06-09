# Philippines Dental App — AI Starter Pack

Bu klasör, Filipinler merkezli bir dental clinic uygulamasını sıfırdan planlamak ve bir AI coding agent'a temiz şekilde iş yaptırmak için hazırlanmıştır.

Ürün hedefi: kağıt hasta formlarını, dental chart'ı, ortodonti kayıtlarını, ödeme/bakiye kartlarını, randevu/queue akışını ve HMO/PhilHealth benzeri finansal takipleri tek klinik işletim sistemine çevirmek.

## Bu pakette ne var?

| Dosya | Amaç |
|---|---|
| `01_AI_AGENT_RULES.md` | AI/coding agent için katı çalışma kuralları |
| `02_PRODUCT_BRIEF.md` | Ürün vizyonu, roller, MVP kapsamı |
| `03_PHILIPPINES_DOMAIN_NOTES.md` | Filipinler bağlamı: PHP, Asia/Manila, DPA, HMO, PhilHealth |
| `04_PATIENT_RECORD_REQUIREMENTS.md` | Hasta kayıt, medikal geçmiş, consent, dental chart gereksinimleri |
| `05_UI_UX_SYSTEM.md` | Görsel dil, layout, tasarım tokenları, component kuralları |
| `06_APP_INFORMATION_ARCHITECTURE.md` | Menü, modüller, sayfa haritası |
| `07_FRONTEND_ARCHITECTURE.md` | Web admin, mobile/tablet, kiosk, queue display frontend planı |
| `08_BACKEND_ARCHITECTURE.md` | Backend modül yapısı, API standardı, servis kuralları |
| `09_DATABASE_SCHEMA.md` | PostgreSQL tabanlı veri modeli taslağı |
| `10_API_CONTRACTS.md` | REST endpoint ve response kontratları |
| `11_SECURITY_PRIVACY_COMPLIANCE.md` | DPA uyumu, PHI/PII güvenliği, audit, erişim kontrolü |
| `12_CORE_WORKFLOWS.md` | Randevu, check-in, tedavi, ödeme, HMO, queue iş akışları |
| `13_PAGE_BY_PAGE_REQUIREMENTS.md` | Dashboard, appointments, patients, billing, kiosk vb. sayfa gereksinimleri |
| `14_QA_TEST_PLAN.md` | Test stratejisi, smoke test, e2e senaryoları |
| `15_ROADMAP_AND_TODOS.md` | Sprint planı ve yapılacaklar listesi |
| `16_PROMPTS_FOR_AI.md` | Cursor/Claude/ChatGPT gibi agentlara verilecek hazır promptlar |
| `AGENTS.md` | Repo köküne koyulacak kısa agent çalışma anayasası |

## Varsayılan teknoloji önerisi

Net karar vermediysen bu stack ile ilerle:

- **Web Admin:** Next.js + TypeScript + Tailwind + React Query
- **Mobile/Tablet:** Expo React Native
- **Backend:** NestJS veya Fastify + TypeScript
- **DB:** PostgreSQL
- **ORM:** Prisma veya Drizzle
- **Auth:** Session cookie for staff, scoped token for kiosk/queue
- **Storage:** S3-compatible object storage
- **Realtime:** SSE başlangıç için yeterli, sonra WebSocket

## MVP sınırı

İlk versiyon her şeyi yapmaya çalışmasın. Klinik ürünü böyle patlar: önce her şey var gibi görünür, sonra hiçbir şey güven vermez. MVP şunları bitirmeli:

1. Staff login + role permissions
2. Patient registration
3. Medical history + consent capture
4. Dental chart / odontogram
5. Appointment scheduling
6. Check-in + queue management
7. Treatment record
8. Invoice + payment ledger
9. Basic HMO tracking
10. Audit log + privacy-safe records

## Önemli not

Yüklenen fotoğraflardaki gerçek hasta adı, telefon ve kişisel bilgiler bu dokümanlara taşınmadı. Test verisi üretirken de gerçek hasta verisi kullanma. Klinik ürünü yazıyoruz; dedikodu defteri değil.

## AI agent çalışma sırası

1. `AGENTS.md` ve `01_AI_AGENT_RULES.md` oku.
2. `02_PRODUCT_BRIEF.md` ile ürün amacını anla.
3. `09_DATABASE_SCHEMA.md` ve `10_API_CONTRACTS.md` ile backend temelini kur.
4. `05_UI_UX_SYSTEM.md` ve `13_PAGE_BY_PAGE_REQUIREMENTS.md` ile ekranları üret.
5. Her feature bitince `14_QA_TEST_PLAN.md` testlerini çalıştır.
