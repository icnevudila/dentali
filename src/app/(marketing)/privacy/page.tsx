import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { MarketingStaticPage } from "@/components/marketing/MarketingStaticPage"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Privacy policy for dentQL services and website usage.",
  alternates: { canonical: `${siteUrl}/privacy` },
}

export default function PrivacyPage() {
  return <MarketingStaticPage page="privacy" />
}
