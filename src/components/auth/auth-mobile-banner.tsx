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
    <div className="relative border-b border-primary-100/60 bg-gradient-to-r from-primary-50/90 via-white/50 to-teal-50/80 px-5 py-3 lg:hidden">
      <p className="text-center text-xs font-medium text-neutral-600">{tagline}</p>
    </div>
  )
}
