"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { USP_CARDS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import * as Icons from "lucide-react"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function WhyDifferentSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-neutral-50/50 py-16 sm:py-24 border-y border-neutral-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-primary-600">
              {lt(LANDING_HEADINGS.whyDifferent.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.whyDifferent.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.whyDifferent.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* USPs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {USP_CARDS.map((card, idx) => {
            // Dinamik olarak Lucide icon bileşenini alıyoruz
            const IconComponent = (Icons as any)[card.icon] || Icons.HelpCircle

            return (
              <ScrollReveal 
                key={idx} 
                direction="up" 
                delay={100 * idx}
                className="landing-usp-card relative flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center rounded-xl bg-primary-50 p-3 text-primary-600">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-neutral-900">{lt(card.title, locale)}</h3>
                    <p className="text-sm text-neutral-600 leading-relaxed">{lt(card.desc, locale)}</p>
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

      </div>
    </section>
  )
}
