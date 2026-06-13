"use client"

import * as React from "react"
import { ChevronDown, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DAY_LABELS } from "@/lib/org/clinic-hours-service"
import { useLocale } from "@/hooks/use-locale"
import {
  bulkUpdateProviderAvailability,
  type ProviderAvailabilityInput,
  type ProviderAvailabilityRow,
} from "@/lib/appointments/provider-availability-service"
import { cn } from "@/lib/utils"

interface ProviderOption {
  profile_id: string
  name: string
}

interface ProviderAvailabilityPanelProps {
  rows: ProviderAvailabilityRow[]
  loading?: boolean
  branchId?: string
  providers?: ProviderOption[]
  canWrite?: boolean
  onSaved?: () => void
  defaultCollapsed?: boolean
}

function rowsForProvider(rows: ProviderAvailabilityRow[], providerId: string) {
  return rows
    .filter((r) => r.provider_id === providerId)
    .sort((a, b) => a.day_of_week - b.day_of_week)
}

function summarizeProvider(rows: ProviderAvailabilityRow[]) {
  const openDays = rows.filter((r) => r.is_available).length
  if (openDays === 0) return "Closed all week"
  const sample = rows.find((r) => r.is_available)
  if (!sample) return `${openDays} open days`
  return `${openDays} open days · ${sample.start_time.slice(0, 5)}–${sample.end_time.slice(0, 5)} typical`
}

export function ProviderAvailabilityPanel({
  rows,
  loading,
  branchId,
  providers = [],
  canWrite = false,
  onSaved,
  defaultCollapsed = true,
}: ProviderAvailabilityPanelProps) {
  const { t } = useLocale()
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const [editProviderId, setEditProviderId] = React.useState("")
  const [draft, setDraft] = React.useState<ProviderAvailabilityInput[]>([])
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saveOk, setSaveOk] = React.useState(false)

  const providerRows = React.useMemo(
    () => (editProviderId ? rowsForProvider(rows, editProviderId) : []),
    [rows, editProviderId]
  )

  React.useEffect(() => {
    if (!editProviderId && providers.length > 0) {
      setEditProviderId(providers[0].profile_id)
    }
  }, [providers, editProviderId])

  React.useEffect(() => {
    if (!editProviderId) {
      setDraft([])
      return
    }
    setDraft(
      providerRows.map((d) => ({
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        slot_minutes: d.slot_minutes,
        is_available: d.is_available,
      }))
    )
    setSaveOk(false)
  }, [editProviderId, providerRows])

  const handleSave = async () => {
    if (!branchId || !editProviderId || draft.length === 0) return
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    const { error } = await bulkUpdateProviderAvailability({
      branchId,
      providerId: editProviderId,
      rows: draft,
    })
    setSaving(false)
    if (error) setSaveError(error)
    else {
      setSaveOk(true)
      onSaved?.()
    }
  }

  const updateDay = (dayOfWeek: number, patch: Partial<ProviderAvailabilityInput>) => {
    setDraft((prev) =>
      prev.map((row) => (row.day_of_week === dayOfWeek ? { ...row, ...patch } : row))
    )
  }

  const selectedProviderName =
    providers.find((p) => p.profile_id === editProviderId)?.name ??
    providerRows[0]?.provider_name ??
    t("appointments.provider", "Provider")

  const summaryLine =
    providers.length === 0
      ? t("appointments.providerAvailabilityEmpty", "Add staff to this branch to configure booking slots.")
      : providers.length === 1
        ? summarizeProvider(rowsForProvider(rows, providers[0].profile_id))
        : t("appointments.providerCount", "{count} providers with weekly hours").replace(
            "{count}",
            String(providers.length)
          )

  if (loading) {
    return <PageLoadingSkeleton variant="compact" className="rounded-xl" />
  }

  return (
    <Card className="border-neutral-200/80">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-neutral-500" aria-hidden />
              {t("appointments.providerHours", "Provider hours")}
            </CardTitle>
            <CardDescription>
              {t(
                "appointments.providerHoursHint",
                "Optional setup — defines which time slots appear when booking. Most days you only need the schedule above."
              )}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed
              ? t("appointments.showHours", "Edit hours")
              : t("appointments.hideHours", "Hide")}
            <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
          </Button>
        </div>
        {collapsed ? (
          <p className="text-sm text-neutral-600 pt-1">{summaryLine}</p>
        ) : null}
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 border-t border-neutral-100 pt-4">
          {providers.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {t("appointments.providerAvailabilityEmpty", "Add staff to this branch to configure booking slots.")}
            </p>
          ) : canWrite && branchId ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="text-sm flex-1 min-w-[200px]">
                  <span className="font-medium text-neutral-700">
                    {t("appointments.editProvider", "Provider")}
                  </span>
                  <select
                    value={editProviderId}
                    onChange={(e) => setEditProviderId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    {providers.map((p) => (
                      <option key={p.profile_id} value={p.profile_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button onClick={handleSave} disabled={saving || draft.length === 0}>
                  {saving ? t("common.loading", "Loading…") : t("appointments.saveAvailability", "Save schedule")}
                </Button>
              </div>

              {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}
              {saveOk ? (
                <p className="text-sm text-green-700">{t("appointments.availabilitySaved", "Schedule saved.")}</p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <div className="grid min-w-[520px] grid-cols-[88px_1fr_1fr_72px_64px] gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <span>{t("appointments.colDay", "Day")}</span>
                  <span>{t("appointments.colStart", "Start")}</span>
                  <span>{t("appointments.colEnd", "End")}</span>
                  <span>{t("appointments.colSlot", "Min")}</span>
                  <span>{t("appointments.colOpen", "Open")}</span>
                </div>
                <div className="divide-y divide-neutral-100 px-3">
                  {draft.map((day) => (
                    <div
                      key={day.day_of_week}
                      className="grid grid-cols-[88px_1fr_1fr_72px_64px] gap-2 items-center py-2"
                    >
                      <span className="text-sm font-medium text-neutral-800">
                        {DAY_LABELS[day.day_of_week]}
                      </span>
                      <Input
                        type="time"
                        value={day.start_time}
                        disabled={!day.is_available}
                        onChange={(e) => updateDay(day.day_of_week, { start_time: e.target.value })}
                        className="h-9"
                      />
                      <Input
                        type="time"
                        value={day.end_time}
                        disabled={!day.is_available}
                        onChange={(e) => updateDay(day.day_of_week, { end_time: e.target.value })}
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min={15}
                        step={15}
                        value={day.slot_minutes}
                        disabled={!day.is_available}
                        onChange={(e) =>
                          updateDay(day.day_of_week, { slot_minutes: Number(e.target.value) || 30 })
                        }
                        className="h-9"
                      />
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={day.is_available}
                          onChange={(e) => updateDay(day.day_of_week, { is_available: e.target.checked })}
                          className="rounded text-primary-600"
                          aria-label={`${DAY_LABELS[day.day_of_week]} open`}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-500">
                {t(
                  "appointments.providerHoursFootnote",
                  "Changes apply to new bookings for {name}. Existing appointments are not moved."
                ).replace("{name}", selectedProviderName)}
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 text-sm text-neutral-600">
              {selectedProviderName}: {summarizeProvider(providerRows)}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
