"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { DentistFilterBar } from "@/components/dentist/DentistFilterBar"
import { DentistUpcomingSection } from "@/components/dentist/DentistUpcomingSection"
import { PatientSearchBar } from "@/components/patients/PatientSearchBar"
import { PatientTable } from "@/components/patients/PatientTable"
import { PageHeader } from "@/components/layout/PageHeader"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { Badge } from "@/components/ui/badge"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { fetchAppointments } from "@/lib/appointments/appointment-service"
import { toDateKey } from "@/lib/appointments/week-calendar"
import { fetchOdontogramFindingsForPatients } from "@/lib/odontogram/dental-chart-service"
import {
  countDentistBoardEntries,
  filterDentistBoardByProvider,
  filterUpcomingByProvider,
  parseDentistBoardFilter,
  searchDentistQueuePatients,
  sortDentistBoardEntries,
  type DentistBoardFilter,
} from "@/lib/clinical/dentist-board"
import { useAuth } from "@/hooks/use-auth"
import { useStaffRole } from "@/hooks/use-staff-role"
import { fetchOrgStaff, type StaffMember } from "@/lib/staff/staff-service"
import type { PatientRecord } from "@/lib/patients/patient-service"
import { fetchQueueEntries, fetchTodayServedCount, type QueueEntry } from "@/lib/queue/queue-service"
import type { ToothFinding } from "@/lib/types/dental"
import { createClient } from "@/lib/supabase/client"
import { Armchair, CheckCircle2, MapPin, Stethoscope, Timer, Users } from "lucide-react"

const PAGE_SIZE = 20

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

function filterUpcomingAppointments(
  appointments: AppointmentRecord[],
  activeQueue: QueueEntry[]
): AppointmentRecord[] {
  const inQueue = new Set(activeQueue.map((e) => e.patient_id))
  const now = Date.now()
  return appointments
    .filter(
      (a) =>
        ["scheduled", "confirmed"].includes(a.status) &&
        !inQueue.has(a.patient_id) &&
        new Date(a.scheduled_at).getTime() >= now - 30 * 60_000
    )
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
}

function DentistPageSkeleton() {
  return <PageLoadingSkeleton variant="list" />
}

export default function DentistPage() {
  return (
    <Suspense fallback={<DentistPageSkeleton />}>
      <DentistPageContent />
    </Suspense>
  )
}

function DentistPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { roleName } = useStaffRole()
  const { activeBranch, branchRevision, hasActiveBranch } = useBranch()
  const { t } = useLocale()
  const searchRef = React.useRef<HTMLInputElement>(null)

  const urlQuery = searchParams.get("q") ?? ""
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const urlFilter = parseDentistBoardFilter(searchParams.get("filter"))
  const urlProvider = searchParams.get("provider")

  const [query, setQuery] = React.useState(urlQuery)
  const debouncedQuery = useDebouncedValue(query, 300)
  const [page, setPage] = React.useState(urlPage)
  const [filter, setFilter] = React.useState<DentistBoardFilter>(urlFilter)
  const [providers, setProviders] = React.useState<StaffMember[]>([])
  const [providerId, setProviderId] = React.useState<string | null>(urlProvider)
  const providerLocked = roleName?.toLowerCase() === "dentist"
  const [patients, setPatients] = React.useState<PatientRecord[]>([])
  const [queueByPatientId, setQueueByPatientId] = React.useState<Record<string, QueueEntry>>({})
  const [total, setTotal] = React.useState(0)
  const [queueEntries, setQueueEntries] = React.useState<QueueEntry[]>([])
  const [upcoming, setUpcoming] = React.useState<AppointmentRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [upcomingLoading, setUpcomingLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [chartFindingsByPatient, setChartFindingsByPatient] = React.useState<
    Record<string, ToothFinding[]>
  >({})
  const [servedToday, setServedToday] = React.useState(0)

  const isSearching = query !== debouncedQuery || (loading && debouncedQuery.length > 0)

  const syncUrl = React.useCallback(
    (
      nextQuery: string,
      nextPage: number,
      nextFilter: DentistBoardFilter,
      nextProviderId: string | null
    ) => {
      const params = new URLSearchParams()
      if (nextQuery.trim()) params.set("q", nextQuery.trim())
      if (nextPage > 1) params.set("page", String(nextPage))
      if (nextFilter !== "all") params.set("filter", nextFilter)
      if (nextProviderId) params.set("provider", nextProviderId)
      const qs = params.toString()
      router.replace(qs ? `/dentist?${qs}` : "/dentist", { scroll: false })
    },
    [router]
  )

  React.useEffect(() => {
    if (!activeBranch) {
      setProviders([])
      return
    }
    void fetchOrgStaff().then(({ data }) => {
      const branchProviders = data.filter(
        (member) =>
          member.is_active &&
          member.branch_names.includes(activeBranch.name) &&
          member.role_name.toLowerCase() === "dentist"
      )
      setProviders(branchProviders)
    })
  }, [activeBranch])

  React.useEffect(() => {
    if (!user || !providerLocked) return
    setProviderId(user.id)
  }, [user, providerLocked])

  React.useEffect(() => {
    if (providerLocked || urlProvider) {
      setProviderId(urlProvider)
      return
    }
    if (providers.length === 1) {
      setProviderId(providers[0].profile_id)
    }
  }, [providerLocked, urlProvider, providers])

  React.useEffect(() => {
    setQuery(urlQuery)
    setPage(urlPage)
    setFilter(urlFilter)
    if (!providerLocked) setProviderId(urlProvider)
  }, [urlQuery, urlPage, urlFilter, urlProvider, providerLocked])

  React.useEffect(() => {
    if (debouncedQuery !== urlQuery) {
      setPage(1)
      syncUrl(debouncedQuery, 1, filter, providerId)
    }
  }, [debouncedQuery, urlQuery, syncUrl, filter, providerId])

  const handleFilterChange = (next: DentistBoardFilter) => {
    setFilter(next)
    setPage(1)
    syncUrl(debouncedQuery, 1, next, providerId)
  }

  const handleProviderChange = (nextProviderId: string | null) => {
    if (providerLocked) return
    setProviderId(nextProviderId)
    setPage(1)
    syncUrl(debouncedQuery, 1, filter, nextProviderId)
  }

  const loadPatients = React.useCallback(async () => {
    if (!activeBranch) {
      setLoading(false)
      setUpcomingLoading(false)
      setPatients([])
      setQueueByPatientId({})
      setQueueEntries([])
      setUpcoming([])
      setTotal(0)
      setChartFindingsByPatient({})
      return
    }

    setLoading(true)
    setError(null)

    const [listResult, queueResult, servedResult] = await Promise.all([
      searchDentistQueuePatients(activeBranch.id, {
        query: debouncedQuery,
        filter,
        providerId,
        page,
        pageSize: PAGE_SIZE,
      }),
      fetchQueueEntries(activeBranch.id, true),
      fetchTodayServedCount(activeBranch.id),
    ])

    setPatients(listResult.data)
    setQueueByPatientId(listResult.queueByPatientId)
    setTotal(listResult.total)
    setError(listResult.error)
    setServedToday(servedResult.count)
    setLoading(false)

    const sortedQueue = filterDentistBoardByProvider(
      sortDentistBoardEntries(queueResult.data),
      providerId
    )
    setQueueEntries(sortedQueue)

    if (listResult.data.length > 0) {
      const ids = listResult.data.map((patient) => patient.id)
      fetchOdontogramFindingsForPatients(ids, activeBranch.id).then(({ data }) => {
        setChartFindingsByPatient(data)
      })
    } else {
      setChartFindingsByPatient({})
    }

    setUpcomingLoading(true)
    const today = toDateKey(new Date())
    const apptResult = await fetchAppointments(activeBranch.id, today)
    const upcomingFiltered = filterUpcomingByProvider(apptResult.data, providerId)
    setUpcoming(filterUpcomingAppointments(upcomingFiltered, sortedQueue))
    setUpcomingLoading(false)
  }, [activeBranch, branchRevision, debouncedQuery, filter, page, providerId])

  React.useEffect(() => {
    loadPatients()
  }, [loadPatients])

  React.useEffect(() => {
    if (!activeBranch) return

    const supabase = createClient()
    const channel = supabase
      .channel(`dentist-module-${activeBranch.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `branch_id=eq.${activeBranch.id}` },
        () => loadPatients()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `branch_id=eq.${activeBranch.id}` },
        () => loadPatients()
      )
      .subscribe()

    const interval = setInterval(() => loadPatients(), 60_000)
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [activeBranch, loadPatients])

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

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    syncUrl(debouncedQuery, nextPage, filter, providerId)
  }

  const counts = countDentistBoardEntries(queueEntries)

  const metricItems = [
    {
      label: t("dentist.metricActive", "In clinic now"),
      value: loading && hasActiveBranch ? "—" : counts.total,
      hint: activeBranch?.name ?? t("dashboard.selectBranch", "Select a branch"),
      icon: Users,
      onClick: () => handleFilterChange("all"),
    },
    {
      label: t("dentist.metricInChair", "In chair"),
      value: loading && hasActiveBranch ? "—" : counts.inChair,
      hint: t("dentist.metricInChairHint", "Being treated now"),
      icon: Armchair,
      variant: counts.inChair > 0 ? ("success" as const) : undefined,
      onClick: () => handleFilterChange("in_chair"),
    },
    {
      label: t("dentist.metricServing", "Called"),
      value: loading && hasActiveBranch ? "—" : counts.nowServing,
      hint: t("dentist.metricServingHint", "On the way to chair"),
      icon: Stethoscope,
      variant: counts.nowServing > 0 ? ("warning" as const) : undefined,
      onClick: () => handleFilterChange("now_serving"),
    },
    {
      label: t("dentist.metricWaiting", "Waiting"),
      value: loading && hasActiveBranch ? "—" : counts.waiting,
      hint: t("dentist.metricWaitingHint", "In line or marked ready"),
      icon: Timer,
      onClick: () => handleFilterChange("waiting"),
    },
    {
      label: t("dentist.metricServedToday", "Served today"),
      value: loading && hasActiveBranch ? "—" : servedToday,
      hint: t("dentist.metricServedTodayHint", "Completed visits today"),
      icon: CheckCircle2,
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Stethoscope}>
            {t("dentist.registryEyebrow", "Clinical")} · {t("dentist.registryModule", "Dentist")}
          </SectionEyebrow>

          <PageHeader
            title={t("dentist.registryTitle", "Dentist workspace")}
            description={t(
              "dentist.registrySubtitle",
              "Today's active queue — same list, chart, and patient pages as the registry."
            )}
          />

          {activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              <WorkflowSettingsLink />
              {!loading ? (
                <Badge variant="outline" className="font-normal tabular-nums">
                  {total}{" "}
                  {total === 1
                    ? t("dentist.patientSingular", "patient")
                    : t("dentist.patientPlural", "patients")}
                </Badge>
              ) : null}
              {debouncedQuery ? (
                <Badge variant="outline" className="max-w-[12rem] truncate font-normal">
                  “{debouncedQuery}”
                </Badge>
              ) : null}
              {filter !== "all" ? (
                <Badge variant="outline" className="font-normal capitalize">
                  {filter.replace("_", " ")}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <MetricStrip items={metricItems} className="lg:grid-cols-2 xl:grid-cols-5" />

          <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[16.5rem_minmax(0,1fr)]">
            <DentistFilterBar
              filter={filter}
              onChange={handleFilterChange}
              providers={providers}
              providerId={providerId}
              onProviderChange={handleProviderChange}
              providerLocked={providerLocked}
              className="xl:sticky xl:top-4 xl:self-start"
            />

            <div className="min-w-0 space-y-4 border-t border-neutral-100 pt-5 xl:border-t-0 xl:pt-0">
              <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-white/95 px-1 pb-3 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
                <SectionEyebrow icon={Users}>
                  {loading
                    ? t("dentist.listLoading", "Chair queue")
                    : t("dentist.listEyebrow", "Active queue")}
                </SectionEyebrow>
                <PatientSearchBar
                  value={query}
                  onChange={setQuery}
                  isSearching={isSearching}
                  inputRef={searchRef}
                />
                <p className="hidden text-[11px] text-neutral-400 sm:block">
                  {t("dentist.searchShortcut", "Press / to focus search")}
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
                context="daily"
                queueByPatientId={queueByPatientId}
              />

              {hasActiveBranch && filter === "all" ? (
                <DentistUpcomingSection upcoming={upcoming} loading={upcomingLoading} />
              ) : null}
            </div>
          </div>
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
