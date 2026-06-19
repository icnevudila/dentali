"use client"

import { Check } from "lucide-react"
import { AuthFeatureChips } from "@/components/auth/auth-mobile-chips"
import { useLocale } from "@/hooks/use-locale"

const BULLETS = {
  en: [
    "Patients, charting, billing & queue in one place",
    "Kiosk check-in and waiting-room TV display",
    "Branch-aware — desktop, tablet, and phone",
  ],
  tr: [
    "Hasta, şema, faturalama ve sıra tek yerde",
    "Kiosk check-in ve bekleme odası TV ekranı",
    "Çok şubeli — masaüstü, tablet ve telefon",
  ],
} as const

type AuthMarketingPanelProps = {
  variant: "login" | "signup"
}

export function AuthMarketingPanel({ variant }: AuthMarketingPanelProps) {
  const { locale } = useLocale()
  const bullets = locale === "tr" ? BULLETS.tr : BULLETS.en

  const title =
    variant === "signup"
      ? locale === "tr"
        ? "Kliniğinizi dakikalar içinde kurun"
        : "Set up your clinic in minutes"
      : locale === "tr"
        ? "Kliniğinize tekrar hoş geldiniz"
        : "Welcome back to your clinic"

  const subtitle =
    locale === "tr"
      ? "Kliniğinizi gülümseten yazılım — resepsiyondan koltuk kenarına."
      : "Software that makes your clinic smile — from front desk to chair side."

  return (
    <div className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-primary-50/40 p-10 lg:flex lg:w-[44%] xl:w-[42%]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 via-teal-500 to-primary-500"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="max-w-md space-y-7">
          <div className="space-y-4">
            <h2 className="font-[family-name:var(--font-clinic-display)] text-3xl font-bold leading-tight tracking-tight text-neutral-900 xl:text-4xl">
              {title}
            </h2>
            <p className="text-base leading-relaxed text-neutral-600">{subtitle}</p>
          </div>

          <ul className="space-y-3">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-neutral-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-800">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <AuthFeatureChips />
        </div>
      </div>

      <p className="relative z-10 text-xs text-neutral-500">
        {locale === "tr" ? "Ücretsiz deneme · Kredi kartı gerekmez" : "Free trial · No credit card required"}
      </p>
    </div>
  )
}
