# SEO & Content Hub — Phase 2 Backlog

> **Durum:** Planlama — kod yok. Phase 1 tamamlandı: `/welcome` metadata, `sitemap.xml`, `robots.txt`, sign sayfaları `noindex`.
> **Hedef:** TR + global organik trafik; geniş, tutarlı, modül-uyumlu içerik.

---

## Phase 1 (DONE)

| Öğe | Dosya / route |
|-----|----------------|
| Canonical site URL | `src/lib/site-url.ts` |
| Sitemap (marketing) | `src/app/sitemap.ts` → `/welcome`, `/pricing`, `/quote`, `/signup` |
| Robots (app kapalı, marketing açık) | `src/app/robots.ts` |
| Marketing shell (nav + footer) | `src/components/marketing/MarketingShell.tsx` |
| Welcome OG + JSON-LD | `src/app/(marketing)/welcome/page.tsx` |
| Pricing FAQ + FAQPage schema | `src/components/marketing/PricingFaqSection.tsx` |
| Sign up / quote / pricing pages | `src/app/(marketing)/*` |
| Quote leads RPC | `20260612240000_marketing_leads.sql` → bundle 89 files |
| Sign token noindex | `src/app/sign/layout.tsx` |
| Root metadata template | `src/app/layout.tsx` |

**Prod:** `NEXT_PUBLIC_SITE_URL=https://your-domain` Vercel env’de set edilmeli.

---

## Phase 2 — Content hub (sonraki büyük iş)

### Bilgi mimarisi

```
/resources                    → hub (EN default)
/resources/[slug]             → makale
/tr/kaynaklar                 → TR hub (hreflang)
/tr/kaynaklar/[slug]
```

Kategoriler (pillar):

1. **Product** — Dashboard, chart, billing, queue, kiosk, consent
2. **Philippines market** — HMO, PhilHealth, branch ops, Metro Manila clinic workflow
3. **Compliance & trust** — consent, audit, data retention
4. **Compare & choose** — vs spreadsheets, vs generic EMR

### İçerik standardı (her makale)

- Problem (clinic owner language)
- Workflow (adım adım)
- dentali. özelliği (screenshot / modül linki)
- FAQ (3–5) → `FAQPage` schema
- CTA → `/welcome` veya demo branch showcase

### Teknik checklist (Phase 2)

- [ ] MDX veya CMS (Contentlayer / Sanity / markdown in repo)
- [ ] `generateMetadata` + `Article` JSON-LD
- [ ] `hreflang` EN / TR / fil
- [ ] Internal link graph (pillar → cluster)
- [ ] RSS (opsiyonel)
- [ ] Analytics: organik landing → sign-in funnel

### İlk 10 pillar (öneri)

| Slug | TR karşılık | Odak |
|------|-------------|------|
| `dental-clinic-software-philippines` | `filipinler-dis-klinigi-yazilimi` | Ana keyword |
| `dental-chart-digital` | `dijital-dis-haritasi` | Chart modülü |
| `clinic-queue-display` | `klinik-sira-ekrani` | Display + TV |
| `kiosk-patient-check-in` | `kiosk-hasta-kayit` | Kiosk |
| `dental-consent-forms-digital` | `dijital-onam-formlari` | Consent |
| `hmo-dental-billing` | `hmo-dis-faturalama` | Billing/HMO |
| `multi-branch-dental-clinic` | `cok-subeli-dis-klinigi` | Branch-aware |
| `owner-daily-digest-sms` | `sahip-gunluk-ozet` | Workflow SMS |
| `hygiene-recall-automation` | `hygiene-hatirlatma` | Recall cron |
| `philhealth-dental-claims` | `philhealth-dis-talepleri` | PhilHealth |

Her pillar → 3–5 cluster yazı (ör. consent pillar → DRG, PDA, witness signature, token link).

---

## Phase 3 — Global expansion

- Locale-specific examples (PH vs TR clinic sizes)
- Case studies (anonim branch metrikleri)
- Partner / integrator sayfaları (PayMongo, Semaphore SMS)

---

## Agent notu

Phase 2 başlarken: önce IA + 3 örnek makale (EN) + hreflang şablonu; sonra toplu içerik üretimi. Tutarlılık için `docs/content/STYLE.md` oluştur.
