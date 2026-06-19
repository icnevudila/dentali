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
    <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-2.5 lg:hidden">
      <p className="text-center text-xs font-medium text-neutral-500">{tagline}</p>
    </div>
  )
}
