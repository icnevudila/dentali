"use client"

import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import {
  bookingSourceBadgeVariant,
  bookingSourceLabel,
  resolveBookingSource,
} from "@/lib/appointments/booking-source"
import type { AppointmentRecord } from "@/lib/appointments/types"

export function AppointmentBookingBadge({
  appointment,
  className,
}: {
  appointment: Pick<AppointmentRecord, "booking_source" | "purpose">
  className?: string
}) {
  const { t } = useLocale()
  const source = resolveBookingSource(appointment)
  if (source === "staff") return null

  return (
    <Badge variant={bookingSourceBadgeVariant(source)} className={className}>
      {bookingSourceLabel(source, t)}
    </Badge>
  )
}
