"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function FinalCta() {
  const { locale } = useLocale()

  return (
    <section
      data-landing-conversion-zone
      className="relative overflow-hidden border-t border-primary-500/20 bg-gradient-to-br from-primary-600 via-teal-600 to-emerald-600 py-20 text-white"
    >
      <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="landing-hero-orb landing-hero-orb-a pointer-events-none absolute -right-20 top-0 opacity-30" />
      <div className="landing-hero-orb landing-hero-orb-b pointer-events-none absolute -left-16 bottom-0 opacity-25" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-8 px-4 text-center sm:px-6 lg:px-8">
        <ScrollReveal direction="up" delay={100} className="space-y-4">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {lt(LANDING_HEADINGS.finalCta.title, locale)}
          </h2>
          <p className="mx-auto max-w-xl text-lg text-white/85 sm:text-xl">
            {lt(LANDING_HEADINGS.finalCta.subtitle, locale)}
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={250} className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-lg shadow-black/10 transition duration-200 hover:bg-primary-50 active:scale-[0.98]"
          >
            {lt(LANDING_HEADINGS.finalCta.ctaPrimary, locale)}
          </Link>
          <Link
            href="/quote"
            className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition duration-200 hover:bg-white/20 active:scale-[0.98]"
          >
            {lt(LANDING_HEADINGS.finalCta.ctaSecondary, locale)}
          </Link>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={400} className="pt-2">
          <p className="text-sm text-white/70">
            {lt(LANDING_HEADINGS.finalCta.loginPrefix, locale)}{" "}
            <Link href="/login" className="font-medium text-white underline-offset-4 hover:underline">
              {lt(LANDING_HEADINGS.finalCta.loginLink, locale)}
            </Link>{" "}
            ·{" "}
            <Link href="/kiosk" className="font-medium text-white underline-offset-4 hover:underline">
              {lt(LANDING_HEADINGS.finalCta.kioskLink, locale)}
            </Link>
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
