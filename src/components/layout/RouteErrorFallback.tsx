"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { useLocale } from "@/hooks/use-locale"
import { translateMissingFallback } from "@/lib/i18n/fallback-translations"

type RouteErrorFallbackProps = {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  homeHref?: string
  homeLabel?: string
}

export function RouteErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  homeHref = "/",
  homeLabel = "Back to dashboard",
}: RouteErrorFallbackProps) {
  const { locale, t } = useLocale()

  useEffect(() => {
    console.error(error)
  }, [error])

  const localize = (value: string) => locale === "tr" ? translateMissingFallback("tr", value) : value
  const isSensitiveError = /row-level security|permission denied for (table|schema)|postgres|sqlstate|minified react|relation .* does not exist/i.test(
    error.message
  )
  const safeMessage = isSensitiveError
    ? t("common.error", "Something went wrong")
    : error.message || t("common.error", "Something went wrong")

  return (
    <div className="mx-auto w-full max-w-lg animate-page-enter py-8">
      <ContentPanel className="py-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-neutral-950">{localize(title)}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {safeMessage}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>{t("common.retry", "Retry")}</Button>
          <Button variant="outline" asChild>
            <Link href={homeHref}>{localize(homeLabel)}</Link>
          </Button>
        </div>
      </ContentPanel>
    </div>
  )
}
