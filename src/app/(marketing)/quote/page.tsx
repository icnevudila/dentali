import type { Metadata } from "next"
import { QuotePageContent } from "@/components/marketing/QuotePageContent"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Get a quote",
  description:
    "Request pricing and onboarding for your Philippine dental clinic or multi-branch group.",
  alternates: { canonical: `${siteUrl}/quote` },
  openGraph: {
    title: "Request a quote — dentali.",
    description: "Multi-branch clinics, HMO workflows, and custom integrations.",
    url: `${siteUrl}/quote`,
  },
}

export default function QuotePage() {
  return <QuotePageContent />
}
