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
    <section className="relative overflow-hidden py-20 bg-neutral-900 text-white">
      {/* Background Glow Effect */}
      <div className="landing-cta-bg absolute inset-0 pointer-events-none opacity-40" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-8 z-10">
        
        <ScrollReveal direction="up" delay={100} className="space-y-4">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {lt(LANDING_HEADINGS.finalCta.title, locale)}
          </h2>
          <p className="mx-auto max-w-xl text-neutral-400 text-lg sm:text-xl">
            {lt(LANDING_HEADINGS.finalCta.subtitle, locale)}
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={250} className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="landing-cta-button inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100 transition duration-200 active:scale-98"
          >
            {lt(LANDING_HEADINGS.finalCta.ctaPrimary, locale)}
          </Link>
          <Link
            href="/quote"
            className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition duration-200 active:scale-98"
          >
            {lt(LANDING_HEADINGS.finalCta.ctaSecondary, locale)}
          </Link>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={400} className="pt-4">
          <p className="text-sm text-neutral-500">
            {lt(LANDING_HEADINGS.finalCta.loginPrefix, locale)}{" "}
            <Link href="/login" className="text-white hover:underline font-medium">
              {lt(LANDING_HEADINGS.finalCta.loginLink, locale)}
            </Link>{" "}
            ·{" "}
            <Link href="/kiosk" className="text-white hover:underline font-medium">
              {lt(LANDING_HEADINGS.finalCta.kioskLink, locale)}
            </Link>
          </p>
        </ScrollReveal>

      </div>
    </section>
  )
}
