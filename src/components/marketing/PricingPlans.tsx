import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "₱4,990",
    period: "/ month",
    description: "Single branch, up to 5 staff seats. Core clinical workflow.",
    features: [
      "Patient registry & dental chart",
      "Appointments & queue board",
      "Billing & receipts",
      "Kiosk check-in link",
      "Digital consent templates",
    ],
    cta: { label: "Start free trial", href: "/signup" },
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "₱9,990",
    period: "/ month",
    description: "Multi-branch clinics with HMO and inventory.",
    features: [
      "Everything in Starter",
      "Multiple branches",
      "HMO & PhilHealth-ready fields",
      "Inventory & low-stock alerts",
      "Reports & exports",
    ],
    cta: { label: "Start free trial", href: "/signup" },
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Large groups, custom integrations, and dedicated onboarding.",
    features: [
      "Unlimited branches & seats",
      "PayMongo & SMS automation",
      "Custom workflows & SLA",
      "Migration assistance",
      "Priority support",
    ],
    cta: { label: "Get a quote", href: "/quote" },
    highlighted: false,
  },
] as const

export function PricingPlans({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-3", className)}>
      {PRICING_TIERS.map((tier) => (
        <article
          key={tier.id}
          className={cn(
            "flex flex-col rounded-xl border bg-white p-6 shadow-sm",
            tier.highlighted ? "border-primary-300 ring-1 ring-primary-200" : "border-neutral-200"
          )}
        >
          {tier.highlighted ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
              Most popular
            </p>
          ) : (
            <div className="mb-3 h-4" aria-hidden />
          )}
          <h3 className="text-lg font-semibold text-neutral-950">{tier.name}</h3>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-neutral-950">{tier.price}</span>
            {tier.period ? <span className="text-sm text-neutral-500">{tier.period}</span> : null}
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
