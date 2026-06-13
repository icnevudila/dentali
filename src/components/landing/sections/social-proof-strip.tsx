"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { SOCIAL_METRICS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { AnimatedCounter } from "@/components/landing/ui/animated-counter"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function SocialProofStrip() {
  const { locale } = useLocale()

  return (
    <section className="border-y border-neutral-100 bg-neutral-50/50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" delay={100}>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 items-center justify-items-center">
            {SOCIAL_METRICS.map((metric, idx) => (
              <div key={idx} className="text-center space-y-1">
                <div className="text-3xl font-extrabold text-neutral-900 tracking-tight flex items-center justify-center">
                  <AnimatedCounter
                    value={metric.value}
                    suffix={metric.suffix}
                    duration={2000}
                  />
                </div>
                <div className="text-sm font-medium text-neutral-500">
                  {lt(metric.label, locale)}
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
