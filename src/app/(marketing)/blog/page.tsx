import type { Metadata } from "next"
import Link from "next/link"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Blog",
  description: "Operational playbooks and product updates for dental clinic teams.",
  alternates: { canonical: `${siteUrl}/blog` },
}

export default function BlogPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Blog</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
        Clinic operations notes
      </h1>
      <p className="mt-4 text-base leading-7 text-neutral-600">
        We publish practical guides on scheduling, queue flow, billing quality, and day-end
        controls for dental practices.
      </p>

      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Content hub</h2>
        <p className="mt-2 text-sm text-neutral-600">
          We&apos;re organizing posts in our resources section while this blog index is being expanded.
        </p>
        <Link
          href="/resources"
          className="mt-4 inline-block text-sm font-semibold text-primary-700 hover:underline"
        >
          Browse resources →
        </Link>
      </div>
    </section>
  )
}
