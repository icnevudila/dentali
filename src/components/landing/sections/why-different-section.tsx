"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { USP_CARDS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

// Custom theme mapping for each card to create beautiful dynamic colors
const CARD_THEMES = [
  { bg: "bg-blue-50/50", text: "text-blue-600", border: "hover:border-blue-200", glow: "hover:shadow-blue-500/5", iconBg: "bg-blue-50 text-blue-600" },
  { bg: "bg-teal-50/50", text: "text-teal-600", border: "hover:border-teal-200", glow: "hover:shadow-teal-500/5", iconBg: "bg-teal-50 text-teal-600" },
  { bg: "bg-purple-50/50", text: "text-purple-600", border: "hover:border-purple-200", glow: "hover:shadow-purple-500/5", iconBg: "bg-purple-50 text-purple-600" },
  { bg: "bg-amber-50/50", text: "text-amber-600", border: "hover:border-amber-200", glow: "hover:shadow-amber-500/5", iconBg: "bg-amber-50 text-amber-600" },
  { bg: "bg-emerald-50/50", text: "text-emerald-600", border: "hover:border-emerald-200", glow: "hover:shadow-emerald-500/5", iconBg: "bg-emerald-50 text-emerald-600" },
  { bg: "bg-rose-50/50", text: "text-rose-600", border: "hover:border-rose-200", glow: "hover:shadow-rose-500/5", iconBg: "bg-rose-50 text-rose-600" },
]

export function WhyDifferentSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-neutral-50/60 py-20 sm:py-28 border-y border-neutral-100">
      {/* Subtle background blur meshes */}
      <div className="absolute top-1/3 right-10 w-72 h-72 bg-teal-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              ✨ {lt(LANDING_HEADINGS.whyDifferent.eyebrow, locale)}
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

        {/* USPs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {USP_CARDS.map((card, idx) => {
            const IconComponent = card.icon
            const theme = CARD_THEMES[idx % CARD_THEMES.length]

            return (
              <ScrollReveal 
                key={idx} 
                direction="up" 
                delay={80 * idx}
                className={cn(
                  "landing-usp-card relative flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                  theme.border,
                  theme.glow
                )}
              >
                <div className="space-y-5">
                  {/* Icon Container with Custom Theming */}
                  <div className={cn(
                    "inline-flex items-center justify-center rounded-xl p-3 shadow-sm transition duration-300",
                    theme.iconBg
                  )}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                      {lt(card.title, locale)}
                    </h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      {lt(card.description, locale)}
                    </p>
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
