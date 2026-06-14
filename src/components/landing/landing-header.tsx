"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const NAV_ITEMS = [
  { href: "/welcome#features", labelKey: "product" as const },
  { href: "/pricing", labelKey: "pricing" as const },
  { href: "/quote", labelKey: "quote" as const },
]

export function LandingHeader() {
  const { locale } = useLocale()
  const [scrolled, setScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll() // initial check
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change / resize
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <>
      <header
        className={cn(
          "landing-header fixed inset-x-0 top-0 z-50 border-b",
        )}
        data-scrolled={scrolled}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <DentQLLogo href="/welcome" size="sm" />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Marketing">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {lt(LANDING_HEADINGS.nav[item.labelKey], locale)}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-700"
            >
              {lt(LANDING_HEADINGS.nav.signIn, locale)}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
            >
              {lt(LANDING_HEADINGS.nav.startTrial, locale)}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-neutral-100 bg-white px-4 pb-4 pt-2 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {lt(LANDING_HEADINGS.nav[item.labelKey], locale)}
                </Link>
              ))}
              <hr className="my-2 border-neutral-100" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                {lt(LANDING_HEADINGS.nav.signIn, locale)}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-primary-500 text-sm font-medium text-white shadow-sm"
              >
                {lt(LANDING_HEADINGS.nav.startTrial, locale)}
              </Link>
            </nav>
          </div>
        )}
      </header>
      {/* Spacer */}
      <div className="h-16" />
    </>
  )
}
