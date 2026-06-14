"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, FileWarning, CalendarX, AlertTriangle, Unlink } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import {
  PROBLEM_CARDS,
  PROBLEM_SOLUTIONS,
  LANDING_HEADINGS,
  type LandingText,
} from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const PROBLEM_ICONS = [FileWarning, CalendarX, AlertTriangle, Unlink]

function SolutionScreenshot({ activeIdx, locale }: { activeIdx: number; locale: string }) {
  const solution = PROBLEM_SOLUTIONS[activeIdx]

  return (
    <div className="landing-hero-screenshot relative w-full">
      <div className="pointer-events-none absolute -inset-2 rounded-[1.5rem] bg-gradient-to-br from-primary-200/50 via-teal-100/40 to-transparent opacity-90 blur-xl" />

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-100 p-2 shadow-[0_24px_48px_-20px_rgba(15,23,42,0.18)]">
        <div className="mb-2 flex items-center gap-1.5 px-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 h-4 flex-1 rounded-md bg-white/80" />
        </div>

        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-white ring-1 ring-black/5 landing-zoom-clip">
          {PROBLEM_SOLUTIONS.map((item, idx) => (
            <div
              key={item.image}
              className={cn(
                "absolute inset-0 transition-opacity duration-500",
                idx === activeIdx ? "z-10 opacity-100" : "z-0 opacity-0"
              )}
            >
              <div
                key={idx === activeIdx ? `active-${activeIdx}` : `idle-${idx}`}
                className={cn(
                  "absolute inset-0",
                  idx === activeIdx && "landing-zoom-ken-burns"
                )}
              >
                <Image
                  src={item.image}
                  alt={lt(item.title, locale)}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-xs font-medium text-neutral-500">
        {lt(solution.frameLabel, locale)}
      </p>
    </div>
  )
}

function SolutionPanel({ activeIdx, locale }: { activeIdx: number; locale: string }) {
  const solution = PROBLEM_SOLUTIONS[activeIdx]

  return (
    <div className="w-full min-w-0 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8">
      <span className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-700">
        {lt(LANDING_HEADINGS.problem.solutionLabel, locale)}
      </span>

      <div key={activeIdx} className="mt-4 mb-6">
        <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
          {lt(solution.title, locale)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
          {lt(solution.description, locale)}
        </p>
      </div>

      <SolutionScreenshot activeIdx={activeIdx} locale={locale} />
    </div>
  )
}

export function ProblemSection() {
  const { locale } = useLocale()
  const [activeIdx, setActiveIdx] = React.useState(0)
  const cardRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible.length === 0) return

        const index = Number(visible[0].target.getAttribute("data-index"))
        if (!Number.isNaN(index)) setActiveIdx(index)
      },
      {
        root: null,
        rootMargin: window.matchMedia("(min-width: 1024px)")
          ? "-22% 0px -52% 0px"
          : "-8% 0px -55% 0px",
        threshold: [0.2, 0.45, 0.7],
      }
    )

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative overflow-hidden border-y border-neutral-100 bg-gradient-to-b from-neutral-50 via-white to-neutral-50 py-20 sm:py-28">
      <div className="landing-hero-bg pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-3xl space-y-4 text-center">
          <ScrollReveal direction="up" delay={100}>
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              {lt(LANDING_HEADINGS.problem.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              {lt(LANDING_HEADINGS.problem.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="mx-auto max-w-2xl text-lg text-neutral-600">
              {lt(LANDING_HEADINGS.problem.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="min-w-0 space-y-3">
            {PROBLEM_CARDS.map((card, idx) => {
              const Icon = PROBLEM_ICONS[idx] ?? FileWarning
              const isActive = activeIdx === idx

              return (
                <button
                  key={idx}
                  type="button"
                  ref={(el) => {
                    cardRefs.current[idx] = el
                  }}
                  data-index={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    "landing-problem-card flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300",
                    isActive
                      ? "border-primary-300 bg-white shadow-md shadow-primary-500/10 ring-1 ring-primary-100"
                      : "border-neutral-200/80 bg-white/70 hover:border-neutral-300 hover:bg-white"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={cn(
                        "text-sm font-medium leading-relaxed sm:text-base",
                        isActive ? "text-neutral-900" : "text-neutral-700"
                      )}
                    >
                      {lt(card.text, locale)}
                    </p>
                    {isActive ? (
                      <p className="mt-2 text-xs font-semibold text-primary-600">
                        → {lt(PROBLEM_SOLUTIONS[idx].title, locale)}
                      </p>
                    ) : null}
                  </div>
                </button>
              )
            })}

            <div className="pt-2 lg:hidden">
              <SolutionPanel activeIdx={activeIdx} locale={locale} />
            </div>
          </div>

          <div className="hidden min-w-0 lg:block lg:sticky lg:top-28 lg:max-w-xl lg:justify-self-end xl:max-w-none">
            <SolutionPanel activeIdx={activeIdx} locale={locale} />
          </div>
        </div>

        <div className="pt-14 text-center">
          <ScrollReveal direction="scale" delay={300}>
            <Link
              href="#clinic-experience"
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary-600 transition hover:text-primary-700 sm:text-base"
            >
              {lt(LANDING_HEADINGS.problem.transition, locale)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
