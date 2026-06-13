import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

/** Public marketing routes only — clinical app routes stay out of the index. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const lastModified = new Date()

  return [
    {
      url: `${base}/welcome`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
