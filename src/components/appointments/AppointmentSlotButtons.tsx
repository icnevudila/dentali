"use client"

import { useLocale } from "@/hooks/use-locale"
import { isPastManilaSlot } from "@/lib/appointments/appointment-slots"
import type { AppointmentSlot } from "@/lib/appointments/provider-availability-service"
import { cn } from "@/lib/utils"

/** Portal-style slot grid: shows open + full slots; only open slots are selectable. */
export function AppointmentSlotButtons({
  slots,
  selectedTime,
  onSelect,
  currentTime,
  date,
  disablePast = true,
  loading,
  emptyMessage,
}: {
  slots: AppointmentSlot[]
  selectedTime: string
  onSelect: (time: string) => void
  currentTime?: string
  date?: string
  disablePast?: boolean
  loading?: boolean
  emptyMessage?: string
}) {
  const { t } = useLocale()

  if (loading) {
    return <p className="text-xs text-neutral-500">{t("common.loading", "Loading…")}</p>
  }

  if (slots.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        {emptyMessage ?? t("appointments.noSlotsBook", "No available times on the selected date.")}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const isCurrent = currentTime === slot.time
        const isPast = Boolean(date && disablePast && isPastManilaSlot(date, slot.time) && !isCurrent)
        const selectable = (slot.available || isCurrent) && !isPast
        const isSelected = selectedTime === slot.time

        return (
          <button
            key={slot.time}
            type="button"
            disabled={!selectable}
            onClick={() => onSelect(slot.time)}
            className={cn(
              "rounded-xl py-2.5 text-sm font-bold transition-all",
              !selectable &&
                "cursor-not-allowed border border-transparent bg-neutral-100 text-neutral-400 opacity-50",
              selectable &&
                !isSelected &&
                "cursor-pointer border-2 border-transparent bg-white text-neutral-700 hover:border-primary-100 hover:bg-neutral-50",
              selectable &&
                isSelected &&
                "border-transparent bg-primary-600 text-white shadow-md shadow-primary-500/20"
            )}
          >
            {slot.time}
            {isPast ? (
              <span className="ml-1 text-[10px] font-normal opacity-70">
                ({t("appointments.slotPast", "Past")})
              </span>
            ) : !slot.available && !isCurrent ? (
              <span className="ml-1 text-[10px] font-normal opacity-70">
                ({t("appointments.slotFull", "Full")})
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
