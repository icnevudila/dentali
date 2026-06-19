import type { AppLocale } from "./config"
import { DEFAULT_LOCALE, getLocaleDefinition } from "./config"
import { getMessages, type MessageTree } from "./messages"
import { translateMissingFallback } from "./fallback-translations"

function getNestedValue(tree: MessageTree, key: string): string | undefined {
  const parts = key.split(".")
  let current: string | MessageTree | undefined = tree

  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined
    current = current[part]
  }

  return typeof current === "string" ? current : undefined
}

export function createTranslator(locale: AppLocale) {
  const catalog = getMessages(locale)
  const fallbackCatalog = getMessages(DEFAULT_LOCALE)

  return function t(key: string, fallback: string): string {
    const localized = getNestedValue(catalog, key)
    if (localized) return localized
    const englishFallback = getNestedValue(fallbackCatalog, key) ?? fallback
    if (locale === DEFAULT_LOCALE) return englishFallback
    return translateMissingFallback(locale, englishFallback)
  }
}

export function formatCurrency(
  locale: AppLocale,
  amount: number,
  currency = "PHP"
): string {
  const { intlLocale } = getLocaleDefinition(locale)
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(locale: AppLocale, value: number): string {
  const { intlLocale } = getLocaleDefinition(locale)
  return new Intl.NumberFormat(intlLocale).format(value)
}

export function formatDate(
  locale: AppLocale,
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const { intlLocale } = getLocaleDefinition(locale)
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: "Asia/Manila",
    ...options,
  }).format(date)
}

export function formatTime(
  locale: AppLocale,
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatDate(locale, value, {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  })
}
