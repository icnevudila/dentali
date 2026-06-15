"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_LOCALE, getLocaleDefinition, normalizeLocale, LOCALE_STORAGE_KEY, type AppLocale } from "@/lib/i18n/config"
import { createTranslator } from "@/lib/i18n/translate"
import { writeLocaleCookie } from "@/lib/i18n/locale-cookie"

interface LocaleState {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: string, fallback: string) => string
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => {
        const next = normalizeLocale(locale)
        set({ locale: next, t: createTranslator(next) })
        if (typeof document !== "undefined") {
          document.documentElement.lang = getLocaleDefinition(next).htmlLang
          writeLocaleCookie(next)
        }
      },
      t: createTranslator(DEFAULT_LOCALE),
    }),
    {
      name: LOCALE_STORAGE_KEY,
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const locale = normalizeLocale(state.locale)
        state.locale = locale
        state.t = createTranslator(locale)
        if (typeof document !== "undefined") {
          document.documentElement.lang = getLocaleDefinition(locale).htmlLang
        }
      },
    }
  )
)

export function useLocale() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const t = useLocaleStore((s) => s.t)
  return { locale, setLocale, t }
}
