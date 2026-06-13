"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { PROBLEM_CARDS, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { FileWarning, CalendarX, AlertTriangle, Unlink, AlertCircle } from "lucide-react"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const PROBLEM_ICONS = [
  FileWarning, // Paper charts lost
  CalendarX,   // Double-booked
  AlertTriangle, // HMO stuck
  Unlink       // Apps don't talk
]

export function ProblemSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-neutral-50 to-white py-20 sm:py-28 text-neutral-900 border-b border-neutral-100">
      {/* Absolute Decorative Background Elements (Light/Soft glow) */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-amber-100/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {lt(LANDING_HEADINGS.problem.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-900">
              {lt(LANDING_HEADINGS.problem.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
              {lt(LANDING_HEADINGS.problem.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* Dual Layout: Left (Chaos Mockup) | Right ( Glowing Problem Cards ) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Clinic Chaos Mockup Panel */}
          <div className="lg:col-span-5 relative">
            <ScrollReveal direction="left" delay={200}>
              <div className="relative mx-auto max-w-[420px] rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-xl backdrop-blur-xl space-y-5">
                <div className="absolute -top-3 -right-3 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-red-500/20 animate-pulse">
                  ⚠️ {locale === "tr" ? "Yüksek Stres" : "High Stress"}
                </div>
                
                {/* Simulated Header */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    {locale === "tr" ? "Kayıp Verimlilik" : "Lost Efficiency"}
                  </span>
                </div>

                {/* Simulated Alert Messages */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl bg-red-50/50 border border-red-100 p-3">
                    <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-neutral-800">
                        {locale === "tr" ? "Randevu Çakışması Algılandı" : "Appointment Conflict Detected"}
                      </p>
                      <p className="text-[10px] text-neutral-500">Dr. Cruz - Chair 2 - 10:00 AM</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-amber-50/50 border border-amber-100 p-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-neutral-800">
                        {locale === "tr" ? "HMO Onayı Beklemede (14 Gün)" : "HMO Claims Pending (14 Days)"}
                      </p>
                      <p className="text-[10px] text-neutral-500">{locale === "tr" ? "Yanıt alınamadı" : "No response received"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-neutral-50/80 border border-neutral-100 p-3 opacity-60">
                    <div className="h-2 w-2 rounded-full bg-neutral-400 mt-1.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-600">
                        {locale === "tr" ? "Kayıp Hasta Kartı: Ahmet Y." : "Missing Patient File: John Doe"}
                      </p>
                      <p className="text-[10px] text-neutral-400">{locale === "tr" ? "Dolap 3'te bulunamadı" : "Not found in cabinet 3"}</p>
                    </div>
                  </div>
                </div>

                {/* Stat block */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 text-center shadow-inner">
                    <span className="block text-2xl font-black text-red-500">-25%</span>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {locale === "tr" ? "Doktor Zamanı" : "Doctor Productivity"}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 text-center shadow-inner">
                    <span className="block text-2xl font-black text-amber-600">3.5x</span>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {locale === "tr" ? "Telefon Yoğunluğu" : "Phone Call Burden"}
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: Problem Cards */}
          <div className="lg:col-span-7 space-y-4">
            {PROBLEM_CARDS.map((card, idx) => {
              const Icon = PROBLEM_ICONS[idx] || AlertCircle

              return (
                <ScrollReveal 
                  key={idx} 
                  direction="right" 
                  delay={100 * idx}
                  className="group relative rounded-2xl border border-neutral-200 bg-white p-5 flex items-center gap-4 transition-all duration-300 hover:border-red-200 hover:bg-red-50/10 hover:shadow-lg hover:-translate-y-0.5"
                >
                  {/* Icon Container with glowing ring */}
                  <div className="relative flex items-center justify-center h-12 w-12 rounded-xl bg-red-50 border border-red-100 text-red-500 group-hover:scale-110 transition duration-300">
                    <div className="absolute inset-0 rounded-xl bg-red-500/5 blur opacity-0 group-hover:opacity-100 transition duration-300" />
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  {/* Card content */}
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-semibold text-neutral-800 leading-relaxed group-hover:text-neutral-900 transition duration-200">
                      {lt(card.text, locale)}
                    </p>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>

        </div>

        {/* Transition to solution */}
        <div className="text-center pt-16 mt-8">
          <ScrollReveal direction="scale" delay={300} className="inline-block">
            <p className="text-sm sm:text-base font-bold text-teal-600 mb-6 uppercase tracking-widest bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              {lt(LANDING_HEADINGS.problem.transition, locale)}
            </p>
            <div className="h-[2px] w-48 mx-auto bg-gradient-to-r from-transparent via-teal-500 to-transparent opacity-40" />
          </ScrollReveal>
        </div>

      </div>
    </section>
  )
}
