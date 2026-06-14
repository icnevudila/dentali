"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const SCROLL_SHOW_THRESHOLD = 360

export function StickyCta() {
  const { locale } = useLocale()
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const conversionZones = document.querySelectorAll("[data-landing-conversion-zone]")
    let conversionVisible = false

    const update = () => {
      const scrolled = window.scrollY > SCROLL_SHOW_THRESHOLD
      setVisible(scrolled && !conversionVisible)
    }

    const conversionObserver =
      conversionZones.length > 0
        ? new IntersectionObserver(
            (entries) => {
              conversionVisible = entries.some((e) => e.isIntersecting)
              update()
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
          )
        : null

    conversionZones.forEach((el) => conversionObserver?.observe(el))

    const onScroll = () => update()
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      conversionObserver?.disconnect()
    }
  }, [])

  React.useEffect(() => {
    document.body.classList.toggle("landing-sticky-cta-active", visible)
    return () => document.body.classList.remove("landing-sticky-cta-active")
  }, [visible])

  return (
    <div
      className={cn(
        "landing-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/90 bg-white/95 px-4 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.1)] backdrop-blur-md transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "translate-y-full pointer-events-none"
      )}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <Link
          href="/pricing"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 transition active:scale-[0.98]"
        >
          {lt(LANDING_HEADINGS.stickyCta.pricing, locale)}
        </Link>
        <Link
          href="/signup"
          className="inline-flex min-h-11 flex-[1.4] items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
        >
          {lt(LANDING_HEADINGS.stickyCta.trial, locale)}
        </Link>
      </div>
    </div>
  )
}
