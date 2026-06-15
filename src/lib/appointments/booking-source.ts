import type { AppointmentRecord, BookingSource } from "@/lib/appointments/types"

export type { BookingSource }

export function resolveBookingSource(appt: Pick<AppointmentRecord, "booking_source" | "purpose">): BookingSource {
  if (appt.booking_source) return appt.booking_source as BookingSource
  const purpose = (appt.purpose ?? "").toLowerCase()
  if (purpose.includes("portal") || purpose.includes("online")) return "portal"
  if (purpose.includes("kiosk")) return "kiosk"
  return "staff"
}

export function bookingSourceLabel(
  source: BookingSource,
  t: (key: string, fallback: string) => string
): string {
  switch (source) {
    case "portal":
      return t("appointments.sourcePortal", "Online")
    case "kiosk":
      return t("appointments.sourceKiosk", "Kiosk")
    case "walk_in":
      return t("appointments.sourceWalkIn", "Walk-in")
    case "phone":
      return t("appointments.sourcePhone", "Phone")
    default:
      return t("appointments.sourceStaff", "Clinic")
  }
}

export function bookingSourceBadgeVariant(
  source: BookingSource
): "info" | "outline" | "warning" | "default" {
  switch (source) {
    case "portal":
      return "info"
    case "kiosk":
      return "warning"
    case "walk_in":
      return "outline"
    default:
      return "default"
  }
}
