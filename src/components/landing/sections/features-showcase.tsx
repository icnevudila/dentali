"use client"

import * as React from "react"
import Image from "next/image"
import { useLocale } from "@/hooks/use-locale"
import { FEATURES, LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import * as Icons from "lucide-react"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function FeaturesShowcase() {
  const { locale } = useLocale()
  const [activeTab, setActiveTab] = React.useState(0)
  const refs = React.useRef<(HTMLDivElement | null)[]>([])

  // Scroll ile tetiklenen tab değişimi (Scroll-driven Accordion)
  React.useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-25% 0px -55% 0px", // Ekranın ortasındaki alanları yakalamak için
      threshold: 0.1
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute("data-index"))
          if (!isNaN(index)) {
            setActiveTab(index)
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)
    
    // Sadece masaüstü ekran genişliğinde scroll takibi yapalım
    const isDesktop = window.innerWidth >= 1024
    if (isDesktop) {
      refs.current.forEach((ref) => {
        if (ref) observer.observe(ref)
      })
    }

    return () => observer.disconnect()
  }, [])

  const handleTabClick = (idx: number) => {
    setActiveTab(idx)
    // Masaüstünde tıklandığında ilgili bardağa kaydır
    const isDesktop = window.innerWidth >= 1024
    if (isDesktop && refs.current[idx]) {
      refs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="text-sm font-semibold tracking-wider uppercase text-primary-600">
              {lt(LANDING_HEADINGS.features.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
              {lt(LANDING_HEADINGS.features.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.features.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        {/* Dynamic Showcase Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Side: Accordion Tabs (Scroll Target) */}
          <div className="lg:col-span-5 space-y-4 lg:max-h-[70vh] lg:overflow-y-auto pr-2 landing-features-tabs">
            {FEATURES.map((feature, idx) => {
              const IconComponent = (Icons as any)[feature.icon] || Icons.CheckCircle2
              const isActive = activeTab === idx

              return (
                <div
                  key={idx}
                  ref={(el) => { refs.current[idx] = el }}
                  data-index={idx}
                  onClick={() => handleTabClick(idx)}
                  className={`landing-feature-tab p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    isActive
                      ? "border-primary-100 bg-primary-50/50 shadow-sm"
                      : "border-neutral-100 bg-white hover:bg-neutral-50"
                  }`}
                  data-active={isActive ? "true" : "false"}
                >
                  <div className="flex gap-4">
                    <div className={`p-2 rounded-xl transition-colors duration-300 ${
                      isActive ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-500"
                    }`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={`font-bold text-lg transition-colors duration-300 ${
                        isActive ? "text-neutral-900" : "text-neutral-700"
                      }`}>
                        {lt(feature.title, locale)}
                      </h3>
                      <p className="text-sm text-neutral-600 leading-relaxed">
                        {lt(feature.desc, locale)}
                      </p>
                    </div>
                  </div>

                  {/* Mobil Görünüm İçin Ekran Görüntüsü (Sadece aktif olanın altında açılır akordiyon şeklinde) */}
                  {isActive && (
                    <div className="mt-4 block lg:hidden w-full overflow-hidden rounded-xl border border-neutral-200/80 shadow-md">
                      <Image
                        src={`/screenshots/all-pages/${feature.screenshot}`}
                        alt={lt(feature.title, locale)}
                        width={1440}
                        height={836}
                        className="w-full h-auto"
                        priority
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right Side: Sticky Interactive Screenshot (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-7 sticky top-28">
            <div className="relative w-full aspect-[16/10] rounded-2xl border border-neutral-200 bg-neutral-100 shadow-xl overflow-hidden">
              {FEATURES.map((feature, idx) => (
                <div
                  key={idx}
                  className={`landing-feature-image absolute inset-0 w-full h-full transition-opacity duration-500 ${
                    activeTab === idx ? "opacity-100 pointer-events-auto z-10" : "opacity-0 pointer-events-none z-0"
                  }`}
                  data-visible={activeTab === idx ? "true" : "false"}
                >
                  <Image
                    src={`/screenshots/all-pages/${feature.screenshot}`}
                    alt={lt(feature.title, locale)}
                    fill
                    className="object-cover object-top"
                    priority={idx === 0}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
