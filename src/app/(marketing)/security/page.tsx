import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { MarketingStaticPage } from "@/components/marketing/MarketingStaticPage"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Security",
  description: "Security posture and controls for dentQL clinic operations platform.",
  alternates: { canonical: `${siteUrl}/security` },
}

export default function SecurityPage() {
  return <MarketingStaticPage page="security" />
}
