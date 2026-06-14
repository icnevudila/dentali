"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { USP_CARDS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const CARD_THEMES = [
  "border-blue-100 bg-blue-50/40",
  "border-teal-100 bg-teal-50/40",
  "border-purple-100 bg-purple-50/40",
  "border-amber-100 bg-amber-50/40",
  "border-emerald-100 bg-emerald-50/40",
  "border-rose-100 bg-rose-50/40",
]

const ICON_THEMES = [
  "bg-blue-100 text-blue-600",
  "bg-teal-100 text-teal-600",
  "bg-purple-100 text-purple-600",
  "bg-amber-100 text-amber-600",
  "bg-emerald-100 text-emerald-600",
  "bg-rose-100 text-rose-600",
]

export function WhyDifferentSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-neutral-50/80 py-20 sm:py-28 border-y border-neutral-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              {lt(LANDING_HEADINGS.whyDifferent.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-5xl">
              {lt(LANDING_HEADINGS.whyDifferent.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500 max-w-xl mx-auto">
              {lt(LANDING_HEADINGS.whyDifferent.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USP_CARDS.map((card, idx) => {
            const Icon = card.icon
            return (
              <ScrollReveal key={idx} direction="up" delay={60 * idx}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    CARD_THEMES[idx]
                  )}
                >
                  <div className={cn("mb-4 inline-flex w-fit rounded-xl p-2.5", ICON_THEMES[idx])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">{lt(card.title, locale)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{lt(card.description, locale)}</p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
