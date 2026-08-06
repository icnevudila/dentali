import type { Metadata } from "next"
import { PricingPageContent } from "@/components/marketing/PricingPageContent"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free trial for Philippine dental clinics. Published list prices are not final — Starter and Growth start with a trial; Enterprise is quote-based.",
  alternates: { canonical: `${siteUrl}/pricing` },
  openGraph: {
    title: "dentQL pricing — Philippine dental clinic software",
    description:
      "Trial access for single- and multi-branch clinics. Rates and Enterprise options confirmed after signup or quote.",
    url: `${siteUrl}/pricing`,
  },
}

export default function PricingPage() {
  return <PricingPageContent />
}
