"use client"

import * as React from "react"
import Image from "next/image"
import { useLocale } from "@/hooks/use-locale"
import { FEATURES, LANDING_HEADINGS, type FeatureItem, type LandingText } from "@/components/landing/data/landing-data"
import { LANDING_VIDEOS } from "@/components/landing/data/landing-assets"
import { LandingVideo } from "@/components/landing/ui/landing-video"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

function featureImageClass(featureId: string) {
  return featureId === "chart"
    ? "object-contain object-center bg-white"
    : "object-cover object-top"
}

function FeaturePreview({
  feature,
  locale,
  active,
  animate,
  priority,
}: {
  feature: FeatureItem
  locale: string
  active: boolean
  animate?: boolean
  priority?: boolean
}) {
  const video = feature.videoKey ? LANDING_VIDEOS[feature.videoKey] : null

  if (video) {
    return (
      <div className="landing-video-safe absolute inset-0 overflow-hidden bg-white">
        <LandingVideo
          src={video.src}
          poster={video.poster}
          label={video.alt}
          active={active}
          className={featureImageClass(feature.id)}
        />
      </div>
    )
  }

  return (
    <div className={cn("absolute inset-0", animate && active && "landing-zoom-ken-burns-slow")}>
      <Image
        src={feature.screenshot}
        alt={lt(feature.title, locale)}
        fill
        className={featureImageClass(feature.id)}
        priority={priority}
      />
    </div>
  )
}

export function FeaturesShowcase() {
  const { locale } = useLocale()
  const [activeTab, setActiveTab] = React.useState(0)
  const refs = React.useRef<(HTMLDivElement | null)[]>([])

  React.useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-25% 0px -55% 0px",
      threshold: 0.1,
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
    const isDesktop = window.innerWidth >= 1024
    if (isDesktop && refs.current[idx]) {
      refs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" })
    } else if (refs.current[idx]) {
      refs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  React.useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash
      if (!hash.startsWith("#features-")) return
      const id = hash.replace("#features-", "")
      const idx = FEATURES.findIndex((f) => f.id === id)
      if (idx >= 0) {
        setActiveTab(idx)
        requestAnimationFrame(() => {
          refs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" })
        })
      }
    }
    syncFromHash()
    window.addEventListener("hashchange", syncFromHash)
    return () => window.removeEventListener("hashchange", syncFromHash)
  }, [])

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 space-y-4 lg:max-h-[70vh] lg:overflow-y-auto pr-2 landing-features-tabs">
            {FEATURES.map((feature, idx) => {
              const IconComponent = feature.icon
              const isActive = activeTab === idx

              return (
                <div
                  key={feature.id}
                  id={`features-${feature.id}`}
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
                        {lt(feature.description, locale)}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <div className="landing-zoom-clip relative mt-4 block aspect-[16/10] w-full overflow-hidden rounded-xl border border-neutral-200/80 shadow-md lg:hidden">
                      <FeaturePreview feature={feature} locale={locale} active priority />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="sticky top-28 hidden lg:col-span-7 lg:block">
            <div className="landing-zoom-clip relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-xl">
              {FEATURES.map((feature, idx) => (
                <div
                  key={feature.id}
                  className={cn(
                    "landing-feature-image absolute inset-0 h-full w-full",
                    activeTab === idx ? "pointer-events-auto z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                  )}
                  data-visible={activeTab === idx ? "true" : "false"}
                >
                  <FeaturePreview
                    feature={feature}
                    locale={locale}
                    active={activeTab === idx}
                    animate
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
