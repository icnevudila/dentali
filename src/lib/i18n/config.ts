export type AppLocale = "en-PH" | "en" | "tr" | "fil"

export interface LocaleDefinition {
  code: AppLocale
  label: string
  htmlLang: string
  intlLocale: string
}

export const DEFAULT_LOCALE: AppLocale = "en-PH"

export const LOCALES: LocaleDefinition[] = [
  { code: "en-PH", label: "English (PH)", htmlLang: "en-PH", intlLocale: "en-PH" },
  { code: "en", label: "English", htmlLang: "en", intlLocale: "en" },
  { code: "tr", label: "Türkçe", htmlLang: "tr", intlLocale: "tr-PH" },
  { code: "fil", label: "Filipino", htmlLang: "fil", intlLocale: "fil-PH" },
]

export const LOCALE_STORAGE_KEY = "ph-dental:locale"

export function isAppLocale(value: string): value is AppLocale {
  return LOCALES.some((l) => l.code === value)
}

export function getLocaleDefinition(code: AppLocale): LocaleDefinition {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]
}
