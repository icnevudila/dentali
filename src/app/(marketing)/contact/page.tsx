import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { MarketingStaticPage } from "@/components/marketing/MarketingStaticPage"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with dentQL for demos, onboarding, and support questions.",
  alternates: { canonical: `${siteUrl}/contact` },
}

export default function ContactPage() {
  return <MarketingStaticPage page="contact" />
}
