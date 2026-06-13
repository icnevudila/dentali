import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/landing-header"
import { LandingContent } from "@/components/landing/landing-content"
import { LandingFooter } from "@/components/landing/landing-footer"
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd"
import { loadShowcaseData } from "@/lib/showcase/load-showcase-data"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Dental clinic software for the Philippines",
  description:
    "Run your Metro Manila clinic on one system — appointments, dental chart, billing, HMO, queue display, kiosk check-in, and digital consent.",
  alternates: {
    canonical: `${siteUrl}/welcome`,
  },
  openGraph: {
    title: "dentali. — Philippine dental clinic OS",
    description:
      "Patients, appointments, charting, billing, queue, and HMO — branch-aware from the first login.",
    url: `${siteUrl}/welcome`,
  },
  keywords: [
    "dental clinic software Philippines",
    "dental practice management",
    "clinic queue system",
    "dental chart software",
    "HMO dental billing",
  ],
}

export default async function WelcomePage() {
  const showcase = await loadShowcaseData()
  return (
    <>
      <MarketingJsonLd />
      <LandingHeader />
      <LandingContent showcase={showcase} />
      <LandingFooter />
    </>
  )
}
