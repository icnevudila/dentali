"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { Calendar } from "lucide-react"

interface DentistUpcomingSectionProps {
  upcoming: AppointmentRecord[]
  loading: boolean
}

export function DentistUpcomingSection({ upcoming, loading }: DentistUpcomingSectionProps) {
  const { t, locale } = useLocale()

  return (
    <section className="space-y-3 border-t border-neutral-100 pt-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-neutral-400" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
          {t("dentist.sectionArriving", "Arriving today — not checked in yet")}
          {!loading ? ` (${upcoming.length})` : ""}
        </h2>
      </div>

      {loading ? (
        <div className="h-14 rounded-xl border border-dashed border-neutral-200 animate-shimmer" />
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t("dentist.noUpcoming", "No more scheduled visits waiting for check-in today.")}
        </p>
      ) : (
        <div className="space-y-2" role="list">
          {upcoming.map((appt, index) => {
            const time = formatDate(locale, appt.scheduled_at, {
              hour: "numeric",
              minute: "2-digit",
            })
            const name = appt.patient_name ?? t("dentist.unknownPatient", "Patient")

            return (
              <div
                key={appt.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-3 py-3 sm:px-4 animate-stagger-item"
                style={{ "--stagger-index": index } as CSSProperties}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-neutral-800">{time}</span>
                    <span className="truncate font-medium text-neutral-900">{name}</span>
                    <Badge variant="outline" className="font-normal text-[10px]">
                      {appt.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {appt.purpose ? (
                    <p className="mt-0.5 truncate text-sm text-neutral-500">{appt.purpose}</p>
                  ) : null}
                </div>
                <Button asChild size="sm" variant="ghost" className="shrink-0 text-xs">
                  <Link href={`/patients/${appt.patient_id}`}>{t("dentist.openProfile", "Profile")}</Link>
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
