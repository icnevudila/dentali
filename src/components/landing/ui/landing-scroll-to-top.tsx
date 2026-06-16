"use client"

import * as React from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_HEADINGS } from "@/components/landing/data/landing-data"

const SHOW_AFTER_PX = 480

export function LandingScrollToTop() {
  const { locale } = useLocale()
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const label = locale === "tr" ? LANDING_HEADINGS.nav.scrollToTop.tr : LANDING_HEADINGS.nav.scrollToTop.en

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "landing-scroll-to-top fixed z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-neutral-700 shadow-lg shadow-neutral-900/10 backdrop-blur-md transition-all duration-300 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
        "right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  )
}
