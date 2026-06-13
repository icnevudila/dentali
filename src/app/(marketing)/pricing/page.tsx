import type { Metadata } from "next"
import Link from "next/link"
import { PricingPlans } from "@/components/marketing/PricingPlans"
import { PricingFaqSection } from "@/components/marketing/PricingFaqSection"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for Philippine dental clinics — single branch to multi-site groups.",
  alternates: { canonical: `${siteUrl}/pricing` },
  openGraph: {
    title: "dentali. pricing — Philippine dental clinic software",
    description: "Starter, Growth, and Enterprise plans for clinics and multi-branch groups.",
    url: `${siteUrl}/pricing`,
  },
}

export default function PricingPage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
            Pricing
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Plans that scale with your clinic
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Placeholder tiers for launch — final pricing and promos will appear here. All plans
            include the full clinical workflow: patients, chart, queue, billing, and consent.
          </p>
        </div>

        <PricingPlans className="mt-12" />

        <PricingFaqSection />

        <p className="mt-10 text-center text-sm text-neutral-500">
          Need a custom rollout or PhilHealth / PayMongo integration?{" "}
          <Link href="/quote" className="font-medium text-primary-600 hover:underline">
            Get a quote
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="font-medium text-primary-600 hover:underline">
            start a free trial
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
