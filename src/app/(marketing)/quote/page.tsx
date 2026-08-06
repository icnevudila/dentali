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
    title: "Request a quote — dentQL",
    description:
      "Tell us about your branches and HMO needs. We reply with plan options; paid integrations are scoped per engagement.",
    url: `${siteUrl}/quote`,
  },
}

export default function QuotePage() {
  return <QuotePageContent />
}
