"use client"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { DentistBoardFilter } from "@/lib/clinical/dentist-board"
import type { StaffMember } from "@/lib/staff/staff-service"
import { cn } from "@/lib/utils"
import { Filter, RotateCcw, UserRound } from "lucide-react"

type ChipOption = { value: DentistBoardFilter; label: string }

interface DentistFilterBarProps {
  filter: DentistBoardFilter
  onChange: (filter: DentistBoardFilter) => void
  providers?: StaffMember[]
  providerId?: string | null
  onProviderChange?: (providerId: string | null) => void
  providerLocked?: boolean
  className?: string
}

export function DentistFilterBar({
  filter,
  onChange,
  providers = [],
  providerId = null,
  onProviderChange,
  providerLocked = false,
  className,
}: DentistFilterBarProps) {
  const { t } = useLocale()
  const isDefault = filter === "all" && !providerId

  const statusOptions: ChipOption[] = [
    { value: "all", label: t("dentist.filterAll", "All in clinic") },
    { value: "in_chair", label: t("dentist.filterInChair", "In chair") },
    { value: "now_serving", label: t("dentist.filterServing", "Called") },
    { value: "waiting", label: t("dentist.filterWaiting", "Waiting") },
    { value: "served", label: t("dentist.filterServed", "Completed today") },
  ]

  const showProviderFilter = providers.length > 0 && onProviderChange

  return (
    <aside
      className={cn(
        "space-y-4 rounded-xl border border-neutral-200/80 bg-neutral-50/40 p-4",
        className
      )}
      aria-label={t("dentist.filterLabel", "Queue status")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          {t("dentist.filterLabel", "Queue status")}
        </div>
        {!isDefault ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-neutral-500"
            onClick={() => {
              onChange("all")
              onProviderChange?.(null)
            }}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t("dentist.resetFilters", "Reset")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 xl:flex-col xl:items-stretch">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors duration-150",
              filter === opt.value
                ? "border-primary-300 bg-primary-50 text-primary-800 shadow-sm"
                : "border-neutral-200/90 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showProviderFilter ? (
        <div className="space-y-2 border-t border-neutral-200/80 pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {t("dentist.providerFilterLabel", "Doctor")}
          </div>
          <select
            value={providerId ?? ""}
            disabled={providerLocked}
            onChange={(e) => onProviderChange(e.target.value || null)}
            className={cn(
              "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-medium text-neutral-800",
              providerLocked && "cursor-not-allowed opacity-70"
            )}
          >
            {!providerLocked ? (
              <option value="">{t("dentist.providerAll", "All doctors")}</option>
            ) : null}
            {providers.map((provider) => (
              <option key={provider.profile_id} value={provider.profile_id}>
                {provider.full_name ?? provider.email ?? provider.profile_id}
              </option>
            ))}
          </select>
          {providerLocked ? (
            <p className="text-[11px] text-neutral-500">
              {t("dentist.providerLockedHint", "Showing only your patients in today's queue.")}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
