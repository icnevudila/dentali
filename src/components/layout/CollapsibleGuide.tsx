"use client"

import * as React from "react"
import { ChevronDown, X } from "lucide-react"
import { usePageDismiss } from "@/hooks/use-page-dismiss"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type CollapsibleGuideProps = {
  summary: string
  children: React.ReactNode
  className?: string
  /** localStorage key — hide permanently when dismissed */
  dismissKey?: string
}

/** Full guide on desktop; collapsed toggle on mobile. Optional dismiss forever. */
export function CollapsibleGuide({
  summary,
  children,
  className,
  dismissKey,
}: CollapsibleGuideProps) {
  const { t } = useLocale()
  const { dismissed, dismiss } = usePageDismiss(dismissKey)
  const [open, setOpen] = React.useState(false)

  if (dismissKey && dismissed) return null

  return (
    <>
      <div className={cn("lg:hidden", className)}>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-left text-sm font-medium text-neutral-800"
            aria-expanded={open}
          >
            <span>{summary}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-neutral-500 transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {dismissKey ? (
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600"
              aria-label={t("common.dismissForever", "Don't show again")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {open ? <div className="mt-3">{children}</div> : null}
      </div>
      <div className={cn("hidden lg:block", className)}>
        {dismissKey ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
            >
              {t("common.dismissForever", "Don't show again")}
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  )
}
