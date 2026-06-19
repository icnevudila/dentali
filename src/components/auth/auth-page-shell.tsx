"use client"

import type { ReactNode } from "react"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { AuthMobileBanner } from "@/components/auth/auth-mobile-banner"
import "@/components/landing/landing.css"

type AuthPageShellProps = {
  variant: "login" | "signup"
  children: ReactNode
}

export function AuthPageShell({ variant, children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-100 lg:flex-row lg:bg-white">
      <AuthMarketingPanel variant={variant} />

      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden">
        <AuthMobileBanner variant={variant} />

        <div className="landing-hero-bg pointer-events-none absolute inset-0 opacity-50 lg:opacity-30" />

        <header className="relative z-10 flex items-center justify-end px-5 py-4 sm:px-6">
          <LocaleSwitcher />
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-5 pb-8 pt-2 sm:px-6 sm:pb-10">
          {children}
        </div>
      </div>
    </div>
  )
}
