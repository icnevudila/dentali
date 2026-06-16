import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Privacy policy for dentQL services and website usage.",
  alternates: { canonical: `${siteUrl}/privacy` },
}

export default function PrivacyPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
        Privacy policy
      </h1>
      <p className="mt-4 text-sm leading-7 text-neutral-600">
        This page is a plain-language summary. A finalized legal policy can replace this template at
        any time.
      </p>

      <div className="mt-8 space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">What we collect</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Account and clinic setup details, usage logs, and operational records needed to run the
            platform.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">How we use data</h2>
          <p className="mt-2 text-sm text-neutral-600">
            To provide product functionality, improve reliability, and support compliance and audit
            requirements.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">Data access and retention</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Access is role-based. Retention and deletion requests can be processed through your
            organization administrator.
          </p>
        </section>
      </div>
    </section>
  )
}
