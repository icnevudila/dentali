"use client"

import * as React from "react"
import {
  countPerioAlerts,
  mergePeriodontalChart,
  PERIO_SITE_LABELS,
  PERIO_SITES,
  PERMANENT_TOOTH_ORDER,
  type PerioSite,
  type PeriodontalChartData,
  type PerioSiteReading,
} from "@/lib/odontogram/periodontal-types"
import {
  loadPeriodontalChart,
  savePeriodontalChart,
} from "@/lib/odontogram/periodontal-storage"
import {
  getPatientPeriodontal,
  migrateLocalPeriodontalIfNeeded,
  savePatientPeriodontal,
} from "@/lib/odontogram/periodontal-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PeriodontalPocketPanel({
  patientId,
  branchId,
  organizationId,
  actorUserId,
  canWrite = false,
  selectedTooth,
  onSelectTooth,
  className,
}: {
  patientId: string
  branchId: string
  organizationId?: string | null
  actorUserId?: string | null
  canWrite?: boolean
  selectedTooth?: number | null
  onSelectTooth?: (tooth: number) => void
  className?: string
}) {
  const [chart, setChart] = React.useState<PeriodontalChartData>(() =>
    mergePeriodontalChart(null)
  )
  const [loading, setLoading] = React.useState(true)
  const [syncState, setSyncState] = React.useState<"idle" | "saving" | "saved" | "local">("idle")
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const saveTimerRef = React.useRef<number | null>(null)

  const reloadFromServer = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const local = loadPeriodontalChart(patientId, branchId)
    const { data, error } = await getPatientPeriodontal(patientId, branchId)
    if (error) {
      setLoadError(error)
      setChart(local)
      setSyncState("local")
    } else if (data) {
      const merged = migrateLocalPeriodontalIfNeeded(data.data, local)
      setChart(merged)
      savePeriodontalChart(patientId, branchId, merged)
      setSyncState(data.chart_id ? "saved" : "local")
      if (
        canWrite &&
        organizationId &&
        actorUserId &&
        merged !== data.data &&
        Object.values(local).some((row) =>
          Object.values(row ?? {}).some((s) => s?.depth != null || s?.bop)
        )
      ) {
        void savePatientPeriodontal({
          patientId,
          branchId,
          organizationId,
          actorUserId,
          chart: merged,
        })
      }
    }
    setLoading(false)
  }, [patientId, branchId, canWrite, organizationId, actorUserId])

  React.useEffect(() => {
    void reloadFromServer()
  }, [reloadFromServer])

  const stats = React.useMemo(() => countPerioAlerts(chart), [chart])

  const queueSave = React.useCallback(
    (next: PeriodontalChartData) => {
      setChart(next)
      savePeriodontalChart(patientId, branchId, next)

      if (!canWrite || !organizationId || !actorUserId) {
        setSyncState("local")
        return
      }

      setSyncState("saving")
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        void savePatientPeriodontal({
          patientId,
          branchId,
          organizationId,
          actorUserId,
          chart: next,
        }).then(({ error }) => {
          setSyncState(error ? "local" : "saved")
          if (error) setLoadError(error)
        })
      }, 600)
    },
    [patientId, branchId, canWrite, organizationId, actorUserId]
  )

  React.useEffect(
    () => () => {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    },
    []
  )

  const updateSite = (
    tooth: string,
    site: PerioSite,
    patch: Partial<PerioSiteReading>
  ) => {
    if (!canWrite) return
    queueSave({
      ...chart,
      [tooth]: {
        ...chart[tooth],
        [site]: {
          depth: chart[tooth]?.[site]?.depth ?? null,
          bop: chart[tooth]?.[site]?.bop ?? false,
          ...patch,
        },
      },
    })
  }

  const syncLabel =
    syncState === "saving"
      ? "Saving…"
      : syncState === "saved"
        ? "Synced"
        : syncState === "local"
          ? "Local backup"
          : null

  return (
    <Card className={className} data-testid="periodontal-pocket-panel">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Periodontal pocket chart</CardTitle>
            <CardDescription>6-site depths (mm) · auto-saves to chart record</CardDescription>
          </div>
          {syncLabel ? (
            <span
              className={cn(
                "text-xs font-medium",
                syncState === "saved" && "text-primary-700",
                syncState === "saving" && "text-neutral-500",
                syncState === "local" && "text-amber-700"
              )}
            >
              {syncLabel}
            </span>
          ) : null}
        </div>
        {loadError ? (
          <p className="text-xs text-amber-800">{loadError}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-medium">
          <BadgePill label="≥4mm" value={stats.pockets4Plus} tone="red" />
          <BadgePill label="BOP" value={stats.bopSites} tone="amber" />
          <BadgePill label="Teeth" value={stats.teethRecorded} tone="neutral" />
        </div>
      </CardHeader>
      <CardContent className="max-h-[420px] overflow-auto p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
            Loading periodontal chart…
          </div>
        ) : (
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="border-b border-neutral-200 px-2 py-2 text-left">#</th>
              {PERIO_SITES.map((site) => (
                <th key={site} className="border-b border-neutral-200 px-1 py-2 text-center">
                  {PERIO_SITE_LABELS[site]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMANENT_TOOTH_ORDER.map((toothNum) => {
              const key = String(toothNum)
              const row = chart[key] ?? {}
              const isSelected = selectedTooth === toothNum
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b border-neutral-100",
                    isSelected && "bg-primary-50/80",
                    onSelectTooth && "cursor-pointer hover:bg-neutral-50"
                  )}
                  onClick={() => onSelectTooth?.(toothNum)}
                >
                  <td className="px-2 py-1.5 font-mono font-bold text-neutral-800">{key}</td>
                  {PERIO_SITES.map((site) => (
                    <td key={site} className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                      <SiteCell
                        reading={row[site]}
                        disabled={!canWrite}
                        onChange={(patch) => updateSite(key, site, patch)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        )}
      </CardContent>
      <div className="border-t border-neutral-100 px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-neutral-500"
          onClick={() => void reloadFromServer()}
        >
          Reload from server
        </Button>
      </div>
    </Card>
  )
}

function SiteCell({
  reading,
  disabled,
  onChange,
}: {
  reading?: PerioSiteReading
  disabled?: boolean
  onChange: (patch: Partial<PerioSiteReading>) => void
}) {
  const depth = reading?.depth
  const depthClass =
    depth != null && depth >= 4
      ? "border-red-300 bg-red-50 text-red-900"
      : depth != null && depth >= 1
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-white"

  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        type="number"
        min={0}
        max={15}
        inputMode="numeric"
        aria-label="Pocket depth mm"
        disabled={disabled}
        className={cn(
          "h-7 w-10 rounded border text-center font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60",
          depthClass
        )}
        value={depth ?? ""}
        onChange={(e) => {
          const v = e.target.value
          onChange({ depth: v === "" ? null : Math.min(15, Math.max(0, parseInt(v, 10) || 0)) })
        }}
      />
      <label className="inline-flex items-center gap-0.5 text-[9px] text-neutral-500">
        <input
          type="checkbox"
          checked={!!reading?.bop}
          disabled={disabled}
          onChange={(e) => onChange({ bop: e.target.checked })}
          className="h-3 w-3 rounded border-neutral-300"
        />
        BOP
      </label>
    </div>
  )
}

function BadgePill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "red" | "amber" | "neutral"
}) {
  const styles = {
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    neutral: "bg-neutral-50 text-neutral-700 border-neutral-200",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", styles[tone])}>
      {label}: <strong className="tabular-nums">{value}</strong>
    </span>
  )
}
