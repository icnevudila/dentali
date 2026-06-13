import type { Metadata } from "next"
import { PricingPageContent } from "@/components/marketing/PricingPageContent"
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
  return <PricingPageContent />
}
