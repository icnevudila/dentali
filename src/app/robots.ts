import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl()

  return {
    rules: {
      userAgent: "*",
      allow: ["/welcome", "/pricing", "/quote", "/signup"],
      disallow: [
        "/",
        "/login",
        "/onboarding",
        "/sign/",
        "/kiosk",
        "/display",
        "/patients",
        "/appointments",
        "/billing",
        "/queue",
        "/settings",
        "/reports",
        "/inventory",
        "/waitlist",
        "/ui-preview",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
