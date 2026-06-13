"use client"

import * as React from "react"
import Link from "next/link"
import {
  Shield,
  Plus,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ScrollText,
  MapPin,
} from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  CYCLE_METHOD_OPTIONS,
  CHEMICAL_INDICATOR_OPTIONS,
  INDICATOR_OPTIONS,
  downloadComplianceCsv,
  fetchComplianceCycles,
  fetchComplianceSummary,
  logComplianceCycle,
  type ComplianceCycle,
  type CycleMethod,
  type IndicatorResult,
  type ComplianceResultStatus,
} from "@/lib/compliance/compliance-service"

const PERIOD_DAYS = [7, 30, 90] as const
type PeriodDays = (typeof PERIOD_DAYS)[number]

function resultVariant(status: ComplianceResultStatus): "success" | "danger" | "warning" | "default" {
  if (status === "pass") return "success"
  if (status === "fail") return "danger"
  if (status === "pending") return "warning"
  return "default"
}

function toLocalDatetimeInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LogCycleForm({
  branchId,
  defaultOperator,
  onSaved,
}: {
  branchId: string
  defaultOperator: string
  onSaved: () => void
}) {
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [equipmentName, setEquipmentName] = React.useState("")
  const [loadDescription, setLoadDescription] = React.useState("")
  const [cycleMethod, setCycleMethod] = React.useState<CycleMethod>("gravity")
  const [startedAt, setStartedAt] = React.useState(toLocalDatetimeInput())
  const [completedAt, setCompletedAt] = React.useState("")
  const [durationMinutes, setDurationMinutes] = React.useState("")
  const [temperatureC, setTemperatureC] = React.useState("121")
  const [biologicalIndicator, setBiologicalIndicator] = React.useState<IndicatorResult>("not_used")
  const [chemicalIndicator, setChemicalIndicator] =
    React.useState<Exclude<IndicatorResult, "not_used">>("pending")
  const [operatorName, setOperatorName] = React.useState(defaultOperator)
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    setOperatorName(defaultOperator)
  }, [defaultOperator])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!equipmentName.trim()) {
      setError(t("compliance.equipmentRequired", "Equipment name is required."))
      return
    }
    setSaving(true)
    const { error: err } = await logComplianceCycle({
      branchId,
      equipmentName: equipmentName.trim(),
      loadDescription: loadDescription.trim() || undefined,
      cycleMethod,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: completedAt ? new Date(completedAt).toISOString() : undefined,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      temperatureC: temperatureC ? Number(temperatureC) : undefined,
      biologicalIndicator,
      chemicalIndicator,
      resultStatus: "pending",
      operatorName: operatorName.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setEquipmentName("")
    setLoadDescription("")
    setNotes("")
    setOpen(false)
    onSaved()
  }

  if (!open) {
    return (
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("compliance.logCycle", "Log sterilization cycle")}
      </Button>
    )
  }

  return (
    <Card className="border-primary-100 bg-primary-50/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-neutral-900">
          {t("compliance.newCycleTitle", "New sterilization cycle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          {error ? (
            <Badge variant="danger" className="col-span-full w-full justify-center py-2">
              {error}
            </Badge>
          ) : null}

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-equipment">
              {t("compliance.equipment", "Autoclave / equipment")}
            </label>
            <Input
              id="comp-equipment"
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
              placeholder={t("compliance.equipmentPlaceholder", "e.g. Tuttnauer 3870")}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-load">
              {t("compliance.load", "Load description")}
            </label>
            <Input
              id="comp-load"
              value={loadDescription}
              onChange={(e) => setLoadDescription(e.target.value)}
              placeholder={t("compliance.loadPlaceholder", "Handpieces, extraction kits, mirrors…")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-method">
              {t("compliance.method", "Cycle method")}
            </label>
            <select
              id="comp-method"
              value={cycleMethod}
              onChange={(e) => setCycleMethod(e.target.value as CycleMethod)}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              {CYCLE_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-operator">
              {t("compliance.operator", "Operator")}
            </label>
            <Input
              id="comp-operator"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-started">
              {t("compliance.startedAt", "Started")}
            </label>
            <Input
              id="comp-started"
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-completed">
              {t("compliance.completedAt", "Completed (optional)")}
            </label>
            <Input
              id="comp-completed"
              type="datetime-local"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-duration">
              {t("compliance.duration", "Duration (minutes)")}
            </label>
            <Input
              id="comp-duration"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-temp">
              {t("compliance.temperature", "Temperature (°C)")}
            </label>
            <Input
              id="comp-temp"
              type="number"
              step="0.1"
              value={temperatureC}
              onChange={(e) => setTemperatureC(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-bio">
              {t("compliance.biological", "Biological indicator")}
            </label>
            <select
              id="comp-bio"
              value={biologicalIndicator}
              onChange={(e) => setBiologicalIndicator(e.target.value as IndicatorResult)}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              {INDICATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-chem">
              {t("compliance.chemical", "Chemical indicator")}
            </label>
            <select
              id="comp-chem"
              value={chemicalIndicator}
              onChange={(e) =>
                setChemicalIndicator(e.target.value as Exclude<IndicatorResult, "not_used">)
              }
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              {CHEMICAL_INDICATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="comp-notes">
              {t("compliance.notes", "Notes")}
            </label>
            <Input
              id="comp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("compliance.notesPlaceholder", "Spore test batch #, maintenance flag…")}
            />
          </div>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? t("compliance.saving", "Saving…") : t("compliance.saveCycle", "Save cycle")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function CompliancePage() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [periodDays, setPeriodDays] = React.useState<PeriodDays>(30)
  const [cycles, setCycles] = React.useState<ComplianceCycle[]>([])
  const [summary, setSummary] = React.useState<Awaited<ReturnType<typeof fetchComplianceSummary>>["data"]>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const sinceIso = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - periodDays)
    return d.toISOString()
  }, [periodDays])

  const load = React.useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)
    const [cyclesResult, summaryResult] = await Promise.all([
      fetchComplianceCycles(activeBranch.id, sinceIso),
      fetchComplianceSummary(activeBranch.id),
    ])
    setCycles(cyclesResult.data)
    setSummary(summaryResult.data)
    setError(cyclesResult.error ?? summaryResult.error)
    setLoading(false)
  }, [activeBranch, sinceIso])

  React.useEffect(() => {
    void load()
  }, [load])

  const operatorDefault =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ""

  const metrics = [
    {
      label: t("compliance.metricTotal", "Cycles (30d)"),
      value: loading ? "—" : (summary?.total_30d ?? 0),
      hint: t("compliance.metricTotalHint", "Logged at this branch"),
      icon: Shield,
    },
    {
      label: t("compliance.metricPassed", "Passed"),
      value: loading ? "—" : (summary?.passed_30d ?? 0),
      hint: t("compliance.metricPassedHint", "Indicators OK"),
      icon: CheckCircle2,
      variant: (summary?.passed_30d ?? 0) > 0 && !loading ? ("success" as const) : ("default" as const),
    },
    {
      label: t("compliance.metricFailed", "Failed"),
      value: loading ? "—" : (summary?.failed_30d ?? 0),
      hint: t("compliance.metricFailedHint", "Needs follow-up"),
      icon: XCircle,
      variant: (summary?.failed_30d ?? 0) > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("compliance.metricPending", "Pending"),
      value: loading ? "—" : (summary?.pending_30d ?? 0),
      hint: t("compliance.metricPendingHint", "Awaiting indicators"),
      icon: Clock,
      variant: (summary?.pending_30d ?? 0) > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.COMPLIANCE_READ}>
      <ModulePageShell
        eyebrow={t("compliance.eyebrow", "Compliance") + " · " + t("compliance.title", "Sterilization log")}
        icon={Shield}
        title={t("compliance.title", "Sterilization log")}
        description={t(
          "compliance.subtitle",
          "Branch sterilization cycles with biological and chemical indicator results — append-only for DOH-ready records."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50/80 p-0.5"
              role="group"
              aria-label={t("compliance.periodLabel", "Log period")}
            >
              {PERIOD_DAYS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriodDays(days)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    periodDays === days
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  {days}d
                </button>
              ))}
            </div>
            {activeBranch ? (
              <PermissionGate permission={PERMISSIONS.COMPLIANCE_WRITE} fallback={null}>
                <LogCycleForm
                  branchId={activeBranch.id}
                  defaultOperator={operatorDefault}
                  onSaved={() => void load()}
                />
              </PermissionGate>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={cycles.length === 0}
              onClick={() => activeBranch && downloadComplianceCsv(cycles, activeBranch.name)}
            >
              <Download className="h-4 w-4" />
              {t("compliance.exportCsv", "Export CSV")}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              {t("reports.refresh", "Refresh")}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/settings/audit">
                <ScrollText className="h-4 w-4" />
                {t("compliance.viewAudit", "Audit log")}
              </Link>
            </Button>
          </div>
        }
        badges={
          activeBranch ? (
            <Badge variant="info" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" aria-hidden />
              {activeBranch.name}
            </Badge>
          ) : null
        }
        metrics={metrics}
        error={error}
        onRetry={() => void load()}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        {!activeBranch ? (
          <p className="text-sm text-neutral-500">
            {t("dashboard.selectBranch", "Select a branch to view stats")}
          </p>
        ) : null}

        {summary?.last_cycle_at ? (
          <p className="text-xs text-neutral-500">
            {t("compliance.lastCycle", "Last cycle")}:{" "}
            {new Date(summary.last_cycle_at).toLocaleString(locale === "tr" ? "tr-TR" : "en-PH")}
          </p>
        ) : null}

        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : cycles.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center">
              <p className="text-sm font-medium text-neutral-800">
                {t("compliance.emptyTitle", "No sterilization cycles in this period")}
              </p>
              <p className="text-sm text-neutral-500">
                {t(
                  "compliance.emptyBody",
                  "Log each autoclave run with load details and indicator results. Records cannot be edited after save."
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-neutral-500">
                    <th className="px-4 py-3 text-left">{t("compliance.colStarted", "Started")}</th>
                    <th className="px-4 py-3 text-left">{t("compliance.colEquipment", "Equipment")}</th>
                    <th className="px-4 py-3 text-left">{t("compliance.colLoad", "Load")}</th>
                    <th className="px-4 py-3 text-left">{t("compliance.colIndicators", "Indicators")}</th>
                    <th className="px-4 py-3 text-left">{t("compliance.colResult", "Result")}</th>
                    <th className="px-4 py-3 text-left">{t("compliance.colOperator", "Operator")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cycles.map((cycle) => (
                    <tr key={cycle.id} className="hover:bg-neutral-50/80">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {new Date(cycle.started_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{cycle.equipment_name}</p>
                        <p className="text-xs text-neutral-500 capitalize">
                          {cycle.cycle_method.replace("_", " ")}
                          {cycle.duration_minutes ? ` · ${cycle.duration_minutes} min` : ""}
                          {cycle.temperature_c ? ` · ${cycle.temperature_c}°C` : ""}
                        </p>
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-neutral-600">
                        {cycle.load_description ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        <span>B: {cycle.biological_indicator}</span>
                        <span className="mx-1 text-neutral-300">·</span>
                        <span>C: {cycle.chemical_indicator}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={resultVariant(cycle.result_status)} className="capitalize">
                          {cycle.result_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {cycle.operator_name ?? cycle.logged_by_name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
