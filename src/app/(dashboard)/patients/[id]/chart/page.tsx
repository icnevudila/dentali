"use client"

import * as React from "react"
import { ToothFinding } from "@/lib/types/dental"
import { PatientChartHeader } from "@/components/odontogram/PatientChartHeader"
import { ChartHistoryDrawer } from "@/components/odontogram/ChartHistoryDrawer"
import { OdontogramWorkspace } from "@/components/odontogram/OdontogramWorkspace"
import { DentalLegend } from "@/components/odontogram/DentalLegend"
import { ChartPrintDocument } from "@/components/odontogram/ChartPrintDocument"
import { PeriodontalChartPanel } from "@/components/odontogram/PeriodontalChartPanel"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { usePermission } from "@/hooks/use-permission"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  ensureDentalChart,
  fetchChartAuditHistory,
  getPatientOdontogram,
  upsertToothFinding,
} from "@/lib/odontogram/dental-chart-service"
import { getPatient } from "@/lib/patients/patient-service"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { formatMedicalAlertLabel, toMedicalAlertsData } from "@/lib/patients/medical-alerts"
import { MedicalAlertBanner } from "@/components/patients/MedicalAlertBanner"
import { TreatmentPlanTimelinePanel } from "@/components/clinical/TreatmentPlanTimelinePanel"
import { ChartFindingsPlanSuggestBanner } from "@/components/clinical/ChartFindingsPlanSuggestBanner"
import { PatientChartFindingsPanel } from "@/components/analytics/PatientChartFindingsPanel"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Users } from "lucide-react"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { createClient } from "@/lib/supabase/client"
import { useRouteParams } from "@/hooks/use-route-params"
import { notify } from "@/lib/ui/notify"
import { useLocale } from "@/hooks/use-locale"
import {
  exportSvgElementToPng,
  findOdontogramSvg,
} from "@/lib/odontogram/export-odontogram-image"

export default function DentalChartPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { hasPermission } = usePermission()
  const { t } = useLocale()

  const searchParams = useSearchParams()
  const initialToothParam = searchParams.get("tooth")
  const initialSelectedTooth = React.useMemo(() => {
    if (!initialToothParam) return null
    const n = parseInt(initialToothParam, 10)
    return Number.isNaN(n) ? null : n
  }, [initialToothParam])

  const [findings, setFindings] = React.useState<ToothFinding[]>([])
  const [chartId, setChartId] = React.useState<string | null>(null)
  const [patientName, setPatientName] = React.useState("")
  const [unsavedChanges, setUnsavedChanges] = React.useState<ToothFinding[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)
  const [alertLabel, setAlertLabel] = React.useState<string | null>(null)
  const [loadKey, setLoadKey] = React.useState(0)
  const [medicalRefreshKey, setMedicalRefreshKey] = React.useState(0)
  const [selectedTooth, setSelectedTooth] = React.useState<number | null>(initialSelectedTooth)
  const [isExportingPng, setIsExportingPng] = React.useState(false)
  const chartExportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setSelectedTooth(initialSelectedTooth)
  }, [initialSelectedTooth])

  const canWrite = hasPermission(PERMISSIONS.DENTAL_CHART_WRITE)
  const [orgId, setOrgId] = React.useState<string | null>(null)

  React.useEffect(() => {
    void fetchOrganization().then((org) => setOrgId(org?.id ?? null))
  }, [])

  const reload = React.useCallback(() => setLoadKey((k) => k + 1), [])

  React.useEffect(() => {
    if (!patientId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`chart-medical-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_medical_histories",
          filter: `patient_id=eq.${patientId}`,
        },
        () => setMedicalRefreshKey((k) => k + 1)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId])

  React.useEffect(() => {
    if (!patientId) return

    if (!activeBranch) {
      setIsLoading(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    Promise.all([
      getPatientOdontogram(patientId, activeBranch.id),
      getPatient(patientId),
      getLatestMedicalHistory(patientId),
    ]).then(([chartResult, patientResult, historyResult]) => {
      if (cancelled) return
      if (chartResult.error) {
        setLoadError(chartResult.error)
      } else if (chartResult.data) {
        setChartId(chartResult.data.id)
        setFindings(chartResult.data.findings)
      }
      if (patientResult.data) {
        setPatientName(`${patientResult.data.first_name} ${patientResult.data.last_name}`)
      }
      if (historyResult.data) {
        setAlertLabel(formatMedicalAlertLabel(toMedicalAlertsData(historyResult.data)))
      }
      setIsLoading(false)
    })

    fetchChartAuditHistory({ patientId, limit: 1 }).then(({ data }) => {
      if (!cancelled && data[0]) setLastUpdated(data[0].created_at)
    })

    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch, loadKey])

  const handleMarkThirdMolarsMissing = () => {
    const molars = ["18", "28", "38", "48"]
    const nextFindings = [...findings]
    const nextUnsaved = [...unsavedChanges]

    for (const m of molars) {
      const existing = nextFindings.find((f) => f.tooth_number === m)
      if (existing?.condition === "missing_other") continue

      const newFinding: ToothFinding = {
        tooth_number: m,
        condition: "missing_other",
        status: "active",
        dentition_type: "permanent",
        surfaces: [],
        notes: "Marked missing via quick 3rd molars toggle."
      }

      const filteredF = nextFindings.filter((f) => f.tooth_number !== m)
      nextFindings.splice(0, nextFindings.length, ...filteredF, newFinding)

      const filteredU = nextUnsaved.filter((f) => f.tooth_number !== m)
      nextUnsaved.splice(0, nextUnsaved.length, ...filteredU, newFinding)
    }

    setFindings(nextFindings)
    setUnsavedChanges(nextUnsaved)
    notify.success("All 3rd molars marked as missing locally! Click Save Chart to persist.")
  }

  const handleSaveFindingLocally = (newFinding: Partial<ToothFinding>) => {
    const completeFinding = newFinding as ToothFinding
    if (!completeFinding.status) completeFinding.status = "active"
    if (!completeFinding.dentition_type) completeFinding.dentition_type = "permanent"

    setFindings((prev) => {
      const filtered = prev.filter((f) => f.tooth_number !== completeFinding.tooth_number)
      return [...filtered, completeFinding]
    })

    setUnsavedChanges((prev) => {
      const filtered = prev.filter((f) => f.tooth_number !== completeFinding.tooth_number)
      return [...filtered, completeFinding]
    })
  }

  const commitChartToDatabase = async () => {
    if (!user || !activeBranch || unsavedChanges.length === 0) return
    setIsSaving(true)
    setSaveError(null)

    const org = await fetchOrganization()
    if (!org) {
      setSaveError("Organization not found")
      setIsSaving(false)
      return
    }

    let activeChartId = chartId
    if (!activeChartId) {
      const ensured = await ensureDentalChart(
        patientId,
        activeBranch.id,
        org.id,
        user.id
      )
      if (ensured.error) {
        setSaveError(ensured.error)
        setIsSaving(false)
        return
      }
      activeChartId = ensured.chartId
      setChartId(activeChartId)
    }

    for (const finding of unsavedChanges) {
      const { error } = await upsertToothFinding({
        organizationId: org.id,
        branchId: activeBranch.id,
        chartId: activeChartId,
        patientId,
        finding,
        actorUserId: user.id,
      })
      if (error) {
        setSaveError(error)
        setIsSaving(false)
        return
      }
    }

    setUnsavedChanges([])
    setIsSaving(false)
    reload()
    const { data: latest } = await fetchChartAuditHistory({ patientId, chartId: activeChartId, limit: 1 })
    if (latest[0]) setLastUpdated(latest[0].created_at)
  }

  const handleExportPng = async () => {
    const root = chartExportRef.current
    if (!root) return
    const svg = findOdontogramSvg(root)
    if (!svg) return
    setIsExportingPng(true)
    try {
      await exportSvgElementToPng(svg, `odontogram-${patientId}`)
    } finally {
      setIsExportingPng(false)
    }
  }

  if (isLoading) {
    return <PageLoadingSkeleton variant="detail" className="max-w-7xl px-4 py-8" />
  }

  if (!activeBranch) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-center">
          <p className="text-amber-900 font-medium">Select a branch to open the dental chart.</p>
          <p className="mt-2 text-sm text-amber-800/80">
            Use the branch switcher in the top bar, then return to this page.
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 text-center animate-fade-rise">
          <p className="text-red-800">{loadError}</p>
          <p className="mt-2 text-sm text-red-700/80">
            If this mentions a missing function, apply the latest Supabase migrations.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <ChartPrintDocument
        patientName={patientName || "Patient"}
        branchName={activeBranch.name}
        findings={findings}
      />

      <DirectionalTransition className="space-y-6 max-w-7xl mx-auto print:hidden">
        <SectionEyebrow icon={Users}>Clinical · Dental chart</SectionEyebrow>

        {saveError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}

        <MedicalAlertBanner
          patientId={patientId}
          editHref={`/patients/${patientId}/medical-history`}
          refreshKey={medicalRefreshKey}
        />

        <PatientChartHeader
          patientName={patientName || "Patient"}
          hasUnsavedChanges={unsavedChanges.length > 0}
          onSaveChart={canWrite ? commitChartToDatabase : undefined}
          onExportPng={handleExportPng}
          isExporting={isExportingPng}
          isSaving={isSaving}
          lastUpdated={lastUpdated}
          onOpenHistory={() => setHistoryOpen(true)}
          alertLabel={alertLabel}
          pdaChartHref={`/patients/${patientId}/pda-dental-chart`}
        />

        {canWrite && (
          <div className="flex flex-wrap justify-between items-center gap-2 p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
            <div className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
              {t("chart.quickUtilities", "Quick Charting Utilities")}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs border-neutral-300 hover:bg-neutral-100"
              onClick={handleMarkThirdMolarsMissing}
            >
              {t("chart.markThirdMolarsMissing", "Mark All 3rd Molars Missing")}
            </Button>
          </div>
        )}

        <ChartHistoryDrawer
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          patientId={patientId}
          chartId={chartId}
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-6">
            {canWrite ? (
              <OdontogramWorkspace
                findings={findings}
                onSaveFinding={handleSaveFindingLocally}
                initialSelectedTooth={initialSelectedTooth}
                onSelectedToothChange={setSelectedTooth}
                chartExportRef={chartExportRef}
              />
            ) : (
              <OdontogramWorkspace
                findings={findings}
                onSaveFinding={() => {}}
                readOnly
                initialSelectedTooth={initialSelectedTooth}
                onSelectedToothChange={setSelectedTooth}
                chartExportRef={chartExportRef}
              />
            )}
            <div className="print:hidden">
              <DentalLegend />
            </div>
          </div>
          {activeBranch && (
            <div className="space-y-4 print:hidden">
              <PeriodontalChartPanel
                patientId={patientId}
                branchId={activeBranch.id}
                organizationId={orgId}
                actorUserId={user?.id ?? null}
                canWrite={canWrite}
                selectedTooth={selectedTooth}
                onSelectTooth={setSelectedTooth}
              />
              <ChartFindingsPlanSuggestBanner patientId={patientId} findings={findings} />
              <PatientChartFindingsPanel findings={findings} />
              <TreatmentPlanTimelinePanel patientId={patientId} branchId={activeBranch.id} />
            </div>
          )}
        </div>
      </DirectionalTransition>
    </PermissionGate>
  )
}
