import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"
import { ARTICLES } from "@/lib/marketing/resources-data"

/** Public marketing routes only — clinical app routes stay out of the index. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const lastModified = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
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
    {
      url: `${base}/resources`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ]

  const articleRoutes = ARTICLES.map((article) => ({
    url: `${base}/resources/${article.slug}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...articleRoutes]
}
