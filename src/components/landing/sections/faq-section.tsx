"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { FAQ_ITEMS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { AccordionItem } from "@/components/landing/ui/accordion-item"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function FaqSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24" id="faq">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-primary-600">
              {lt(LANDING_HEADINGS.faq.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.faq.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.faq.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* FAQ Accordion List */}
        <ScrollReveal direction="up" delay={200} className="border-t border-neutral-200 divide-y divide-neutral-200">
          {FAQ_ITEMS.map((item, idx) => (
            <AccordionItem
              key={idx}
              question={lt(item.question, locale)}
              answer={lt(item.answer, locale)}
              defaultOpen={idx === 0} // İlk soruyu açık gösterelim
            />
          ))}
        </ScrollReveal>

      </div>
    </section>
  )
}
