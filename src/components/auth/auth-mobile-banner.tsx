"use client"

import { DentQLLogo } from "@/components/brand/dentql-logo"
import { useLocale } from "@/hooks/use-locale"

type AuthMobileBannerProps = {
  variant: "login" | "signup"
}

export function AuthMobileBanner({ variant }: AuthMobileBannerProps) {
  const { locale } = useLocale()

  const tagline =
    variant === "signup"
      ? locale === "tr"
        ? "Dakikalar içinde klinik kurulumu"
        : "Clinic setup in minutes"
      : locale === "tr"
        ? "Resepsiyondan koltuk kenarına tek sistem"
        : "One system from front desk to chair side"

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-teal-600 to-emerald-700 px-5 py-5 text-white lg:hidden">
      <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="landing-hero-orb landing-hero-orb-a pointer-events-none absolute -left-8 top-0 h-32 w-32 opacity-30" />
      <div className="relative flex items-center justify-between gap-4">
        <DentQLLogo invert size="sm" href="/welcome" />
        <p className="max-w-[55%] text-right text-xs font-medium leading-snug text-white/90">{tagline}</p>
      </div>
    </div>
  )
}
