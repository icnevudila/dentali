"use client"

import { Building2, CalendarDays, Tv } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

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

const chipClassName =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-100/90 px-3 py-1.5 text-xs font-semibold text-emerald-950 shadow-sm shadow-emerald-200/40 sm:gap-2"

const iconClassName = "h-3.5 w-3.5 shrink-0 text-emerald-700"

export function AuthFeatureChips({ className }: { className?: string }) {
  const { locale } = useLocale()
  const chips = locale === "tr" ? CHIPS.tr : CHIPS.en

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map(({ icon: Icon, label }) => (
        <div key={label} className={chipClassName}>
          <Icon className={iconClassName} aria-hidden />
          {label}
        </div>
      ))}
    </div>
  )
}

/** @deprecated Use AuthFeatureChips */
export const AuthMobileChips = AuthFeatureChips
