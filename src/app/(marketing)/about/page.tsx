import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { MarketingStaticPage } from "@/components/marketing/MarketingStaticPage"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about dentQL and the team building practical software for Philippine dental clinics.",
  alternates: { canonical: `${siteUrl}/about` },
}

export default function AboutPage() {
  return <MarketingStaticPage page="about" />
}
