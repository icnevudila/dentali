import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { MarketingStaticPage } from "@/components/marketing/MarketingStaticPage"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms of service for using dentQL products and services.",
  alternates: { canonical: `${siteUrl}/terms` },
}

export default function TermsPage() {
  return <MarketingStaticPage page="terms" />
}
