"use client"

import { LOCALES, isAppLocale } from "@/lib/i18n/config"
import { useLocale } from "@/hooks/use-locale"
import { Languages } from "lucide-react"

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600">
      <Languages className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">{t("common.language", "Language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value
          if (isAppLocale(next)) setLocale(next)
        }}
        className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
        aria-label={t("common.language", "Language")}
      >
        {LOCALES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
