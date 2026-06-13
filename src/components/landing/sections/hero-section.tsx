"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function HeroSection() {
  const { locale } = useLocale()

  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-16 md:pt-32 md:pb-24">
      {/* Background Radial Gradient */}
      <div className="landing-hero-bg absolute inset-0 pointer-events-none opacity-60" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 items-center">
          
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left z-10">
            <ScrollReveal direction="up" delay={100}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50/50 px-3 py-1 text-xs font-semibold text-primary-700">
                🇵🇭 {lt(LANDING_HEADINGS.hero.eyebrow, locale)}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={200}>
              <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                <span className="block">{lt(LANDING_HEADINGS.hero.title1, locale)}</span>
                <span className="block bg-gradient-to-r from-primary-600 to-teal-500 bg-clip-text text-transparent">
                  {lt(LANDING_HEADINGS.hero.title2, locale)}
                </span>
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={300}>
              <p className="mx-auto lg:mx-0 max-w-md text-base text-neutral-600 sm:text-lg md:text-xl lg:text-lg">
                {lt(LANDING_HEADINGS.hero.subtitle, locale)}
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={400}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition duration-200 active:scale-98"
                >
                  {lt(LANDING_HEADINGS.hero.ctaPrimary, locale)}
                </Link>
                <Link
                  href="/quote"
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-base font-semibold text-neutral-700 hover:bg-neutral-50 transition duration-200 active:scale-98"
                >
                  {lt(LANDING_HEADINGS.hero.ctaSecondary, locale)}
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={500}>
              <div className="flex items-center justify-center lg:justify-start gap-2 text-xs font-medium text-neutral-500 pt-2">
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {lt(LANDING_HEADINGS.hero.trustLine, locale)}
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: 3D perspective screenshot mockup slideshow */}
          <div className="lg:col-span-6 relative flex justify-center lg:justify-end">
            <ScrollReveal direction="scale" delay={300} className="w-full max-w-lg lg:max-w-none">
              <div className="landing-hero-screenshot w-full aspect-[1440/836] relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary-500 to-teal-500 opacity-20 blur-xl" />
                
                {/* Slideshow Container */}
                <div className="relative w-full h-full rounded-xl border border-neutral-200/80 shadow-2xl bg-white overflow-hidden">
                  <HeroSlideshow />
                </div>
              </div>
            </ScrollReveal>
          </div>

        </div>
      </div>
    </section>
  )
}

const HERO_SLIDES = [
  { src: "/screenshots/all-pages/dashboard/desktop.png", alt: "dentali dashboard" },
  { src: "/screenshots/all-pages/patient-chart/desktop.png", alt: "dentali dental chart" },
  { src: "/screenshots/all-pages/appointments/desktop.png", alt: "dentali scheduler" },
  { src: "/screenshots/all-pages/patient-treatment-plan/desktop.png", alt: "dentali treatment plan" }
]

function HeroSlideshow() {
  const [activeIdx, setActiveIdx] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 4500) // Her 4.5 saniyede bir değişim
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full h-full">
      {HERO_SLIDES.map((slide, idx) => (
        <div
          key={slide.src}
          className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
            idx === activeIdx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            className="object-cover object-top"
            priority={idx === 0}
          />
        </div>
      ))}
    </div>
  )
}
