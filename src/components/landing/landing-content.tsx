import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ShowcaseSnapshot } from "@/lib/showcase/types"
import {
  LandingHeroDevices,
  LandingMultiDeviceRow,
  LandingWorkflowSection,
} from "@/components/landing/landing-showcase"
import { LandingEyebrow, LandingSection, LandingSectionHeader } from "@/components/landing/landing-primitives"
import { cn } from "@/lib/utils"

const primaryCtaClassName = cn(
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium ring-offset-background transition-colors",
  "bg-primary-500 text-white hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
)

export function LandingContent({ showcase }: { showcase: ShowcaseSnapshot }) {
  const hasLiveData = showcase.source !== "empty"

  return (
    <>
      <LandingSection className="landing-hero-glow px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <LandingEyebrow>Philippine dental clinic OS</LandingEyebrow>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              Run your clinic on{" "}
              <span className="text-primary-600">
                dentali<span className="text-neutral-950">.</span>
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
              Patients, appointments, charting, billing, queue, and HMO — branch-aware from the
              first login. Built for busy Metro Manila clinics.
            </p>
            <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <a href="/login" data-testid="landing-staff-sign-in" className={primaryCtaClassName}>
                Staff sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Button size="lg" variant="outline" className="h-11 px-6" asChild>
                <Link href="/kiosk">Kiosk check-in</Link>
              </Button>
            </div>
            {hasLiveData ? (
              <p className="mt-6 text-sm text-neutral-500">
                Preview below uses{" "}
                <span className="font-medium text-neutral-700">{showcase.branch.name}</span>
                {showcase.source === "session" ? " — your signed-in clinic" : " — demo showcase data"}.
              </p>
            ) : (
              <p className="mt-6 text-sm text-amber-800/90">
                Run <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">scripts/seed-demo-showcase.sql</code>{" "}
                and set <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">LANDING_SHOWCASE_BRANCH_ID</code>{" "}
                to see live previews here.
              </p>
            )}
          </div>
          <LandingHeroDevices showcase={showcase} />
        </div>
      </LandingSection>

      <LandingSection className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-10">
          <LandingSectionHeader
            eyebrow="Every screen"
            title="Desktop, tablet, mobile, and waiting-room TV"
            description="Same queue and patient data — optimized layouts for admin desks, kiosk tablets, and the display board."
            align="center"
          />
          <LandingMultiDeviceRow showcase={showcase} />
        </div>
      </LandingSection>

      <LandingWorkflowSection showcase={showcase} />

      <LandingSection tone="inset" className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Ready to see your branch?
          </h2>
          <p className="mt-3 text-base text-neutral-600">
            Sign in with your staff account or seed demo data for a full dashboard preview.
          </p>
          <a href="/login" className={cn(primaryCtaClassName, "mt-8 px-8")}>
            Open clinic dashboard
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </LandingSection>
    </>
  )
}
