"use client"

import * as React from "react"
import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Download, Globe, Monitor, ChevronDown, ChevronUp } from "lucide-react"
import {
  countIntakeDrafts,
  fetchKioskIntakeDrafts,
  getIntakeSource,
  storeDraftForReview,
  type IntakeDraftCounts,
  type KioskIntakeDraft,
} from "@/lib/patients/intake-draft-review"
import { useLocale } from "@/hooks/use-locale"
import { useOperationalRefresh } from "@/hooks/use-operational-refresh"
import { cn } from "@/lib/utils"

const COLLAPSED_VISIBLE = 3

type SourceFilter = "all" | "kiosk" | "portal" | "unknown"

interface PatientIntakeDraftPanelProps {
  branchId: string
  sourceFilter?: SourceFilter
  onSourceFilterChange?: (filter: SourceFilter) => void
  onCountsChange?: (counts: IntakeDraftCounts) => void
  className?: string
}

function SourceBadge({
  source,
  t,
}: {
  source: ReturnType<typeof getIntakeSource>
  t: (key: string, fallback: string) => string
}) {
  if (source === "portal") {
    return (
      <Badge variant="info" className="gap-1 font-normal">
        <Globe className="h-3 w-3" aria-hidden />
        {t("patients.sourcePortal", "Online portal")}
      </Badge>
    )
  }
  if (source === "kiosk") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50/80 font-normal text-amber-900">
        <Monitor className="h-3 w-3" aria-hidden />
        {t("patients.sourceKiosk", "Kiosk tablet")}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="font-normal text-neutral-600">
      {t("patients.sourceUnknown", "Unknown source")}
    </Badge>
  )
}

export function PatientIntakeDraftPanel({
  branchId,
  sourceFilter: controlledSourceFilter,
  onSourceFilterChange,
  onCountsChange,
  className,
}: PatientIntakeDraftPanelProps) {
  const router = useRouter()
  const { t } = useLocale()
  const [drafts, setDrafts] = React.useState<KioskIntakeDraft[]>([])
  const [loading, setLoading] = React.useState(true)
  const [internalSourceFilter, setInternalSourceFilter] = React.useState<SourceFilter>("all")
  const sourceFilter = controlledSourceFilter ?? internalSourceFilter
  const setSourceFilter = (next: SourceFilter) => {
    if (onSourceFilterChange) onSourceFilterChange(next)
    else setInternalSourceFilter(next)
  }
  const [expanded, setExpanded] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [downloadError, setDownloadError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data } = await fetchKioskIntakeDrafts(branchId)
    setDrafts(data)
    onCountsChange?.(countIntakeDrafts(data))
    setLoading(false)
  }, [branchId, onCountsChange])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  useOperationalRefresh(["patient_intakes"], load)

  React.useEffect(() => {
    const id = window.setTimeout(() => setExpanded(false), 0)
    return () => window.clearTimeout(id)
  }, [sourceFilter])

  React.useEffect(() => {
    if (controlledSourceFilter !== undefined) {
      const id = window.setTimeout(() => setInternalSourceFilter(controlledSourceFilter), 0)
      return () => window.clearTimeout(id)
    }
  }, [controlledSourceFilter])

  const counts = React.useMemo(() => countIntakeDrafts(drafts), [drafts])

  const filteredDrafts = React.useMemo(() => {
    if (sourceFilter === "all") return drafts
    return drafts.filter((d) => getIntakeSource(d.payload) === sourceFilter)
  }, [drafts, sourceFilter])

  const filterOptions = React.useMemo(() => {
    const options: { id: SourceFilter; label: string; count: number; icon?: React.ReactNode }[] = [
      { id: "all", label: t("patients.intakeFilterAll", "All"), count: counts.total },
    ]
    if (counts.kiosk > 0) {
      options.push({
        id: "kiosk",
        label: t("patients.sourceKiosk", "Kiosk tablet"),
        count: counts.kiosk,
        icon: <Monitor className="h-3 w-3" aria-hidden />,
      })
    }
    if (counts.portal > 0) {
      options.push({
        id: "portal",
        label: t("patients.sourcePortal", "Online portal"),
        count: counts.portal,
        icon: <Globe className="h-3 w-3" aria-hidden />,
      })
    }
    if (counts.unknown > 0) {
      options.push({
        id: "unknown",
        label: t("patients.sourceUnknown", "Unknown source"),
        count: counts.unknown,
      })
    }
    return options
  }, [counts, t])

  const handleReview = (draft: KioskIntakeDraft, options?: { returnToQueue?: boolean }) => {
    storeDraftForReview(draft)
    router.push(`/patients/new?from=kiosk-draft${options?.returnToQueue ? "&returnTo=queue" : ""}`)
  }

  const handleDownload = async (draft: KioskIntakeDraft) => {
    setDownloadingId(draft.id)
    setDownloadError(null)
    try {
      const p = draft.payload
      const source = getIntakeSource(p)
      const sourceLabel =
        source === "portal"
          ? t("patients.sourcePortal", "Online portal")
          : source === "kiosk"
            ? t("patients.sourceKiosk", "Kiosk tablet")
            : t("patients.sourceUnknown", "Unknown source")
      const content = [
        `PATIENT INTAKE FORM`,
        `Source: ${sourceLabel}`,
        `Submitted: ${new Date(draft.created_at).toLocaleString()}`,
        `---`,
        `Name: ${p.first_name || ""} ${p.last_name || ""}`,
        `Phone: ${p.phone || ""}`,
        `Email: ${p.email || ""}`,
        `Date of Birth: ${p.date_of_birth || ""}`,
        `Gender: ${p.gender || ""}`,
        `Address: ${p.address_line1 || ""} ${p.city || ""}`,
        `Emergency Contact: ${p.emergency_contact_name || ""} (${p.emergency_contact_phone || ""})`,
        `Medical Alerts: ${p.medical_alerts || "None"}`,
      ].join("\n")

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `intake-${draft.id.slice(0, 8)}.txt`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : "Failed to download")
    }
    setDownloadingId(null)
  }

  if (loading || drafts.length === 0) return null

  const hiddenCount = Math.max(0, filteredDrafts.length - COLLAPSED_VISIBLE)
  const visibleDrafts = expanded ? filteredDrafts : filteredDrafts.slice(0, COLLAPSED_VISIBLE)
  const showSourceFilters = filterOptions.length > 1

  return (
    <section
      id="pending-intake-panel"
      className={cn(
        "animate-fade-rise rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <ClipboardList className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">
            {t("patients.intakeDraftsTitle", "Pending registrations")}
          </p>
          <p className="text-xs text-amber-800/80">
            {t(
              "patients.intakeDraftsHint",
              "New patients from the kiosk tablet or online portal — review and register before end of day."
            )}
          </p>
        </div>
        <Badge variant="warning">{drafts.length}</Badge>
      </div>

      {showSourceFilters ? (
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={t("patients.intakeFilterLabel", "Filter by registration source")}
        >
          {filterOptions.map((option) => {
            const active = sourceFilter === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSourceFilter(option.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-amber-300 bg-white text-amber-950 shadow-sm"
                    : "border-transparent bg-amber-100/60 text-amber-900/80 hover:bg-amber-100"
                )}
              >
                {option.icon}
                <span>{option.label}</span>
                <span
                  className={cn(
                    "tabular-nums rounded-full px-1.5 py-0.5 text-[10px]",
                    active ? "bg-amber-100 text-amber-800" : "bg-white/70 text-amber-800/70"
                  )}
                >
                  {option.count}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {downloadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {downloadError}
          </p>
        ) : null}
        {filteredDrafts.length === 0 ? (
          <p className="rounded-lg border border-amber-100 bg-white/80 px-3 py-4 text-center text-sm text-neutral-500">
            {t("patients.intakeFilterEmpty", "No registrations for this source.")}
          </p>
        ) : null}
        {visibleDrafts.map((draft, index) => {
          const p = draft.payload
          const source = getIntakeSource(p)
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
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-neutral-900 truncate">{name}</p>
                  <SourceBadge source={source} t={t} />
                </div>
                <p className="text-neutral-500 truncate">{phone}</p>
                <p className="text-xs text-neutral-400">
                  {t("patients.intakeSubmitted", "Submitted")} {submitted}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5 self-end sm:self-center">
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
                <Button size="sm" onClick={() => handleReview(draft, { returnToQueue: true })}>
                  {t("patients.intakeRegisterQueue", "Register + queue")}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 w-full gap-1.5 text-amber-900 hover:bg-amber-100/80 hover:text-amber-950"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              {t("patients.intakeShowLess", "Show less")}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {t("patients.intakeShowMore", "Show {count} more").replace("{count}", String(hiddenCount))}
            </>
          )}
        </Button>
      ) : null}
    </section>
  )
}
