import {
  ensureProviderAvailabilityDefaults,
  fetchAvailableAppointmentSlots,
  type AppointmentSlot,
} from "@/lib/appointments/provider-availability-service"

export async function fetchPreparedAppointmentSlots(params: {
  branchId: string
  providerId: string
  date: string
  excludeAppointmentId?: string
}): Promise<{ data: AppointmentSlot[]; error: string | null }> {
  const { error: ensureError } = await ensureProviderAvailabilityDefaults(
    params.branchId,
    params.providerId
  )
  if (ensureError) {
    return { data: [], error: ensureError }
  }

  return fetchAvailableAppointmentSlots(params)
}

export function pickDefaultSlotTime(
  slots: AppointmentSlot[],
  preferred?: string,
  currentEditable?: string,
  date?: string
): string {
  const usableSlots = date
    ? slots.filter((slot) => !isPastManilaSlot(date, slot.time) || slot.time === currentEditable)
    : slots

  if (
    preferred &&
    usableSlots.some(
      (slot) =>
        slot.time === preferred && (slot.available || slot.time === currentEditable)
    )
  ) {
    return preferred
  }
  return usableSlots.find((slot) => slot.available)?.time ?? ""
}

export function manilaScheduledAtIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}

export function isPastManilaSlot(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00+08:00`).getTime() < Date.now()
}
