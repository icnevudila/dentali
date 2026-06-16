import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms of service for using dentQL products and services.",
  alternates: { canonical: `${siteUrl}/terms` },
}

export default function TermsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
        Terms of service
      </h1>
      <p className="mt-4 text-sm leading-7 text-neutral-600">
        This page is an operational summary and placeholder for full legal terms.
      </p>

      <div className="mt-8 space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">Service usage</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Users must have authorized access from their clinic organization and use the platform for
            legitimate clinical operations.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">Security responsibilities</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Organizations are responsible for account hygiene, staff access reviews, and secure
            handling of local devices.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">Availability and support</h2>
          <p className="mt-2 text-sm text-neutral-600">
            We maintain the service and ship updates continuously; support channels and response
            windows depend on your subscription tier.
          </p>
        </section>
      </div>
    </section>
  )
}
