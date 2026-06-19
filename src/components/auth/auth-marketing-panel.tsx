"use client"

import { Building2, CalendarDays, Check, Tv } from "lucide-react"
import { AuthClinicIllustration } from "@/components/auth/auth-clinic-illustration"
import { useLocale } from "@/hooks/use-locale"
import "@/components/landing/landing.css"

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

const CHIPS = {
  en: [
    { icon: Building2, label: "Multi-branch" },
    { icon: CalendarDays, label: "Scheduling" },
    { icon: Tv, label: "Queue TV" },
  ],
  tr: [
    { icon: Building2, label: "Çok şubeli" },
    { icon: CalendarDays, label: "Randevu" },
    { icon: Tv, label: "Sıra TV" },
  ],
} as const

type AuthMarketingPanelProps = {
  variant: "login" | "signup"
}

export function AuthMarketingPanel({ variant }: AuthMarketingPanelProps) {
  const { locale } = useLocale()
  const bullets = locale === "tr" ? BULLETS.tr : BULLETS.en
  const chips = locale === "tr" ? CHIPS.tr : CHIPS.en

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
    <div className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-neutral-200 bg-gradient-to-br from-neutral-50 via-white to-primary-50/50 p-10 lg:flex lg:w-[44%] xl:w-[42%]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary-500 via-teal-500 to-emerald-500"
        aria-hidden
      />
      <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-[0.035]" />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <h2 className="font-[family-name:var(--font-clinic-display)] text-3xl font-bold leading-tight tracking-tight text-neutral-900 xl:text-4xl">
              {title}
            </h2>
            <p className="text-base leading-relaxed text-neutral-600">{subtitle}</p>
          </div>

          <ul className="space-y-3">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-neutral-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {chips.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-primary-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 text-primary-600" />
                {label}
              </div>
            ))}
          </div>

          <AuthClinicIllustration />
        </div>
      </div>

      <p className="relative z-10 text-xs text-neutral-500">
        {locale === "tr" ? "Ücretsiz deneme · Kredi kartı gerekmez" : "Free trial · No credit card required"}
      </p>
    </div>
  )
}
