"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { TESTIMONIALS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { TestimonialCard } from "@/components/landing/ui/testimonial-card"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function WallOfLove() {
  const { locale } = useLocale()
  const lang = locale === "tr" ? "tr" : "en"
  const loop = [...TESTIMONIALS, ...TESTIMONIALS]

  return (
    <section className="relative overflow-hidden bg-neutral-50/30 py-16 sm:py-24 border-y border-neutral-100" id="testimonials">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-primary-600">
              {lt(LANDING_HEADINGS.testimonials.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.testimonials.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.testimonials.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal direction="up" delay={200}>
          <div className="landing-testimonial-marquee relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-neutral-50/95 to-transparent sm:w-24" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-neutral-50/95 to-transparent sm:w-24" />

            <div className="landing-testimonial-track">
              {loop.map((testimonial, idx) => (
                <TestimonialCard
                  key={`${testimonial.name}-${idx}`}
                  testimonial={testimonial}
                  locale={lang}
                  className="landing-testimonial-card w-[min(100%,22rem)] shrink-0 sm:w-[24rem]"
                />
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
