"use client"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { AppointmentSlot } from "@/lib/appointments/provider-availability-service"

export function AppointmentSlotButtons({
  slots,
  selectedTime,
  onSelect,
  currentTime,
  loading,
  emptyMessage,
}: {
  slots: AppointmentSlot[]
  selectedTime: string
  onSelect: (time: string) => void
  currentTime?: string
  loading?: boolean
  emptyMessage?: string
}) {
  const { t } = useLocale()

  if (loading) {
    return <p className="text-xs text-neutral-500">{t("common.loading", "Loading…")}</p>
  }

  if (slots.length === 0) {
    return (
      <p className="text-xs text-amber-700">
        {emptyMessage ?? t("appointments.noSlotsEdit", "No slots available for this day.")}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => {
        const isCurrent = currentTime === slot.time
        const selectable = slot.available || isCurrent
        return (
          <Button
            key={slot.time}
            type="button"
            size="sm"
            variant={selectedTime === slot.time ? "default" : "outline"}
            disabled={!selectable}
            onClick={() => onSelect(slot.time)}
            className={!slot.available && !isCurrent ? "opacity-60" : undefined}
          >
            {slot.time}
            {!slot.available && !isCurrent ? (
              <span className="ml-1 text-[10px] font-normal opacity-80">
                ({t("appointments.slotFull", "Full")})
              </span>
            ) : null}
          </Button>
        )
      })}
    </div>
  )
}
