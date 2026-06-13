"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import {
  countActiveFilters,
  DEFAULT_PATIENT_LIST_FILTERS,
  type PatientListFilters,
  type PatientSort,
  type PatientStatusFilter,
  type PatientVisitFilter,
} from "@/lib/patients/patient-list-filters"
import { cn } from "@/lib/utils"
import { ArrowDownAZ, Calendar, Filter, RotateCcw } from "lucide-react"

type ChipOption<T extends string> = { value: T; label: string }

function FilterChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
              value === opt.value
                ? "border-primary-300 bg-primary-50 text-primary-800 shadow-sm"
                : "border-neutral-200/90 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface PatientFilterBarProps {
  filters: PatientListFilters
  onChange: (filters: PatientListFilters) => void
  className?: string
}

export function PatientFilterBar({ filters, onChange, className }: PatientFilterBarProps) {
  const { t } = useLocale()
  const activeCount = countActiveFilters(filters)

  const statusOptions: ChipOption<PatientStatusFilter>[] = [
    { value: "active", label: t("patients.filterActive", "Active") },
    { value: "inactive", label: t("patients.filterInactive", "Inactive") },
    { value: "all", label: t("patients.filterAllStatus", "All") },
  ]

  const visitOptions: ChipOption<PatientVisitFilter>[] = [
    { value: "all", label: t("patients.filterVisitAll", "Any time") },
    { value: "today", label: t("patients.filterVisitToday", "Today") },
    { value: "week", label: t("patients.filterVisitWeek", "7 days") },
    { value: "month", label: t("patients.filterVisitMonth", "30 days") },
    { value: "never", label: t("patients.filterVisitNever", "Never visited") },
    { value: "custom", label: t("patients.filterVisitCustom", "Custom") },
  ]

  const sortOptions: ChipOption<PatientSort>[] = [
    { value: "name", label: t("patients.sortName", "Name") },
    { value: "last_visit_desc", label: t("patients.sortLastVisitNew", "Last visit ↓") },
    { value: "last_visit_asc", label: t("patients.sortLastVisitOld", "Last visit ↑") },
  ]

  return (
    <aside
      className={cn(
        "space-y-5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-neutral-500 shadow-sm">
            <Filter className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {t("patients.filtersTitle", "Filters")}
            </p>
            {activeCount > 0 ? (
              <p className="text-xs text-neutral-500">
                {activeCount} {t("patients.filtersActive", "active")}
              </p>
            ) : null}
          </div>
        </div>
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-neutral-500"
            onClick={() => onChange(DEFAULT_PATIENT_LIST_FILTERS)}
          >
            <RotateCcw className="h-3 w-3" />
            {t("patients.filtersReset", "Reset")}
          </Button>
        ) : null}
      </div>

      <FilterChipGroup
        label={t("patients.filterStatus", "Status")}
        options={statusOptions}
        value={filters.status}
        onChange={(status) => onChange({ ...filters, status })}
      />

      <FilterChipGroup
        label={t("patients.filterLastVisit", "Last visit")}
        options={visitOptions}
        value={filters.visit}
        onChange={(visit) => onChange({ ...filters, visit })}
      />

      {filters.visit === "custom" ? (
        <div className="grid gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-neutral-500">
              {t("patients.filterFrom", "From")}
            </span>
            <Input
              type="date"
              value={filters.visitFrom}
              onChange={(e) => onChange({ ...filters, visitFrom: e.target.value })}
              className="h-9 bg-white text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-neutral-500">
              {t("patients.filterTo", "To")}
            </span>
            <Input
              type="date"
              value={filters.visitTo}
              onChange={(e) => onChange({ ...filters, visitTo: e.target.value })}
              className="h-9 bg-white text-sm"
            />
          </label>
        </div>
      ) : null}

      <FilterChipGroup
        label={t("patients.filterSort", "Sort")}
        options={sortOptions}
        value={filters.sort}
        onChange={(sort) => onChange({ ...filters, sort })}
      />

      <p className="flex items-start gap-2 border-t border-neutral-200/70 pt-3 text-[11px] leading-relaxed text-neutral-400">
        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("patients.filterTimezoneHint", "Visit dates use Asia/Manila (branch timezone).")}
      </p>
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-neutral-400">
        <ArrowDownAZ className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("patients.filterChairHint", "Chair flow is managed on Queue — not here.")}
      </p>
    </aside>
  )
}
