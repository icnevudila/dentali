"use client"

import type { ReactNode } from "react"
import { DentQLLogo } from "@/components/brand/dentql-logo"
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
    <div className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      <AuthMarketingPanel variant={variant} />

      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden bg-white">
        <header className="relative z-10 flex items-center justify-between border-b border-neutral-100 px-5 py-4 sm:px-6 lg:border-b-0 lg:px-8">
          <DentQLLogo size="sm" href="/welcome" />
          <LocaleSwitcher />
        </header>

        <AuthMobileBanner variant={variant} />

        <div className="relative z-10 flex flex-1 items-center justify-center px-5 pb-8 pt-1 sm:px-6 sm:pb-10 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  )
}
