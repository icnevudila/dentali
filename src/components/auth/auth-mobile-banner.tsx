"use client"

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
    <div className="relative border-b border-emerald-100/70 bg-gradient-to-r from-emerald-50/90 via-white/50 to-teal-50/70 px-5 py-3 lg:hidden">
      <p className="text-center text-xs font-medium text-emerald-900/75">{tagline}</p>
    </div>
  )
}
