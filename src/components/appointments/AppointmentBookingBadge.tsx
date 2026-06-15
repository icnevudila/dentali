"use client"

import { Badge } from "@/components/ui/badge"
import { Globe } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import {
  bookingSourceBadgeVariant,
  bookingSourceLabel,
  resolveBookingSource,
} from "@/lib/appointments/booking-source"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { cn } from "@/lib/utils"

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
    <Badge variant={bookingSourceBadgeVariant(source)} className={cn("gap-0.5", className)}>
      {source === "portal" ? <Globe className="h-2.5 w-2.5 shrink-0" aria-hidden /> : null}
      {bookingSourceLabel(source, t)}
    </Badge>
  )
}
