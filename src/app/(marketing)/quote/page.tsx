import type { Metadata } from "next"
import Link from "next/link"
import { QuoteRequestForm } from "@/components/marketing/QuoteRequestForm"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Get a quote",
  description:
    "Request pricing and onboarding for your Philippine dental clinic or multi-branch group.",
  alternates: { canonical: `${siteUrl}/quote` },
  openGraph: {
    title: "Request a quote — dentali.",
    description: "Multi-branch clinics, HMO workflows, and custom integrations.",
    url: `${siteUrl}/quote`,
  },
}

export default function QuotePage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
            Sales
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            Get a quote for your clinic
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Tell us about your branches and workflow. We will reply with plan options, migration
            help, and go-live timing — usually within one business day.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-neutral-700">
            <li>Multi-branch & HMO-heavy clinics</li>
            <li>Custom integrations (PayMongo, SMS, PhilHealth fields)</li>
            <li>Staff training and data import from spreadsheets</li>
          </ul>
          <p className="mt-8 text-sm text-neutral-500">
            Ready to try now?{" "}
            <Link href="/signup" className="font-medium text-primary-600 hover:underline">
              Start free trial
            </Link>{" "}
            — no sales call required for Starter.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <QuoteRequestForm />
        </div>
      </div>
    </div>
  )
}
