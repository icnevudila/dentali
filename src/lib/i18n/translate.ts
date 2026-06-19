import type { AppLocale } from "./config"
import { DEFAULT_LOCALE, getLocaleDefinition } from "./config"
import { getMessages, type MessageTree } from "./messages"
import { translateMissingFallback, resolveTrString } from "./fallback-translations"
import { translateUiString } from "./tr-ui-strings"

function getNestedValue(tree: MessageTree, key: string): string | undefined {
  const parts = key.split(".")
  let current: string | MessageTree | undefined = tree

  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined
    current = current[part]
  }

  return typeof current === "string" ? current : undefined
}

function isHybridTr(text: string): boolean {
  if (!/[ğüşıöçĞÜŞİÖÇ]/.test(text)) return false
  return /\b(the|and|for|with|from|who|which|this|that|before|after|without|showing|review|use|read|open|select|need|your)\b/i.test(
    text
  )
}

export function createTranslator(locale: AppLocale) {
  const catalog = getMessages(locale)
  const fallbackCatalog = getMessages(DEFAULT_LOCALE)

  return function t(key: string, fallback: string): string {
    const englishFallback = getNestedValue(fallbackCatalog, key) ?? fallback
    let localized = getNestedValue(catalog, key)
    if (localized && locale === "tr" && isHybridTr(localized)) {
      localized =
        resolveTrString(englishFallback) ?? translateUiString(englishFallback) ?? undefined
    }
    if (localized) return localized
    if (locale === DEFAULT_LOCALE) return englishFallback
    if (locale === "tr") {
      const fromUi = translateUiString(englishFallback)
      if (fromUi) return fromUi
    }
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
