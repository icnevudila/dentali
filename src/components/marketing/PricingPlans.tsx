"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

export function PricingPlans({ className }: { className?: string }) {
  const { t } = useLocale()

  const tiers = [
    {
      id: "starter",
      name: t("pricingTiers.starterName", "Starter"),
      description: t("pricingTiers.starterDesc", "Single branch, up to 5 staff seats. Core clinical workflow."),
      features: [
        t("pricingTiers.starterF1", "Patient registry & dental chart"),
        t("pricingTiers.starterF2", "Appointments & queue board"),
        t("pricingTiers.starterF3", "Billing & receipts"),
        t("pricingTiers.starterF4", "Kiosk check-in link"),
        t("pricingTiers.starterF5", "Digital consent templates"),
      ],
      cta: { label: t("marketing.startTrial", "Start free trial"), href: "/signup" },
      highlighted: false,
    },
    {
      id: "growth",
      name: t("pricingTiers.growthName", "Growth"),
      description: t("pricingTiers.growthDesc", "Multi-branch clinics with HMO and inventory."),
      features: [
        t("pricingTiers.growthF1", "Everything in Starter"),
        t("pricingTiers.growthF2", "Multiple branches"),
        t("pricingTiers.growthF3", "HMO & PhilHealth-ready fields"),
        t("pricingTiers.growthF4", "Inventory & low-stock alerts"),
        t("pricingTiers.growthF5", "Reports & exports"),
      ],
      cta: { label: t("marketing.startTrial", "Start free trial"), href: "/signup" },
      highlighted: true,
    },
    {
      id: "enterprise",
      name: t("pricingTiers.enterpriseName", "Enterprise"),
      description: t(
        "pricingTiers.enterpriseDesc",
        "Large groups, custom integrations, and dedicated onboarding."
      ),
      features: [
        t("pricingTiers.enterpriseF1", "Unlimited branches & seats"),
        t("pricingTiers.enterpriseF2", "PayMongo & SMS automation"),
        t("pricingTiers.enterpriseF3", "Custom workflows & SLA"),
        t("pricingTiers.enterpriseF4", "Migration assistance"),
        t("pricingTiers.enterpriseF5", "Priority support"),
      ],
      cta: { label: t("marketing.navQuote", "Get a quote"), href: "/quote" },
      highlighted: false,
    },
  ] as const

  return (
    <div className={cn("grid gap-6 lg:grid-cols-3", className)}>
      {tiers.map((tier) => (
        <article
          key={tier.id}
          className={cn(
            "flex flex-col rounded-xl border bg-white p-6 shadow-sm",
            tier.highlighted ? "border-primary-300 ring-1 ring-primary-200" : "border-neutral-200"
          )}
        >
          {tier.highlighted ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
              {t("pricingTiers.mostPopular", "Most popular")}
            </p>
          ) : (
            <div className="mb-3 h-4" aria-hidden />
          )}
          <h3 className="text-lg font-semibold text-neutral-950">{tier.name}</h3>
          <p className="mt-2 text-sm font-medium text-neutral-500">
            {t("pricingTiers.priceComingSoon", "Pricing coming soon")}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{tier.description}</p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {tier.features.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-neutral-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            className="mt-8 w-full"
            variant={tier.highlighted ? "default" : "outline"}
            asChild
          >
            <Link href={tier.cta.href} data-testid={`pricing-cta-${tier.id}`}>
              {tier.cta.label}
            </Link>
          </Button>
        </article>
      ))}
    </div>
  )
}
