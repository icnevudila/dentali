"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { AuthMobileBanner } from "@/components/auth/auth-mobile-banner"
import { useLocale } from "@/hooks/use-locale"
import "@/components/landing/landing.css"

type AuthPageShellProps = {
  variant: "login" | "signup"
  children: ReactNode
}

export function AuthPageShell({ variant, children }: AuthPageShellProps) {
  const { t } = useLocale()

  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-100 lg:flex-row lg:bg-white">
      <AuthMarketingPanel variant={variant} />

      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden">
        <AuthMobileBanner variant={variant} />

        <div className="landing-hero-bg pointer-events-none absolute inset-0 opacity-50 lg:opacity-30" />

        <header className="relative z-10 flex items-center justify-end px-5 py-4 sm:px-6">
          <LocaleSwitcher />
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-6 pt-2 sm:px-6 sm:pb-10">
          {children}
        </div>

        <footer className="relative z-10 border-t border-neutral-200/80 bg-white/70 py-4 text-center text-xs font-medium text-neutral-500 backdrop-blur-sm sm:py-5">
          <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-1 px-4">
            <Link href="/pricing" className="transition hover:text-primary-600">
              {t("marketing.navPricing", "Pricing")}
            </Link>
            <Link href="/quote" className="transition hover:text-primary-600">
              {t("marketing.navQuote", "Get a quote")}
            </Link>
            <Link href="/welcome" className="transition hover:text-primary-600">
              {t("marketing.navHome", "Home")}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
