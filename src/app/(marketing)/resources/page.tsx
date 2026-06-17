import type { Metadata } from "next"
import Link from "next/link"
import { ARTICLES } from "@/lib/marketing/resources-data"
import { MarketingShell } from "@/components/marketing/MarketingShell"
import { BlogPostCard } from "@/components/marketing/BlogPostCard"
import { getSiteUrl } from "@/lib/site-url"
import { BookOpen } from "lucide-react"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Dental Resources & Insights | dentali.",
  description:
    "Expert articles and guides on clinic operations, dental software, patient experience, and compliance for dental practices in the Philippines.",
  alternates: { canonical: `${siteUrl}/resources` },
  openGraph: {
    title: "Dental Resources & Insights | dentali.",
    description:
      "Expert articles and guides on clinic operations, dental software, patient experience, and compliance for dental practices in the Philippines.",
    url: `${siteUrl}/resources`,
  },
}

export default function ResourcesPage() {
  return (
    <MarketingShell>
      <div className="bg-neutral-50/50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-600/10">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Resources & Insights
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              Elevate Your Dental Practice
            </h1>
            <p className="mt-4 text-lg text-neutral-600">
              Discover guides, industry insights, and practical tips on managing clinic queues, choosing
              the right software, and boosting patient satisfaction in the Philippines.
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              Patient-facing articles live on our{" "}
              <Link href="/blog" className="font-semibold text-primary-700 hover:underline">
                dental blog
              </Link>
              .
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {ARTICLES.map((article, index) => (
              <BlogPostCard
                key={article.slug}
                post={article}
                hrefPrefix="/resources"
                priorityImage={index < 2}
              />
            ))}
          </div>
        </div>
      </div>
    </MarketingShell>
  )
}
