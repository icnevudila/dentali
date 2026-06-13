"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContentPanel } from "@/components/layout/ContentPanel"

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
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto w-full max-w-lg animate-page-enter py-8">
      <ContentPanel className="py-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-neutral-950">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {error.message || "An unexpected error occurred. You can try again or return home."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </ContentPanel>
    </div>
  )
}
