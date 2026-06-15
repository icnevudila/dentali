"use client"

import { useEffect } from "react"
import { useLocaleStore } from "@/hooks/use-locale"
import { getLocaleDefinition, normalizeLocale } from "@/lib/i18n/config"
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/locale-cookie"

/** Syncs html[lang] and cookie with persisted locale after hydration. */
export function LocaleBootstrap() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  useEffect(() => {
    const cookieLocale = readLocaleCookie()
    const stored = useLocaleStore.getState().locale
    const resolved = normalizeLocale(
      cookieLocale && cookieLocale !== stored ? cookieLocale : stored
    )

    if (resolved !== stored) {
      setLocale(resolved)
      return
    }

    writeLocaleCookie(resolved)
    document.documentElement.lang = getLocaleDefinition(resolved).htmlLang
  }, [setLocale])

  useEffect(() => {
    document.documentElement.lang = getLocaleDefinition(locale).htmlLang
    writeLocaleCookie(locale)
  }, [locale])

  return null
}
