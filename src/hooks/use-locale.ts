"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isAppLocale,
  type AppLocale,
} from "@/lib/i18n/config"
import { createTranslator } from "@/lib/i18n/translate"

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
        set({ locale, t: createTranslator(locale) })
        if (typeof document !== "undefined") {
          document.documentElement.lang = locale === "en-PH" ? "en-PH" : locale
        }
      },
      t: createTranslator(DEFAULT_LOCALE),
    }),
    {
      name: LOCALE_STORAGE_KEY,
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const locale = isAppLocale(state.locale) ? state.locale : DEFAULT_LOCALE
        state.locale = locale
        state.t = createTranslator(locale)
        if (typeof document !== "undefined") {
          document.documentElement.lang = locale === "en-PH" ? "en-PH" : locale
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
