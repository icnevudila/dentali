"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PatientSearchBar } from "@/components/patients/PatientSearchBar"
import { PatientTable } from "@/components/patients/PatientTable"
import { PatientFilterBar } from "@/components/patients/PatientFilterBar"
import { PatientIntakeDraftPanel } from "@/components/patients/PatientIntakeDraftPanel"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { searchPatients } from "@/lib/patients/patient-service"
import { fetchOdontogramFindingsForPatients } from "@/lib/odontogram/dental-chart-service"
import type { ToothFinding } from "@/lib/types/dental"
import {
  DEFAULT_PATIENT_LIST_FILTERS,
  filtersToSearchParams,
  parsePatientListFilters,
  type PatientListFilters,
} from "@/lib/patients/patient-list-filters"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import Link from "next/link"
import { ClipboardList, Globe, MapPin, Monitor, Plus, Users } from "lucide-react"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { PatientsAnalyticsPanel } from "@/components/analytics/PatientsAnalyticsPanel"
import type { IntakeDraftCounts } from "@/lib/patients/intake-draft-review"

const PAGE_SIZE = 20

type IntakeSourceFilter = "all" | "kiosk" | "portal" | "unknown"

function formatIntakeBreakdown(
  counts: IntakeDraftCounts,
  t: (key: string, fallback: string) => string
): string {
  const parts: string[] = []
  if (counts.kiosk > 0) {
    parts.push(`${counts.kiosk} ${t("patients.sourceKioskShort", "kiosk")}`)
  }
  if (counts.portal > 0) {
    parts.push(`${counts.portal} ${t("patients.sourcePortalShort", "portal")}`)
  }
  if (counts.unknown > 0) {
    parts.push(`${counts.unknown} ${t("patients.sourceUnknownShort", "other")}`)
  }
  return parts.join(" · ")
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function PatientsPageSkeleton() {
  return <PageLoadingSkeleton variant="list" />
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<PatientsPageSkeleton />}>
      <PatientsPageContent />
    </Suspense>
  )
}

function PatientsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeBranch, branchRevision, hasActiveBranch } = useBranch()
  const { t } = useLocale()
  const searchRef = React.useRef<HTMLInputElement>(null)

  const urlQuery = searchParams.get("q") ?? ""
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const attentionConsents = searchParams.get("attention") === "consents"
  const intakeSourceParam = searchParams.get("intakeSource")
  const intakeSourceFilter: IntakeSourceFilter =
    intakeSourceParam === "kiosk" ||
    intakeSourceParam === "portal" ||
    intakeSourceParam === "unknown"
      ? intakeSourceParam
      : "all"
  const [query, setQuery] = React.useState(urlQuery)
  const debouncedQuery = useDebouncedValue(query, 300)
  const [page, setPage] = React.useState(urlPage)
  const [filters, setFilters] = React.useState<PatientListFilters>(() =>
    parsePatientListFilters(searchParams)
  )
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingIntakeCount, setPendingIntakeCount] = React.useState(0)
  const [intakeCounts, setIntakeCounts] = React.useState<IntakeDraftCounts>({
    total: 0,
    kiosk: 0,
    portal: 0,
    unknown: 0,
  })
  const [chartFindingsByPatient, setChartFindingsByPatient] = React.useState<
    Record<string, ToothFinding[]>
  >({})

  const isSearching = query !== debouncedQuery || (loading && debouncedQuery.length > 0)

  const syncUrl = React.useCallback(
    (nextQuery: string, nextPage: number, nextFilters: PatientListFilters) => {
      const params = filtersToSearchParams(nextFilters, nextQuery, nextPage)
      const qs = params.toString()
      router.replace(qs ? `/patients?${qs}` : "/patients", { scroll: false })
    },
    [router]
  )

  React.useEffect(() => {
    setQuery(urlQuery)
    setPage(urlPage)
    setFilters(parsePatientListFilters(searchParams))
  }, [urlQuery, urlPage, searchParams])

  React.useEffect(() => {
    if (debouncedQuery !== urlQuery) {
      setPage(1)
      syncUrl(debouncedQuery, 1, filters)
    }
  }, [debouncedQuery, urlQuery, syncUrl, filters])

  const handleFiltersChange = (next: PatientListFilters) => {
    setFilters(next)
    setPage(1)
    syncUrl(debouncedQuery, 1, next)
  }

  const loadPatients = React.useCallback(async () => {
    if (!activeBranch) {
      setLoading(false)
      setPatients([])
      setTotal(0)
      return
    }
    setLoading(true)
    setError(null)
    const result = await searchPatients(debouncedQuery, activeBranch.id, {
      page,
      pageSize: PAGE_SIZE,
      filters,
    })
    setPatients(result.data)
    setTotal(result.total)
    setError(result.error)
    setLoading(false)

    if (activeBranch && result.data.length > 0) {
      const ids = result.data.map((p) => p.id)
      fetchOdontogramFindingsForPatients(ids, activeBranch.id).then(({ data }) => {
        setChartFindingsByPatient(data)
      })
    } else {
      setChartFindingsByPatient({})
    }
  }, [activeBranch, branchRevision, debouncedQuery, page, filters])

  React.useEffect(() => {
    loadPatients()
  }, [loadPatients])

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    syncUrl(debouncedQuery, nextPage, filters)
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const scrollToIntakePanel = React.useCallback((filter: IntakeSourceFilter = "all") => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === "all") params.delete("intakeSource")
    else params.set("intakeSource", filter)
    const qs = params.toString()
    router.replace(qs ? `/patients?${qs}` : "/patients", { scroll: false })
    requestAnimationFrame(() => {
      document.getElementById("pending-intake-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [router, searchParams])

  const handleIntakeCountsChange = React.useCallback((counts: IntakeDraftCounts) => {
    setIntakeCounts(counts)
    setPendingIntakeCount(counts.total)
  }, [])

  const intakeBreakdown = formatIntakeBreakdown(intakeCounts, t)

  const metricItems = [
    {
      label: t("patients.metricTotal", "Patients in registry"),
      value: loading && hasActiveBranch ? "—" : total,
      hint: activeBranch?.name ?? t("dashboard.selectBranch", "Select a branch"),
      icon: Users,
    },
    {
      label: t("patients.metricPage", "This page"),
      value: loading && hasActiveBranch ? "—" : patients.length,
      hint: debouncedQuery
        ? t("patients.metricFiltered", "Matching search")
        : t("patients.metricAll", "All records"),
    },
    ...(pendingIntakeCount > 0
      ? [
          {
            label: t("patients.metricPendingIntake", "Pending registrations"),
            value: pendingIntakeCount,
            hint: intakeBreakdown
              ? `${intakeBreakdown} — ${t("patients.intakeMetricTap", "Tap to review")}`
              : t("patients.metricPendingIntakeHint", "Kiosk & portal drafts to review"),
            icon: ClipboardList,
            variant: "warning" as const,
            onClick: () => scrollToIntakePanel("all"),
          },
          ...(intakeCounts.kiosk > 0
            ? [
                {
                  label: t("patients.metricKioskIntake", "Kiosk intake"),
                  value: intakeCounts.kiosk,
                  hint: t("patients.metricKioskIntakeHint", "Tablet registrations — tap to filter"),
                  icon: Monitor,
                  variant: "warning" as const,
                  onClick: () => scrollToIntakePanel("kiosk"),
                },
              ]
            : []),
          ...(intakeCounts.portal > 0
            ? [
                {
                  label: t("patients.metricPortalIntake", "Portal intake"),
                  value: intakeCounts.portal,
                  hint: t("patients.metricPortalIntakeHint", "Online new patients — tap to filter"),
                  icon: Globe,
                  variant: "warning" as const,
                  onClick: () => scrollToIntakePanel("portal"),
                },
              ]
            : []),
        ]
      : []),
  ]

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_READ}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Users}>
            {t("patients.registryEyebrow", "Clinical")} · {t("patients.registryModule", "Patients")}
          </SectionEyebrow>

          <PageHeader
            title={t("patients.registryTitle", "Patient Registry")}
            description={t(
              "patients.registrySubtitle",
              "Manage patient records, demographics, and clinical files."
            )}
            actions={
              <>
                <Button asChild size="sm" className="hidden gap-2 shadow-sm sm:inline-flex">
                  <Link href="/patients/new" transitionTypes={NAV_FORWARD_TRANSITION}>
                    <Plus className="h-4 w-4" />
                    {t("patients.newPatient", "New Patient")}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="icon"
                  className="sm:hidden shadow-sm"
                  aria-label={t("patients.newPatient", "New Patient")}
                >
                  <Link href="/patients/new" transitionTypes={NAV_FORWARD_TRANSITION}>
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            }
          />

          {activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              {!loading ? (
                <Badge variant="outline" className="font-normal tabular-nums">
                  {total}{" "}
                  {total === 1
                    ? t("patients.recordSingular", "record")
                    : t("patients.recordPlural", "records")}
                </Badge>
              ) : null}
              {debouncedQuery ? (
                <Badge variant="outline" className="max-w-[12rem] truncate font-normal">
                  “{debouncedQuery}”
                </Badge>
              ) : null}
              {filters.status !== DEFAULT_PATIENT_LIST_FILTERS.status ? (
                <Badge variant="outline" className="font-normal capitalize">
                  {filters.status}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {attentionConsents ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-950 animate-fade-rise">
              <p className="font-medium">{t("patients.attentionConsentsTitle", "Pending consents need action")}</p>
              <p className="mt-1 text-amber-900/80">
                {t(
                  "patients.attentionConsentsHint",
                  "Open a patient profile → Consents tab to collect or follow up on unsigned forms."
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/patients">{t("billing.clearFilter", "Clear filter")}</Link>
              </Button>
            </div>
          ) : null}

          <MetricStrip items={metricItems} className="lg:grid-cols-3 xl:grid-cols-4" />

          {activeBranch ? <PatientsAnalyticsPanel branchId={activeBranch.id} /> : null}

          {activeBranch ? (
            <PatientIntakeDraftPanel
              branchId={activeBranch.id}
              sourceFilter={intakeSourceFilter}
              onSourceFilterChange={(filter) => scrollToIntakePanel(filter)}
              onCountsChange={handleIntakeCountsChange}
            />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[16.5rem_minmax(0,1fr)]">
            <PatientFilterBar
              filters={filters}
              onChange={handleFiltersChange}
              className="xl:sticky xl:top-4 xl:self-start"
            />

            <div className="min-w-0 space-y-4 border-t border-neutral-100 pt-5 xl:border-t-0 xl:pt-0">
              <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-white/95 px-1 pb-3 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
                <SectionEyebrow icon={Users}>
                  {loading
                    ? t("patients.listLoading", "Patient list")
                    : t("patients.listEyebrow", "Patient list")}
                </SectionEyebrow>
                <PatientSearchBar
                  value={query}
                  onChange={setQuery}
                  isSearching={isSearching}
                  inputRef={searchRef}
                />
                <p className="hidden text-[11px] text-neutral-400 sm:block">
                  {t("patients.searchShortcut", "Press / to focus search")}
                </p>
              </div>

              <PatientTable
                patients={patients}
                loading={loading && hasActiveBranch}
                error={error}
                onRetry={loadPatients}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={handlePageChange}
                searchQuery={debouncedQuery}
                noBranch={!hasActiveBranch}
                chartFindingsByPatient={chartFindingsByPatient}
              />
            </div>
          </div>
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
