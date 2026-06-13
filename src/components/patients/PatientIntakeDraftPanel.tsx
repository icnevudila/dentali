"use client"

import * as React from "react"
import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Download } from "lucide-react"
import {
  downloadIntakePdf,
  fetchKioskIntakeDrafts,
  storeDraftForReview,
  type KioskIntakeDraft,
} from "@/lib/patients/intake-draft-review"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

interface PatientIntakeDraftPanelProps {
  branchId: string
  onCountChange?: (count: number) => void
  className?: string
}

export function PatientIntakeDraftPanel({
  branchId,
  onCountChange,
  className,
}: PatientIntakeDraftPanelProps) {
  const router = useRouter()
  const { t } = useLocale()
  const [drafts, setDrafts] = React.useState<KioskIntakeDraft[]>([])
  const [loading, setLoading] = React.useState(true)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [downloadError, setDownloadError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data } = await fetchKioskIntakeDrafts(branchId)
    setDrafts(data)
    onCountChange?.(data.length)
    setLoading(false)
  }, [branchId, onCountChange])

  React.useEffect(() => {
    load()
  }, [load])

  const handleReview = (draft: KioskIntakeDraft) => {
    storeDraftForReview(draft)
    router.push("/patients/new?from=kiosk-draft")
  }

  const handleDownload = async (draft: KioskIntakeDraft) => {
    setDownloadingId(draft.id)
    setDownloadError(null)
    try {
      const p = draft.payload as any
      const content = [
        `PATIENT INTAKE FORM`,
        `Submitted: ${new Date(draft.created_at).toLocaleString()}`,
        `---`,
        `Name: ${p.first_name || ""} ${p.last_name || ""}`,
        `Phone: ${p.phone || ""}`,
        `Email: ${p.email || ""}`,
        `Date of Birth: ${p.date_of_birth || ""}`,
        `Gender: ${p.gender || ""}`,
        `Address: ${p.address_line1 || ""} ${p.city || ""}`,
        `Emergency Contact: ${p.emergency_contact_name || ""} (${p.emergency_contact_phone || ""})`,
        `Medical Alerts: ${p.medical_alerts || "None"}`
      ].join("\n")
      
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `intake-${draft.id.slice(0, 8)}.txt`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setDownloadError(err.message || "Failed to download")
    }
    setDownloadingId(null)
  }

  if (loading || drafts.length === 0) return null

  return (
    <section
      className={cn(
        "animate-fade-rise rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <ClipboardList className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">
            {t("patients.intakeDraftsTitle", "Kiosk intake drafts")}
          </p>
          <p className="text-xs text-amber-800/80">
            {t("patients.intakeDraftsHint", "Review and register before end of day")}
          </p>
        </div>
        <Badge variant="warning">{drafts.length}</Badge>
      </div>

      <div className="mt-3 space-y-2">
        {downloadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {downloadError}
          </p>
        ) : null}
        {drafts.map((draft, index) => {
          const p = draft.payload
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed"
          const phone = String(p.phone ?? "—")
          const submitted = new Date(draft.created_at).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          return (
            <div
              key={draft.id}
              className="animate-stagger-item flex flex-col gap-3 rounded-lg border border-amber-100/90 bg-white px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              style={{ "--stagger-index": index } as CSSProperties}
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-900 truncate">{name}</p>
                <p className="text-neutral-500 truncate">{phone}</p>
                <p className="text-xs text-neutral-400">
                  {t("patients.intakeSubmitted", "Submitted")} {submitted}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={downloadingId === draft.id}
                  onClick={() => handleDownload(draft)}
                  title={t("patients.intakeDownload", "Download intake form")}
                  aria-label={t("patients.intakeDownload", "Download intake form")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleReview(draft)}>
                  {t("patients.intakeReview", "Review & register")}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
