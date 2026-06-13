"use client"

import { useEffect } from "react"
import { useLocaleStore } from "@/hooks/use-locale"
import { DEFAULT_LOCALE, getLocaleDefinition, isAppLocale } from "@/lib/i18n/config"
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/locale-cookie"

/** Syncs html[lang] and cookie with persisted locale after hydration. */
export function LocaleBootstrap() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  useEffect(() => {
    const cookieLocale = readLocaleCookie()
    const stored = useLocaleStore.getState().locale
    const resolved =
      cookieLocale && cookieLocale !== stored
        ? cookieLocale
        : isAppLocale(stored)
          ? stored
          : DEFAULT_LOCALE

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
