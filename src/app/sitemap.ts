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
    {
      url: `${base}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/quote`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ]
}
