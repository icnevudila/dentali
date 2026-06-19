"use client"

import type { ReactNode } from "react"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { AuthMobileBanner } from "@/components/auth/auth-mobile-banner"
import { AuthFeatureChips } from "@/components/auth/auth-mobile-chips"

type AuthPageShellProps = {
  variant: "login" | "signup"
  children: ReactNode
}

export function AuthPageShell({ variant, children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-emerald-50/70 via-teal-50/25 to-neutral-50 lg:flex-row lg:bg-white">
      <AuthMarketingPanel variant={variant} />

      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden bg-gradient-to-b from-emerald-50/80 via-teal-50/40 to-neutral-100/80 lg:bg-gradient-to-br lg:from-neutral-50 lg:via-white lg:to-emerald-50/25">
        <div
          className="pointer-events-none absolute -left-16 top-20 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl lg:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-10 bottom-28 h-44 w-44 rounded-full bg-teal-200/30 blur-3xl lg:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-1/4 hidden h-64 w-64 rounded-full bg-emerald-100/45 blur-3xl lg:block"
          aria-hidden
        />

        <header className="relative z-10 flex items-center justify-between border-b border-emerald-100/80 bg-white/80 px-5 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <DentQLLogo size="sm" href="/welcome" />
          <LocaleSwitcher />
        </header>

        <AuthMobileBanner variant={variant} />

        <div className="relative z-10 flex flex-1 flex-col items-center gap-3 px-5 pb-8 pt-2 sm:px-6 sm:pb-10 lg:justify-center lg:gap-0 lg:px-8 lg:py-0">
          <AuthFeatureChips className="w-full max-w-[400px] justify-center lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  )
}
