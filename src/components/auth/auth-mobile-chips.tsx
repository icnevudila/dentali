"use client"

import { Building2, CalendarDays, Tv } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

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

export function AuthMobileChips() {
  const { locale } = useLocale()
  const chips = locale === "tr" ? CHIPS.tr : CHIPS.en

  return (
    <div className="flex flex-wrap justify-center gap-2 px-1 lg:hidden">
      {chips.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm"
        >
          <Icon className="h-3 w-3 text-primary-600" />
          {label}
        </div>
      ))}
    </div>
  )
}
