"use client"

import * as React from "react"
import { AlertTriangle, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { OpenEncounterPrompt, EncounterCheckInChoice } from "@/lib/clinical/encounter-check-in-flow"

type OpenEncounterCheckInDialogProps = {
  open: boolean
  prompt: OpenEncounterPrompt | null
  patientName?: string
  loading?: boolean
  onChoose: (choice: EncounterCheckInChoice) => void
  onClose: () => void
}

export function OpenEncounterCheckInDialog({
  open,
  prompt,
  patientName,
  loading = false,
  onChoose,
  onClose,
}: OpenEncounterCheckInDialogProps) {
  const { t } = useLocale()

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, loading, onClose])

  if (!open || !prompt) return null

  const noteCount = prompt.encounter.notes.length
  const planCount = prompt.encounter.plans.length

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!loading) onClose()
      }}
    >
      <Card
        className="w-full max-w-md border-amber-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-encounter-title"
      >
        <CardHeader className="pb-2 border-b">
          <CardTitle
            id="open-encounter-title"
            className="text-base flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {t("queue.openEncounterTitle", "Open visit found")}
            </span>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-neutral-700">
            {patientName
              ? t(
                  "queue.openEncounterBodyNamed",
                  "{name} already has visit {code} open from {date}."
                )
                  .replace("{name}", patientName)
                  .replace("{code}", prompt.displayCode)
                  .replace("{date}", prompt.openedLabel)
              : t(
                  "queue.openEncounterBody",
                  "This patient already has visit {code} open from {date}."
                )
                  .replace("{code}", prompt.displayCode)
                  .replace("{date}", prompt.openedLabel)}
          </p>
          {prompt.isPriorDay ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
              {t(
                "queue.openEncounterPriorDay",
                "This visit is from a previous day — choose whether to continue it or start fresh."
              )}
            </p>
          ) : null}
          {noteCount > 0 || planCount > 0 ? (
            <p className="text-xs text-neutral-500">
              {t("queue.openEncounterArtifacts", "{notes} notes · {plans} plans on this visit")
                .replace("{notes}", String(noteCount))
                .replace("{plans}", String(planCount))}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="flex-1"
              disabled={loading}
              onClick={() => onChoose("reuse")}
            >
              {t("queue.openEncounterReuse", "Continue same visit")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={loading}
              onClick={() => onChoose("close_and_new")}
            >
              {t("queue.openEncounterCloseNew", "Close & new check-in")}
            </Button>
            <Button variant="ghost" disabled={loading} onClick={() => onChoose("cancel")}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
