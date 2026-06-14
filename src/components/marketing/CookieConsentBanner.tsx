"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"

const STORAGE_KEY = "dentali-cookie-consent-v1"

export function CookieConsentBanner() {
  const { locale } = useLocale()
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const accept = React.useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accepted: true, at: new Date().toISOString() })
      )
    } catch {
      // ignore quota / private mode
    }
    setVisible(false)
  }, [])

  if (!visible) return null

  const copy =
    locale === "tr"
      ? {
          title: "Çerezler ve gizlilik",
          body: "Deneyiminizi iyileştirmek ve tercihlerinizi hatırlamak için gerekli çerezleri kullanıyoruz. Siteyi kullanmaya devam ederek bunu kabul etmiş olursunuz.",
          privacy: "Gizlilik politikası",
          accept: "Kabul et",
        }
      : {
          title: "Cookies & privacy",
          body: "We use essential cookies to improve your experience and remember your preferences. By continuing, you accept our cookie policy.",
          privacy: "Privacy policy",
          accept: "Accept",
        }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={copy.title}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-neutral-200/80 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md sm:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 pr-2">
          <p className="text-sm font-bold text-neutral-900">{copy.title}</p>
          <p className="text-xs leading-relaxed text-neutral-600 sm:text-sm">
            {copy.body}{" "}
            <Link href="/privacy" className="font-semibold text-primary-600 underline-offset-2 hover:underline">
              {copy.privacy}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
        >
          {copy.accept}
        </button>
      </div>
    </div>
  )
}
