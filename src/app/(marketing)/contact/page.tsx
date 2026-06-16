import type { Metadata } from "next"
import Link from "next/link"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with dentQL for demos, onboarding, and support questions.",
  alternates: { canonical: `${siteUrl}/contact` },
}

export default function ContactPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Contact</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
        Let&apos;s talk about your clinic
      </h1>
      <p className="mt-4 text-base leading-7 text-neutral-600">
        For demos, onboarding, and implementation questions, share your clinic setup and we&apos;ll
        recommend the fastest rollout path.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Sales & onboarding</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Request a guided demo and deployment checklist for your branch.
          </p>
          <Link href="/quote" className="mt-4 inline-block text-sm font-semibold text-primary-700 hover:underline">
            Open quote form →
          </Link>
        </article>

        <article className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Support</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Existing customer and need urgent assistance? Reach support from your account channel.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-primary-700 hover:underline">
            Sign in →
          </Link>
        </article>
      </div>
    </section>
  )
}
