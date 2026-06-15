import {
  ensureProviderAvailabilityDefaults,
  fetchAvailableAppointmentSlots,
  type AppointmentSlot,
} from "@/lib/appointments/provider-availability-service"

export function withCurrentAppointmentSlot(
  slots: AppointmentSlot[],
  currentTime?: string
): AppointmentSlot[] {
  if (!currentTime || slots.some((slot) => slot.time === currentTime)) return slots
  return [...slots, { time: currentTime, available: true }].sort((a, b) =>
    a.time.localeCompare(b.time)
  )
}

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

  const { data, error } = await fetchAvailableAppointmentSlots(params)
  if (error) {
    return { data: [], error }
  }

  if (data.length > 0) {
    return { data, error: null }
  }

  const retry = await fetchAvailableAppointmentSlots(params)
  return { data: retry.data, error: retry.error }
}

export function manilaScheduledAtIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}
