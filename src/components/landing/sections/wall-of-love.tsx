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

  return (
    <section className="relative overflow-hidden bg-neutral-50/30 py-16 sm:py-24 border-y border-neutral-100" id="testimonials">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
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

        {/* Masonry Grid layout using custom CSS class 'landing-masonry' */}
        <ScrollReveal direction="up" delay={200} className="landing-masonry gap-6">
          {TESTIMONIALS.map((testimonial, idx) => (
            <div key={idx} className="break-inside-avoid mb-6">
              <TestimonialCard testimonial={testimonial} locale={locale === "tr" ? "tr" : "en"} />
            </div>
          ))}
        </ScrollReveal>

      </div>
    </section>
  )
}
