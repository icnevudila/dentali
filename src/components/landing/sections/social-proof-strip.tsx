"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { SOCIAL_HIGHLIGHTS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function SocialProofStrip() {
  const { locale } = useLocale()

  return (
    <section className="border-y border-neutral-100 bg-neutral-50/50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" delay={100}>
          <div className="grid grid-cols-2 items-center justify-items-center gap-6 md:grid-cols-4 md:gap-8">
            {SOCIAL_HIGHLIGHTS.map((item, idx) => (
              <div key={idx} className="space-y-1 text-center">
                <div className="text-base font-extrabold tracking-tight text-neutral-900 sm:text-lg">
                  {lt(item.label, locale)}
                </div>
                <div className="text-xs font-medium text-neutral-500 sm:text-sm">
                  {lt(item.detail, locale)}
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
