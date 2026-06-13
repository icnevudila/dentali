"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { PROBLEM_CARDS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function ProblemSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-red-500">
              {lt(LANDING_HEADINGS.problem.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.problem.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.problem.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {PROBLEM_CARDS.map((card, idx) => (
            <ScrollReveal 
              key={idx} 
              direction={idx % 2 === 0 ? "left" : "right"} 
              delay={150 * idx}
              className="landing-problem-card border border-red-100/50 bg-red-50/20 p-6 rounded-2xl flex gap-4 transition duration-300 hover:border-red-200/80 hover:bg-red-50/40 items-center"
            >
              <div className="text-3xl select-none">{card.icon}</div>
              <div>
                <p className="text-base font-medium text-neutral-800 leading-relaxed">{lt(card.text, locale)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Transition to solution */}
        <div className="text-center pt-4">
          <ScrollReveal direction="scale" delay={300} className="inline-block">
            <p className="text-lg font-bold text-primary-600 mb-6 uppercase tracking-wider">
              {lt(LANDING_HEADINGS.problem.transition, locale)}
            </p>
            <div className="landing-gradient-divider h-[2px] w-48 mx-auto" />
          </ScrollReveal>
        </div>

      </div>
    </section>
  )
}
