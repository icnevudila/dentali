"use client"

import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"

export type MarketingStaticPageId = "about" | "security" | "contact" | "privacy" | "terms"

type Card = { titleKey: string; titleFb: string; bodyKey: string; bodyFb: string; href?: string; linkKey?: string; linkFb?: string }

const PAGE_CONFIG: Record<
  MarketingStaticPageId,
  { eyebrowKey: string; eyebrowFb: string; titleKey: string; titleFb: string; introKey: string; introFb: string; cards: Card[] }
> = {
  about: {
    eyebrowKey: "marketing.static.aboutEyebrow",
    eyebrowFb: "About dentQL",
    titleKey: "marketing.static.aboutTitle",
    titleFb: "Built for real clinic days",
    introKey: "marketing.static.aboutIntro",
    introFb:
      "dentQL is a clinic operations platform designed around what actually happens in a busy dental branch: check-ins, queue updates, charting, treatment plans, billing, and day-end closeout.",
    cards: [
      {
        titleKey: "marketing.static.aboutCard1Title",
        titleFb: "Clinic-first design",
        bodyKey: "marketing.static.aboutCard1Body",
        bodyFb: "Every feature starts from real front-desk and chairside workflows.",
      },
      {
        titleKey: "marketing.static.aboutCard2Title",
        titleFb: "Branch-aware operations",
        bodyKey: "marketing.static.aboutCard2Body",
        bodyFb: "Multi-branch setup with shared standards and local control.",
      },
      {
        titleKey: "marketing.static.aboutCard3Title",
        titleFb: "Incremental reliability",
        bodyKey: "marketing.static.aboutCard3Body",
        bodyFb: "We ship in small steps and validate changes in live clinic flows.",
      },
    ],
  },
  security: {
    eyebrowKey: "marketing.static.securityEyebrow",
    eyebrowFb: "Security",
    titleKey: "marketing.static.securityTitle",
    titleFb: "Platform security overview",
    introKey: "marketing.static.securityIntro",
    introFb:
      "dentQL is designed for day-to-day clinic operations with role-based access, auditable actions, and controlled branch-level workflows.",
    cards: [
      {
        titleKey: "marketing.static.securityCard1Title",
        titleFb: "Access control",
        bodyKey: "marketing.static.securityCard1Body",
        bodyFb: "Permissions are enforced by role and branch to keep operational actions within authorized scope.",
      },
      {
        titleKey: "marketing.static.securityCard2Title",
        titleFb: "Auditability",
        bodyKey: "marketing.static.securityCard2Body",
        bodyFb: "Key workflow actions can be tracked for accountability and compliance review.",
      },
      {
        titleKey: "marketing.static.securityCard3Title",
        titleFb: "Workflow safeguards",
        bodyKey: "marketing.static.securityCard3Body",
        bodyFb: "Check-in, billing, and closeout flows include guardrails to reduce operational mistakes.",
      },
      {
        titleKey: "marketing.static.securityCard4Title",
        titleFb: "Continuous hardening",
        bodyKey: "marketing.static.securityCard4Body",
        bodyFb: "Security and reliability improvements are shipped continuously with branch-safe rollouts.",
      },
    ],
  },
  contact: {
    eyebrowKey: "marketing.static.contactEyebrow",
    eyebrowFb: "Contact",
    titleKey: "marketing.static.contactTitle",
    titleFb: "Let's talk about your clinic",
    introKey: "marketing.static.contactIntro",
    introFb:
      "For demos, onboarding, and implementation questions, share your clinic setup and we'll recommend the fastest rollout path.",
    cards: [
      {
        titleKey: "marketing.static.contactCard1Title",
        titleFb: "Sales & onboarding",
        bodyKey: "marketing.static.contactCard1Body",
        bodyFb: "Request a guided demo and deployment checklist for your branch.",
        href: "/quote",
        linkKey: "marketing.static.contactQuoteLink",
        linkFb: "Open quote form →",
      },
      {
        titleKey: "marketing.static.contactCard2Title",
        titleFb: "Support",
        bodyKey: "marketing.static.contactCard2Body",
        bodyFb: "Existing customer and need urgent assistance? Reach support from your account channel.",
        href: "/login",
        linkKey: "marketing.static.contactLoginLink",
        linkFb: "Sign in →",
      },
    ],
  },
  privacy: {
    eyebrowKey: "marketing.static.privacyEyebrow",
    eyebrowFb: "Legal",
    titleKey: "marketing.static.privacyTitle",
    titleFb: "Privacy policy",
    introKey: "marketing.static.privacyIntro",
    introFb: "This page is a plain-language summary. A finalized legal policy can replace this template at any time.",
    cards: [
      {
        titleKey: "marketing.static.privacyCard1Title",
        titleFb: "What we collect",
        bodyKey: "marketing.static.privacyCard1Body",
        bodyFb: "Account and clinic setup details, usage logs, and operational records needed to run the platform.",
      },
      {
        titleKey: "marketing.static.privacyCard2Title",
        titleFb: "How we use data",
        bodyKey: "marketing.static.privacyCard2Body",
        bodyFb: "To provide product functionality, improve reliability, and support compliance and audit requirements.",
      },
      {
        titleKey: "marketing.static.privacyCard3Title",
        titleFb: "Data access and retention",
        bodyKey: "marketing.static.privacyCard3Body",
        bodyFb: "Access is role-based. Retention and deletion requests can be processed through your organization administrator.",
      },
    ],
  },
  terms: {
    eyebrowKey: "marketing.static.termsEyebrow",
    eyebrowFb: "Legal",
    titleKey: "marketing.static.termsTitle",
    titleFb: "Terms of service",
    introKey: "marketing.static.termsIntro",
    introFb: "This page is an operational summary and placeholder for full legal terms.",
    cards: [
      {
        titleKey: "marketing.static.termsCard1Title",
        titleFb: "Service usage",
        bodyKey: "marketing.static.termsCard1Body",
        bodyFb: "Users must have authorized access from their clinic organization and use the platform for legitimate clinical operations.",
      },
      {
        titleKey: "marketing.static.termsCard2Title",
        titleFb: "Security responsibilities",
        bodyKey: "marketing.static.termsCard2Body",
        bodyFb: "Organizations are responsible for account hygiene, staff access reviews, and secure handling of local devices.",
      },
      {
        titleKey: "marketing.static.termsCard3Title",
        titleFb: "Availability and support",
        bodyKey: "marketing.static.termsCard3Body",
        bodyFb: "We maintain the service and ship updates continuously; support channels depend on your subscription tier.",
      },
    ],
  },
}

export function MarketingStaticPage({ page }: { page: MarketingStaticPageId }) {
  const { t } = useLocale()
  const cfg = PAGE_CONFIG[page]
  const gridCols = page === "about" ? "sm:grid-cols-3" : "sm:grid-cols-2"

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
        {t(cfg.eyebrowKey, cfg.eyebrowFb)}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
        {t(cfg.titleKey, cfg.titleFb)}
      </h1>
      <p className="mt-4 text-base leading-7 text-neutral-600">{t(cfg.introKey, cfg.introFb)}</p>

      <div className={`mt-8 grid gap-4 ${gridCols}`}>
        {cfg.cards.map((card) => (
          <article key={card.titleKey} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-neutral-900">{t(card.titleKey, card.titleFb)}</h2>
            <p className="mt-2 text-sm text-neutral-600">{t(card.bodyKey, card.bodyFb)}</p>
            {card.href && card.linkKey ? (
              <Link href={card.href} className="mt-4 inline-block text-sm font-semibold text-primary-700 hover:underline">
                {t(card.linkKey, card.linkFb ?? "")}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
