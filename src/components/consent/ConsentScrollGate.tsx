"use client"

import { ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

export function ConsentScrollGate({
  hasReachedEnd,
  needsScroll,
  onAcknowledge,
  children,
  className,
}: {
  hasReachedEnd: boolean
  needsScroll: boolean
  onAcknowledge: () => void
  children: React.ReactNode
  className?: string
}) {
  const { t } = useLocale()

  if (hasReachedEnd) return <>{children}</>

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white px-4 py-5 text-center shadow-sm",
        className
      )}
    >
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <ScrollText className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-neutral-800">
        {needsScroll
          ? t("consent.scrollToSign", "Please scroll to the bottom of the document to sign.")
          : t("consent.confirmRead", "Confirm you have read the document to continue.")}
      </p>
      {needsScroll ? (
        <p className="mt-1 text-xs text-neutral-500">
          {t("consent.scrollHint", "Use the document panel above, then continue below.")}
        </p>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onAcknowledge}>
        {t("consent.acknowledgeRead", "I have read this document")}
      </Button>
    </div>
  )
}
