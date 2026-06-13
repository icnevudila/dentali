"use client"

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
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

const primaryCtaClassName = cn(
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium ring-offset-background transition-colors",
  "bg-primary-500 text-white hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
)

export function LandingContent({ showcase }: { showcase: ShowcaseSnapshot }) {
  const { t } = useLocale()
  const hasLiveData = showcase.source !== "empty"

  return (
    <>
      <LandingSection className="landing-hero-glow px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <LandingEyebrow>{t("landing.eyebrow", "Philippine dental clinic OS")}</LandingEyebrow>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              {t("landing.heroTitle", "Run your clinic on")}{" "}
              <span className="text-primary-600">
                dentali<span className="text-neutral-950">.</span>
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
              {t(
                "landing.heroSubtitle",
                "Patients, appointments, charting, billing, queue, and HMO — branch-aware from the first login. Built for busy Metro Manila clinics."
              )}
            </p>
            <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href="/signup" data-testid="landing-start-trial" className={primaryCtaClassName}>
                {t("marketing.startTrial", "Start free trial")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Button size="lg" variant="outline" className="h-11 px-6" asChild>
                <Link href="/quote" data-testid="landing-get-quote">
                  {t("marketing.navQuote", "Get a quote")}
                </Link>
              </Button>
              <Button size="lg" variant="ghost" className="h-11 px-4 text-neutral-700" asChild>
                <Link href="/login" data-testid="landing-staff-sign-in">
                  {t("marketing.signIn", "Staff sign in")}
                </Link>
              </Button>
            </div>
            {hasLiveData ? (
              <p className="mt-6 text-sm text-neutral-500">
                {t("landing.previewUses", "Preview below uses")}{" "}
                <span className="font-medium text-neutral-700">{showcase.branch.name}</span>
                {showcase.source === "session"
                  ? t("landing.previewSession", " — your signed-in clinic")
                  : t("landing.previewDemo", " — demo showcase data")}
                .
              </p>
            ) : (
              <p className="mt-6 text-sm text-amber-800/90">
                {t(
                  "landing.previewEmpty",
                  "Run scripts/seed-demo-showcase.sql and set LANDING_SHOWCASE_BRANCH_ID to see live previews here."
                )}
              </p>
            )}
          </div>
          <LandingHeroDevices showcase={showcase} />
        </div>
      </LandingSection>

      <LandingSection id="features" className="scroll-mt-16 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-10">
          <LandingSectionHeader
            eyebrow={t("landing.featuresEyebrow", "Every screen")}
            title={t("landing.featuresTitle", "Desktop, tablet, mobile, and waiting-room TV")}
            description={t(
              "landing.featuresDescription",
              "Same queue and patient data — optimized layouts for admin desks, kiosk tablets, and the display board."
            )}
            align="center"
          />
          <LandingMultiDeviceRow showcase={showcase} />
        </div>
      </LandingSection>

      <LandingWorkflowSection showcase={showcase} />

      <LandingSection tone="inset" className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
            {t("landing.ctaBottomTitle", "Ready to run your clinic on one system?")}
          </h2>
          <p className="mt-3 text-base text-neutral-600">
            {t(
              "landing.ctaBottomSubtitle",
              "Start a free trial, request a quote for multi-branch groups, or sign in with your staff account."
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={cn(primaryCtaClassName, "px-8")}>
              {t("marketing.startTrial", "Start free trial")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Button size="lg" variant="outline" className="h-11" asChild>
              <Link href="/pricing">{t("landing.viewPricing", "View pricing")}</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            {t("landing.alreadyUsing", "Already using dentali.?")}{" "}
            <Link href="/login" className="font-medium text-primary-600 hover:underline">
              {t("marketing.signIn", "Staff sign in")}
            </Link>
            {" · "}
            <Link href="/kiosk" className="font-medium text-primary-600 hover:underline">
              {t("landing.kioskCheckIn", "Kiosk check-in")}
            </Link>
          </p>
        </div>
      </LandingSection>
    </>
  )
}
