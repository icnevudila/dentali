"use client"

import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function PricingSummarySection() {
  const { locale, t } = useLocale()

  const tiers = [
    {
      id: "starter",
      name: t("pricingTiers.starterName", "Starter"),
      price: t("pricingTiers.starterPrice", "Free 14-day trial"),
      description: t("pricingTiers.starterDesc", "Single branch, up to 5 staff seats. Core clinical workflow."),
      highlight: t("pricingTiers.starterF1", "Patient registry & dental chart"),
      cta: { label: t("marketing.startTrial", "Start free trial"), href: "/signup" },
      highlighted: false,
    },
    {
      id: "growth",
      name: t("pricingTiers.growthName", "Growth"),
      price: t("pricingTiers.growthPrice", "Free 14-day trial"),
      description: t("pricingTiers.growthDesc", "Multi-branch clinics with HMO and inventory."),
      highlight: t("pricingTiers.growthF2", "Multiple branches"),
      cta: { label: t("marketing.startTrial", "Start free trial"), href: "/signup" },
      highlighted: true,
    },
    {
      id: "enterprise",
      name: t("pricingTiers.enterpriseName", "Enterprise"),
      price: t("pricingTiers.enterprisePrice", "Custom quote"),
      description: t(
        "pricingTiers.enterpriseDesc",
        "Large groups, custom integrations, and dedicated onboarding."
      ),
      highlight: t("pricingTiers.enterpriseF1", "Unlimited branches & seats"),
      cta: { label: t("marketing.navQuote", "Get a quote"), href: "/quote" },
      highlighted: false,
    },
  ] as const

  return (
    <section
      id="pricing"
      data-landing-conversion-zone
      className="relative overflow-hidden border-y border-neutral-100 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl space-y-4 text-center">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary-600">
              {lt(LANDING_HEADINGS.pricingSummary.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              {lt(LANDING_HEADINGS.pricingSummary.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.pricingSummary.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal direction="up" delay={200}>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0">
            {tiers.map((tier) => (
              <article
                key={tier.id}
                className={cn(
                  "flex w-[min(85vw,280px)] shrink-0 snap-center flex-col rounded-2xl border bg-white p-5 shadow-sm sm:w-auto",
                  tier.highlighted
                    ? "border-primary-300 ring-1 ring-primary-200"
                    : "border-neutral-200"
                )}
              >
                {tier.highlighted ? (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-600">
                    {t("pricingTiers.mostPopular", "Most popular")}
                  </p>
                ) : (
                  <div className="mb-2 h-4" aria-hidden />
                )}
                <h3 className="text-base font-semibold text-neutral-950">{tier.name}</h3>
                <p className="mt-1 text-sm font-medium text-neutral-500">{tier.price}</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{tier.description}</p>
                <p className="mt-4 flex gap-2 text-sm text-neutral-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  {tier.highlight}
                </p>
                <Link
                  href={tier.cta.href}
                  className={cn(
                    "mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
                    tier.highlighted
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                  )}
                >
                  {tier.cta.label}
                </Link>
              </article>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={350} className="mt-8 text-center">
          <Link
            href="/pricing"
            className="inline-flex text-sm font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            {lt(LANDING_HEADINGS.pricingSummary.viewAll, locale)}
          </Link>
        </ScrollReveal>
      </div>
    </section>
  )
}
