import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Security",
  description: "Security posture and controls for dentQL clinic operations platform.",
  alternates: { canonical: `${siteUrl}/security` },
}

export default function SecurityPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Security</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
        Platform security overview
      </h1>
      <p className="mt-4 text-base leading-7 text-neutral-600">
        dentQL is designed for day-to-day clinic operations with role-based access, auditable actions,
        and controlled branch-level workflows.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Access control</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Permissions are enforced by role and branch to keep operational actions within authorized scope.
          </p>
        </article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Auditability</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Key workflow actions can be tracked for accountability and compliance review.
          </p>
        </article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Workflow safeguards</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Check-in, billing, and closeout flows include guardrails to reduce operational mistakes.
          </p>
        </article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Continuous hardening</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Security and reliability improvements are shipped continuously with branch-safe rollouts.
          </p>
        </article>
      </div>
    </section>
  )
}
