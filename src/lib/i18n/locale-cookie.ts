import { LOCALE_STORAGE_KEY, type AppLocale, isAppLocale } from "./config"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function writeLocaleCookie(locale: AppLocale) {
  if (typeof document === "undefined") return
  document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(locale)};path=/;max-age=${MAX_AGE_SECONDS};SameSite=Lax`
}

export function readLocaleCookie(): AppLocale | null {
  if (typeof document === "undefined") return null
  const escaped = LOCALE_STORAGE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  const raw = match?.[1]
  if (!raw) return null
  const value = decodeURIComponent(raw)
  if (isAppLocale(value)) return value
  if (value === "en-PH") return "en"
  return null
}
