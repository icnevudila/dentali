"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { BRAND_NAME } from "@/lib/brand"

const NAV_ITEMS = [
  { href: "/welcome#features", labelKey: "marketing.navProduct", fallback: "Product" },
  { href: "/pricing", labelKey: "marketing.navPricing", fallback: "Pricing" },
  { href: "/resources", labelKey: "marketing.navResources", fallback: "Resources" },
  { href: "/blog", labelKey: "marketing.navBlog", fallback: "Blog" },
  { href: "/quote", labelKey: "marketing.navQuote", fallback: "Get a quote" },
] as const

function isNavActive(pathname: string, href: string) {
  const base = href.split("#")[0]
  if (href.includes("#")) return pathname === base
  if (base === "/welcome") return pathname === "/" || pathname === "/welcome"
  return pathname === base || pathname.startsWith(`${base}/`)
}

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"] as const

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLocale()

  const isLandingPage = pathname === "/welcome" || pathname === "/"

  if (isLandingPage || isAuthRoute(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <DentQLLogo href="/welcome" size="sm" />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Marketing">
            {NAV_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "text-primary-700 bg-primary-50" : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50"
                  )}
                >
                  {t(item.labelKey, item.fallback)}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <Link
              href="/login"
              className="hidden text-sm font-medium text-neutral-700 hover:text-primary-700 sm:inline"
            >
              {t("marketing.signIn", "Sign in")}
            </Link>
            <Button size="sm" className="shadow-sm" asChild>
              <Link href="/signup" data-testid="marketing-start-trial">
                {t("marketing.startTrial", "Start free trial")}
              </Link>
            </Button>
          </div>
        </div>

        <nav
          className="flex gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 md:hidden hide-scrollbar"
          aria-label="Marketing mobile"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
            >
              {t(item.labelKey, item.fallback)}
            </Link>
          ))}
          <Link href="/login" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium">
            {t("marketing.signIn", "Sign in")}
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-neutral-200 bg-neutral-50/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <p className="text-xs text-neutral-500">
            {BRAND_NAME} — {t("marketing.footerTagline", "clinical operating system for modern dental clinics")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-600">
            <Link href="/welcome" className="hover:text-primary-700">
              {t("marketing.navHome", "Home")}
            </Link>
            <Link href="/pricing" className="hover:text-primary-700">
              {t("marketing.navPricing", "Pricing")}
            </Link>
            <Link href="/resources" className="hover:text-primary-700">
              {t("marketing.navResources", "Resources")}
            </Link>
            <Link href="/quote" className="hover:text-primary-700">
              {t("marketing.navQuote", "Get a quote")}
            </Link>
            <Link href="/blog" className="hover:text-primary-700">
              Blog
            </Link>
            <Link href="/about" className="hover:text-primary-700">
              {t("marketing.navAbout", "About")}
            </Link>
            <Link href="/contact" className="hover:text-primary-700">
              {t("marketing.navContact", "Contact")}
            </Link>
            <Link href="/security" className="hover:text-primary-700">
              {t("marketing.navSecurity", "Security")}
            </Link>
            <Link href="/privacy" className="hover:text-primary-700">
              {t("marketing.navPrivacy", "Privacy")}
            </Link>
            <Link href="/terms" className="hover:text-primary-700">
              {t("marketing.navTerms", "Terms")}
            </Link>
            <Link href="/login" className="hover:text-primary-700">
              {t("marketing.signIn", "Sign in")}
            </Link>
            <Link href="/signup" className="hover:text-primary-700">
              {t("marketing.signUp", "Sign up")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
