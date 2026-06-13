"use client"

import * as React from "react"
import Image from "next/image"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function MultiDeviceSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-primary-600">
              {lt(LANDING_HEADINGS.multiDevice.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.multiDevice.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.multiDevice.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* Device Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-end">
          
          {/* Tablet View */}
          <ScrollReveal direction="left" delay={100} className="space-y-4 text-center">
            <div className="relative mx-auto max-w-[280px] sm:max-w-[360px] aspect-[4/3] rounded-[24px] border-8 border-neutral-800 bg-neutral-900 p-2 shadow-2xl overflow-hidden">
              <div className="relative w-full h-full rounded-[14px] overflow-hidden bg-white">
                <Image
                  src="/screenshots/all-pages/kiosk/desktop.png"
                  alt="Tablet App View"
                  fill
                  className="object-cover object-top"
                />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-neutral-900">
                {lt(LANDING_HEADINGS.multiDevice.tabletLabel, locale)}
              </h3>
              <p className="text-xs text-neutral-500">iPad & Tablet Optimized</p>
            </div>
          </ScrollReveal>

          {/* Desktop View */}
          <ScrollReveal direction="up" delay={200} className="space-y-4 text-center order-first lg:order-none lg:col-span-1 md:col-span-2">
            <div className="relative mx-auto max-w-[580px] rounded-2xl border-4 border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl overflow-hidden aspect-[16/10]">
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-white">
                <Image
                  src="/screenshots/all-pages/dashboard/desktop.png"
                  alt="Desktop App View"
                  fill
                  className="object-cover object-top"
                />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-neutral-900">
                {lt(LANDING_HEADINGS.multiDevice.desktopLabel, locale)}
              </h3>
              <p className="text-xs text-neutral-500">Desktop & Laptop App</p>
            </div>
          </ScrollReveal>

          {/* Mobile View */}
          <ScrollReveal direction="right" delay={300} className="space-y-4 text-center">
            <div className="relative mx-auto max-w-[190px] sm:max-w-[220px] aspect-[9/19] rounded-[36px] border-8 border-neutral-800 bg-neutral-900 p-2.5 shadow-2xl overflow-hidden">
              {/* Dynamic Island Mockup */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-neutral-850 rounded-full z-20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-neutral-900 mr-2" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/30" />
              </div>
              <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-white">
                <Image
                  src="/screenshots/all-pages/patients/mobile.png"
                  alt="Mobile App View"
                  fill
                  className="object-cover object-top"
                />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-neutral-900">
                {lt(LANDING_HEADINGS.multiDevice.mobileLabel, locale)}
              </h3>
              <p className="text-xs text-neutral-500">iOS & Android Responsive</p>
            </div>
          </ScrollReveal>

        </div>

      </div>
    </section>
  )
}
