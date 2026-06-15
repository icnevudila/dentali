export type AppLocale = "en" | "tr" | "fil"

export interface LocaleDefinition {
  code: AppLocale
  label: string
  htmlLang: string
  intlLocale: string
}

export const DEFAULT_LOCALE: AppLocale = "en"

/** @deprecated Stored locale from older builds — maps to English */
const LEGACY_LOCALE_ALIASES: Record<string, AppLocale> = {
  "en-PH": "en",
}

export const LOCALES: LocaleDefinition[] = [
  { code: "en", label: "English", htmlLang: "en", intlLocale: "en-PH" },
  { code: "tr", label: "Türkçe", htmlLang: "tr", intlLocale: "tr-PH" },
  { code: "fil", label: "Filipino", htmlLang: "fil", intlLocale: "fil-PH" },
]

export const LOCALE_STORAGE_KEY = "ph-dental:locale"

export function normalizeLocale(value: string): AppLocale {
  if (value in LEGACY_LOCALE_ALIASES) return LEGACY_LOCALE_ALIASES[value]
  if (value === "en" || value === "tr" || value === "fil") return value
  return DEFAULT_LOCALE
}

export function isAppLocale(value: string): value is AppLocale {
  return value === "en" || value === "tr" || value === "fil"
}

export function getLocaleDefinition(code: AppLocale): LocaleDefinition {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]
}
