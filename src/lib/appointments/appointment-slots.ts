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
  currentEditable?: string
): string {
  if (
    preferred &&
    slots.some(
      (slot) =>
        slot.time === preferred && (slot.available || slot.time === currentEditable)
    )
  ) {
    return preferred
  }
  return slots.find((slot) => slot.available)?.time ?? ""
}

export function manilaScheduledAtIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}
