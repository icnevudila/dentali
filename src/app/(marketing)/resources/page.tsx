import type { Metadata } from "next"
import Link from "next/link"
import { ARTICLES } from "@/lib/marketing/resources-data"
import { MarketingShell } from "@/components/marketing/MarketingShell"
import { getSiteUrl } from "@/lib/site-url"
import { Calendar, Clock, User, ArrowRight, BookOpen } from "lucide-react"

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
          {/* Header */}
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-600/10 mb-4">
              <BookOpen className="h-3.5 w-3.5" />
              Resources & Insights
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              Elevate Your Dental Practice
            </h1>
            <p className="mt-4 text-lg text-neutral-600">
              Discover guides, industry insights, and practical tips on managing clinic queues, choosing the right software, and boosting patient satisfaction in the Philippines.
            </p>
          </div>

          {/* Grid */}
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {ARTICLES.map((article) => (
              <article
                key={article.slug}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary-200"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-800">
                      {article.category}
                    </span>
                    <span className="text-xs text-neutral-400">•</span>
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Clock className="h-3.5 w-3.5 text-neutral-400" />
                      {article.readTime}
                    </span>
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-neutral-900 transition-colors group-hover:text-primary-700">
                    <Link href={`/resources/${article.slug}`} className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {article.title}
                    </Link>
                  </h2>

                  <p className="mt-3 text-sm text-neutral-600 line-clamp-3">
                    {article.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4">
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-neutral-400" />
                      {article.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      {article.publishedAt}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-primary-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Read Article
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </MarketingShell>
  )
}
