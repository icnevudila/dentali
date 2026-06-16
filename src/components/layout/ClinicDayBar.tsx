"use client"

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import { useClinicDay } from "@/hooks/use-clinic-day"
import { cn } from "@/lib/utils"

type ClinicDayBarProps = {
  className?: string
  /** Hide when only live today view is meaningful (unused — bar always shows context). */
  compareHint?: string | null
}

export function ClinicDayBar({ className, compareHint }: ClinicDayBarProps) {
  const { t } = useLocale()
  const {
    clinicDay,
    today,
    isToday,
    canGoForward,
    formattedDay,
    setClinicDay,
    goToday,
    goYesterday,
    shiftDay,
  } = useClinicDay()

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <span className="text-sm font-medium text-neutral-900">
          {t("clinicDay.label", "Clinic day")}
        </span>
        {isToday ? (
          <Badge variant="success" className="font-normal">
            {t("clinicDay.today", "Today")}
          </Badge>
        ) : (
          <Badge variant="warning" className="font-normal">
            {t("clinicDay.pastView", "Past day")}
          </Badge>
        )}
        <span className="text-sm text-neutral-500">{formattedDay}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={t("clinicDay.prevDay", "Previous day")}
          onClick={() => shiftDay(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={clinicDay}
          max={today}
          onChange={(e) => {
            const value = e.target.value
            if (!value) return
            setClinicDay(value)
          }}
          className="h-8 w-[9.5rem] text-sm"
          aria-label={t("clinicDay.pickDate", "Pick a date")}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={t("clinicDay.nextDay", "Next day")}
          disabled={!canGoForward}
          onClick={() => shiftDay(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isToday ? "default" : "outline"}
          size="sm"
          onClick={goToday}
        >
          {t("clinicDay.goToday", "Today")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={goYesterday}>
          {t("clinicDay.goYesterday", "Yesterday")}
        </Button>
      </div>

      {compareHint ? (
        <p className="w-full text-xs text-neutral-500 sm:order-last">{compareHint}</p>
      ) : null}
    </div>
  )
}
