"use client"

import * as React from "react"
import Image from "next/image"
import { useLocale } from "@/hooks/use-locale"
import { TIMELINE_STEPS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function DayInClinic() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-neutral-50/50 py-16 sm:py-24 border-y border-neutral-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-primary-600">
              {lt(LANDING_HEADINGS.dayInClinic.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.dayInClinic.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.dayInClinic.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* Timeline Container */}
        <div className="relative landing-timeline mx-auto max-w-5xl">
          {/* Vertical central line (desktop) or left line (mobile) */}
          <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-[2px] bg-neutral-200 -translate-x-1/2 z-0" />
          
          <div className="space-y-12 md:space-y-20 relative z-10">
            {TIMELINE_STEPS.map((step, idx) => {
              const isEven = idx % 2 === 0
              
              return (
                <div 
                  key={idx} 
                  className={`flex flex-col md:flex-row items-start md:items-center ${
                    isEven ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Left or Right Content Panel */}
                  <div className="w-full md:w-1/2 pl-12 md:pl-0 md:px-12">
                    <ScrollReveal 
                      direction={isEven ? "left" : "right"} 
                      delay={100}
                      className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm space-y-4 hover:shadow-md transition-shadow duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center rounded-full bg-primary-500 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-primary-500/20">
                          {step.time}
                        </span>
                        <h3 className="text-lg font-bold text-neutral-900">
                          {lt(step.title, locale)}
                        </h3>
                      </div>
                      
                      <p className="text-sm text-neutral-600 leading-relaxed">
                        {lt(step.description, locale)}
                      </p>

                      {step.screenshot && (
                        <div className="landing-zoom-hover landing-zoom-clip relative aspect-[16/10] max-w-full overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 shadow-inner">
                          <div className="landing-zoom-hover-target absolute inset-0">
                            <Image
                              src={step.screenshot}
                              alt={lt(step.title, locale)}
                              fill
                              className="object-cover object-top"
                            />
                          </div>
                        </div>
                      )}
                    </ScrollReveal>
                  </div>

                  {/* Timeline dot identifier */}
                  <div className="absolute left-[20px] md:left-1/2 -translate-x-1/2 flex items-center justify-center h-8 w-8 rounded-full border-4 border-neutral-50 bg-primary-500 text-white z-20 shadow-sm landing-timeline-node">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>

                  {/* Empty spacer on the opposite side of desktop */}
                  <div className="hidden md:block w-1/2" />
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </section>
  )
}
