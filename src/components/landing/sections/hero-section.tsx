"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HERO_PAGES } from "@/components/landing/data/landing-assets"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

function HeroSlideshow({ activeIdx, locale }: { activeIdx: number; locale: string }) {
  return (
    <div className="landing-zoom-clip relative aspect-[16/10] w-full">
      {LANDING_HERO_PAGES.map((page, idx) => (
        <div
          key={page.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            idx === activeIdx ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
          }`}
        >
          <div
            key={idx === activeIdx ? `active-${activeIdx}` : `idle-${idx}`}
            className={cn(
              "absolute inset-0",
              idx === activeIdx && "landing-zoom-ken-burns"
            )}
          >
            <Image
              src={page.desktop}
              alt={lt(page.label, locale)}
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 720px"
              priority={idx === 0}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HeroSection() {
  const { locale } = useLocale()
  const [activeIdx, setActiveIdx] = React.useState(0)
  const pageCount = LANDING_HERO_PAGES.length

  const goTo = React.useCallback(
    (idx: number) => {
      setActiveIdx((idx + pageCount) % pageCount)
    },
    [pageCount]
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % pageCount)
    }, 5000)
    return () => clearInterval(timer)
  }, [pageCount])

  const activePage = LANDING_HERO_PAGES[activeIdx]

  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-14 md:pt-28 md:pb-20">
      <div className="landing-hero-bg pointer-events-none absolute inset-0 opacity-70" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="z-10 space-y-6 text-center lg:col-span-5 lg:text-left xl:col-span-5">
            <ScrollReveal direction="up" delay={120}>
              <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl md:text-[3.25rem] md:leading-[1.08] xl:text-6xl xl:leading-[1.05]">
                <span className="block">{lt(LANDING_HEADINGS.hero.title1, locale)}</span>
                <span className="mt-1 block bg-gradient-to-r from-primary-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                  {lt(LANDING_HEADINGS.hero.title2, locale)}
                </span>
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={200}>
              <p className="mx-auto max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
                {lt(LANDING_HEADINGS.hero.subtitle, locale)}
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={320}>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-700"
                >
                  {lt(LANDING_HEADINGS.hero.ctaPrimary, locale)}
                </Link>
                <Link
                  href="/quote"
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-7 py-3.5 text-base font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  {lt(LANDING_HEADINGS.hero.ctaSecondary, locale)}
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={400}>
              <p className="flex items-center justify-center gap-2 text-xs font-medium text-neutral-500 lg:justify-start">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {lt(LANDING_HEADINGS.hero.trustLine, locale)}
              </p>
            </ScrollReveal>
          </div>

          <div className="lg:col-span-7 xl:col-span-7">
            <ScrollReveal direction="scale" delay={200} className="w-full">
              <div className="landing-hero-screenshot relative mx-auto w-full max-w-2xl lg:max-w-none">
                <div className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-primary-400/30 via-teal-400/20 to-transparent opacity-80 blur-2xl" />

                <div className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-900 p-2 shadow-[0_32px_64px_-16px_rgba(15,23,42,0.35)]">
                  <div className="mb-2 flex items-center gap-1.5 px-1" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 h-5 flex-1 rounded-md bg-white/10" />
                    <span className="hidden h-5 w-24 rounded-md bg-white/5 sm:block" />
                  </div>

                  <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
                    <HeroSlideshow activeIdx={activeIdx} locale={locale} />
                  </div>
                </div>

                <div className="relative mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(activeIdx - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50"
                      aria-label={locale === "tr" ? "Önceki ekran" : "Previous screen"}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[8rem] text-center text-sm font-semibold text-neutral-800">
                      {lt(activePage.label, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => goTo(activeIdx + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50"
                      aria-label={locale === "tr" ? "Sonraki ekran" : "Next screen"}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {LANDING_HERO_PAGES.map((page, idx) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => goTo(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === activeIdx ? "w-7 bg-primary-600" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                        }`}
                        aria-label={lt(page.label, locale)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  )
}
