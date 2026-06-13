import { getSiteUrl } from "@/lib/site-url"

/** Organization + SoftwareApplication schema for public marketing pages. */
export function MarketingJsonLd() {
  const siteUrl = getSiteUrl()

  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "dentali.",
        url: siteUrl,
        description:
          "Clinical operating system for Philippine dental clinics — patients, chart, queue, billing, and consent.",
      },
      {
        "@type": "SoftwareApplication",
        name: "dentali.",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "4990",
          priceCurrency: "PHP",
          url: `${siteUrl}/pricing`,
        },
        url: siteUrl,
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
