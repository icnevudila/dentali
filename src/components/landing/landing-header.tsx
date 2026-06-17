"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const ROUTE_NAV = [
  { href: "/pricing", labelKey: "pricing" as const },
  { href: "/blog", labelKey: "blog" as const },
  { href: "/quote", labelKey: "quote" as const },
]

const SECTION_NAV = [
  { href: "#features", labelKey: "sectionFeatures" as const },
  { href: "#clinic-experience", labelKey: "sectionClinic" as const },
  { href: "#faq", labelKey: "sectionFaq" as const },
  { href: "#pricing", labelKey: "sectionPricing" as const },
] as const

function closeDrawer(setOpen: (v: boolean) => void) {
  setOpen(false)
}

export function LandingHeader() {
  const { locale } = useLocale()
  const pathname = usePathname()
  const onWelcome = pathname === "/welcome" || pathname === "/"
  const [scrolled, setScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  React.useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [mobileOpen])

  const handleSectionClick = (href: string) => {
    setMobileOpen(false)
    if (!href.startsWith("#")) return
    const id = href.slice(1)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      window.history.replaceState(null, "", `${pathname}${href}`)
    }
  }

  const productHref = onWelcome ? "#features" : "/welcome#features"

  return (
    <>
      <header
        className={cn("landing-header fixed inset-x-0 top-0 z-50 border-b")}
        data-scrolled={scrolled}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <DentQLLogo href="/welcome" size="sm" />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Marketing">
            <Link
              href={productHref}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {lt(LANDING_HEADINGS.nav.product, locale)}
            </Link>
            {ROUTE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {lt(LANDING_HEADINGS.nav[item.labelKey], locale)}
              </Link>
            ))}
          </nav>

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

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-nav"
            aria-label={lt(LANDING_HEADINGS.nav.menu, locale)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile side drawer */}
      <div
        className={cn(
          "fixed inset-0 z-[60] md:hidden transition-opacity duration-300",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
          aria-label={lt(LANDING_HEADINGS.nav.menu, locale)}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          id="landing-mobile-nav"
          className={cn(
            "absolute inset-y-0 right-0 flex w-[min(100vw-3rem,20rem)] flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-neutral-100 px-4">
            <span className="text-sm font-semibold text-neutral-900">
              {lt(LANDING_HEADINGS.nav.menu, locale)}
            </span>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {onWelcome ? (
              <div className="mb-4">
                <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  {lt(LANDING_HEADINGS.nav.onThisPage, locale)}
                </p>
                <div className="flex flex-col gap-0.5">
                  {SECTION_NAV.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleSectionClick(item.href)}
                      className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      {lt(LANDING_HEADINGS.nav[item.labelKey], locale)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {lt(LANDING_HEADINGS.footer.productTitle, locale)}
            </p>
            <div className="flex flex-col gap-0.5">
              <Link
                href="/welcome#features"
                onClick={() => closeDrawer(setMobileOpen)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {lt(LANDING_HEADINGS.nav.product, locale)}
              </Link>
              {ROUTE_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => closeDrawer(setMobileOpen)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {lt(LANDING_HEADINGS.nav[item.labelKey], locale)}
                </Link>
              ))}
            </div>

            <hr className="my-4 border-neutral-100" />

            <Link
              href="/login"
              onClick={() => closeDrawer(setMobileOpen)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              {lt(LANDING_HEADINGS.nav.signIn, locale)}
            </Link>
            <Link
              href="/signup"
              onClick={() => closeDrawer(setMobileOpen)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 text-sm font-semibold text-white shadow-sm"
            >
              {lt(LANDING_HEADINGS.nav.startTrial, locale)}
            </Link>
          </nav>
        </aside>
      </div>

      <div className="h-16" />
    </>
  )
}
