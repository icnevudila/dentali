"use client"

import { Building2, CalendarDays, Check, Tv } from "lucide-react"
import { PublicChannelBrand } from "@/components/brand/public-channel-brand"
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
    <div className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-600 via-teal-600 to-emerald-700 p-10 text-white lg:flex lg:w-[44%] xl:w-[42%]">
      <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="landing-hero-orb landing-hero-orb-a pointer-events-none absolute opacity-40" />
      <div className="landing-hero-orb landing-hero-orb-b pointer-events-none absolute opacity-30" />

      <div className="relative z-10">
        <PublicChannelBrand variant="auth-header" href="/welcome" />
      </div>

      <div className="relative z-10 max-w-md space-y-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">{title}</h2>
          <p className="text-base leading-relaxed text-white/85">{subtitle}</p>
        </div>

        <ul className="space-y-3">
          {bullets.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-white/90">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Check className="h-3 w-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3 pt-2">
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur-sm">
            <Building2 className="h-4 w-4 text-emerald-200" />
            Multi-branch
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur-sm">
            <CalendarDays className="h-4 w-4 text-emerald-200" />
            Scheduling
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur-sm">
            <Tv className="h-4 w-4 text-emerald-200" />
            Queue TV
          </div>
        </div>
      </div>

      <p className="relative z-10 text-xs text-white/60">
        {locale === "tr" ? "Ücretsiz deneme · Kredi kartı gerekmez" : "Free trial · No credit card required"}
      </p>
    </div>
  )
}
