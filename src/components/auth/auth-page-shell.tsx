"use client"

import type { ReactNode } from "react"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { AuthClinicIllustration } from "@/components/auth/auth-clinic-illustration"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { AuthMobileBanner } from "@/components/auth/auth-mobile-banner"
import { AuthMobileChips } from "@/components/auth/auth-mobile-chips"
import "@/components/landing/landing.css"

type AuthPageShellProps = {
  variant: "login" | "signup"
  children: ReactNode
}

export function AuthPageShell({ variant, children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-primary-50/80 via-teal-50/30 to-neutral-50 lg:flex-row lg:bg-white">
      <AuthMarketingPanel variant={variant} />

      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden bg-gradient-to-b from-primary-50/90 via-teal-50/45 to-neutral-100/80 lg:bg-gradient-to-br lg:from-neutral-50 lg:via-white lg:to-primary-50/30">
        <div
          className="pointer-events-none absolute -left-16 top-20 h-52 w-52 rounded-full bg-primary-200/45 blur-3xl lg:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-10 bottom-28 h-44 w-44 rounded-full bg-teal-200/35 blur-3xl lg:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-1/4 hidden h-64 w-64 rounded-full bg-primary-100/40 blur-3xl lg:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-16 left-1/4 hidden h-48 w-48 rounded-full bg-teal-100/30 blur-3xl lg:block"
          aria-hidden
        />
        <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-[0.06] lg:opacity-[0.035]" />

        <header className="relative z-10 flex items-center justify-between border-b border-primary-100/70 bg-white/80 px-5 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <DentQLLogo size="sm" href="/welcome" />
          <LocaleSwitcher />
        </header>

        <AuthMobileBanner variant={variant} />

        <div className="relative z-10 flex flex-1 flex-col items-center gap-4 px-5 pb-8 pt-3 sm:px-6 sm:pb-10 lg:justify-center lg:gap-0 lg:px-8 lg:py-0">
          <div className="flex w-full max-w-[400px] flex-col items-center gap-3 lg:hidden">
            <AuthMobileChips />
            <AuthClinicIllustration compact />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
