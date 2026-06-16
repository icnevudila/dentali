import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about dentQL and the team building practical software for Philippine dental clinics.",
  alternates: { canonical: `${siteUrl}/about` },
}

export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">About dentQL</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">Built for real clinic days</h1>
      <p className="mt-4 text-base leading-7 text-neutral-600">
        dentQL is a clinic operations platform designed around what actually happens in a busy
        dental branch: check-ins, queue updates, charting, treatment plans, billing, and day-end
        closeout. Our focus is practical software that helps teams move faster with fewer mistakes.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Clinic-first design</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Every feature starts from real front-desk and chairside workflows.
          </p>
        </article>
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Branch-aware operations</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Multi-branch setup with shared standards and local control.
          </p>
        </article>
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Incremental reliability</h2>
          <p className="mt-2 text-sm text-neutral-600">
            We ship in small steps and validate changes in live clinic flows.
          </p>
        </article>
      </div>
    </section>
  )
}
