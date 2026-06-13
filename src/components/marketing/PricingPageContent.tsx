"use client"

import Link from "next/link"
import { PricingPlans } from "@/components/marketing/PricingPlans"
import { PricingFaqSection } from "@/components/marketing/PricingFaqSection"
import { useLocale } from "@/hooks/use-locale"

export function PricingPageContent() {
  const { t } = useLocale()

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
            {t("pricingPage.eyebrow", "Pricing")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t("pricingPage.title", "Plans that scale with your clinic")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            {t(
              "pricingPage.subtitle",
              "Placeholder tiers for launch — final pricing and promos will appear here. All plans include the full clinical workflow: patients, chart, queue, billing, and consent."
            )}
          </p>
        </div>

        <PricingPlans className="mt-12" />
        <PricingFaqSection />

        <p className="mt-10 text-center text-sm text-neutral-500">
          {t("pricingPage.footerNeedCustom", "Need a custom rollout or PhilHealth / PayMongo integration?")}{" "}
          <Link href="/quote" className="font-medium text-primary-600 hover:underline">
            {t("marketing.navQuote", "Get a quote")}
          </Link>{" "}
          {t("pricingPage.footerOr", "or")}{" "}
          <Link href="/signup" className="font-medium text-primary-600 hover:underline">
            {t("pricingPage.footerStartTrial", "start a free trial")}
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
