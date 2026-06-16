"use client"

import type { CSSProperties } from "react"
import { addTransitionType, startTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RecordRow, patientInitials } from "@/components/layout/RecordRow"
import { PatientRowActions } from "@/components/patients/PatientRowActions"
import type { PatientRecord } from "@/lib/patients/patient-service"
import type { ToothFinding } from "@/lib/types/dental"
import { MiniOdontogram } from "@/components/odontogram/MiniOdontogram"
import { CompletionRing } from "@/components/visual/CompletionRing"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { AlertCircle, Plus, UserSearch } from "lucide-react"

interface PatientTableProps {
  patients: PatientRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  searchQuery?: string
  noBranch?: boolean
  chartFindingsByPatient?: Record<string, ToothFinding[]>
}

function formatPatientSecondary(patient: PatientRecord): string {
  const parts: string[] = []
  if (patient.phone) parts.push(patient.phone)
  if (patient.date_of_birth) {
    parts.push(
      new Date(patient.date_of_birth + "T12:00:00").toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    )
  }
  return parts.join(" · ") || "No contact on file"
}

function formatLastVisit(locale: ReturnType<typeof useLocale>["locale"], value: string | null | undefined): string {
  if (!value) return "—"
  return formatDate(locale, value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function RecordRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-200/70 bg-white px-3.5 py-3 sm:px-4 sm:py-3.5">
      <div className="h-11 w-11 shrink-0 rounded-full animate-shimmer" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-40 max-w-[70%] rounded-md animate-shimmer" />
        <div className="h-3 w-28 max-w-[50%] rounded-md animate-shimmer" />
      </div>
      <div className="hidden h-9 w-20 rounded-md animate-shimmer lg:block" />
      <div className="hidden h-9 w-9 rounded-full animate-shimmer sm:block" />
    </div>
  )
}

function ListColumnHeaders({ t }: { t: (key: string, fallback: string) => string }) {
  return (
    <div
      className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_7rem_5.5rem_6rem_2.5rem] lg:gap-3 lg:px-4 lg:pb-1 lg:text-[10px] lg:font-semibold lg:uppercase lg:tracking-[0.1em] lg:text-neutral-400"
      aria-hidden
    >
      <span>{t("patients.colPatient", "Patient")}</span>
      <span className="text-right">{t("patients.colLastVisit", "Last visit")}</span>
      <span className="text-center">{t("patients.colIntake", "Intake")}</span>
      <span className="text-center">{t("patients.colChart", "Chart")}</span>
      <span />
    </div>
  )
}

export function PatientTable({
  patients,
  loading,
  error,
  onRetry,
  page,
  pageSize,
  total,
  onPageChange,
  searchQuery,
  noBranch,
  chartFindingsByPatient = {},
}: PatientTableProps) {
  const { t, locale } = useLocale()
  const router = useRouter()

  const openPatient = (patientId: string) => {
    startTransition(() => {
      addTransitionType("nav-forward")
      router.push(`/patients/${patientId}?tab=record`)
    })
  }

  if (noBranch) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-12 text-center animate-fade-rise">
        <p className="text-sm font-medium text-neutral-700">
          {t("patients.selectBranchTitle", "Select a branch to view patients")}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {t("patients.selectBranchHint", "Use the branch switcher in the top bar.")}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label={t("patients.listLoading", "Patient list")}>
        <ListColumnHeaders t={t} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-stagger-item" style={{ "--stagger-index": i } as CSSProperties}>
            <RecordRowSkeleton />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 text-center animate-fade-rise">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>
        <p className="mt-3 text-sm text-red-800">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {t("common.retry", "Retry")}
        </Button>
      </div>
    )
  }

  if (patients.length === 0) {
    const isFiltered = Boolean(searchQuery?.trim())
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-14 text-center animate-fade-rise">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
          <UserSearch className="h-6 w-6" aria-hidden />
        </div>
        <p className="mt-4 text-sm font-medium text-neutral-700">
          {isFiltered
            ? t("patients.emptySearch", "No patients match your search.")
            : t("patients.empty", "No patients found.")}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {isFiltered
            ? t("patients.emptySearchHint", "Try a different name or phone number.")
            : t("patients.emptyHint", "Register a new patient to get started.")}
        </p>
        {!isFiltered ? (
          <Button asChild size="sm" className="mt-5 gap-2">
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              {t("patients.newPatient", "New Patient")}
            </Link>
          </Button>
        ) : null}
      </div>
    )
  }

  const pageStart = (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, total)
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      <ListColumnHeaders t={t} />

      <div className="space-y-2" role="list">
        {patients.map((patient, index) => {
          const fullName = `${patient.first_name} ${patient.last_name}`
          const intakePct = patient.intake_pct ?? 0
          const lastVisitLabel = formatLastVisit(locale, patient.last_visit_at)

          return (
            <div key={patient.id} className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-2">
              <RecordRow
                onClick={() => openPatient(patient.id)}
                staggerIndex={index}
                initials={patientInitials(patient.first_name, patient.last_name)}
                avatarUrl={patient.profile_photo_url}
                primary={
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate">{fullName}</span>
                    <Badge
                      variant={patient.status === "active" ? "success" : "default"}
                      className="shrink-0 font-normal lg:hidden"
                    >
                      {patient.status}
                    </Badge>
                  </span>
                }
                secondary={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>{formatPatientSecondary(patient)}</span>
                    <span className="text-neutral-300 lg:hidden">·</span>
                    <span className="lg:hidden">
                      <span className="text-neutral-400">{t("patients.colLastVisit", "Last visit")}: </span>
                      {lastVisitLabel}
                    </span>
                  </span>
                }
                meta={
                  <Badge
                    variant={patient.status === "active" ? "success" : "default"}
                    className="hidden shrink-0 font-normal lg:inline-flex"
                  >
                    {patient.status}
                  </Badge>
                }
                trailing={
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span
                      className="hidden min-w-[7rem] text-right text-sm tabular-nums text-neutral-600 lg:inline"
                      title={t("patients.colLastVisit", "Last visit")}
                    >
                      {lastVisitLabel}
                    </span>
                    <div className="flex flex-col items-center gap-0.5">
                      <CompletionRing value={intakePct} size={34} strokeWidth={2.5} />
                      <span className="hidden text-[10px] font-medium text-neutral-400 sm:inline">
                        {t("patients.intakeLabel", "Intake")}
                      </span>
                    </div>
                    <div className="hidden items-center gap-2 lg:flex" title={t("patients.colChart", "Chart")}>
                      <MiniOdontogram size="sm" findings={chartFindingsByPatient[patient.id] ?? []} />
                    </div>
                    <PatientRowActions patient={patient} />
                  </div>
                }
              />
            </div>
          )
        })}
      </div>

      {total > pageSize && (
        <nav
          className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label={t("patients.pagination", "Patient list pagination")}
        >
          <p className="text-center text-sm text-neutral-600 sm:text-left">
            {t("patients.showing", "Showing {start}–{end} of {total}")
              .replace("{start}", String(pageStart))
              .replace("{end}", String(pageEnd))
              .replace("{total}", String(total))}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t("common.previous", "Previous")}
            </Button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-neutral-500">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => onPageChange(page + 1)}
            >
              {t("common.next", "Next")}
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
