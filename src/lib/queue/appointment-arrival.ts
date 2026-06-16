import type { AppointmentRecord } from "@/lib/appointments/types"

const MANILA_TZ = "Asia/Manila"

export type ArrivalBucket = "overdue" | "due_now" | "upcoming"

export type ClassifiedAppointment = {
  appointment: AppointmentRecord
  bucket: ArrivalBucket
  minutesUntil: number
}

export function classifyAppointmentArrival(
  appointment: AppointmentRecord,
  now = new Date(),
  graceMinutes = 15
): ClassifiedAppointment {
  const scheduledMs = new Date(appointment.scheduled_at).getTime()
  const nowMs = now.getTime()
  const diffMin = Math.round((scheduledMs - nowMs) / 60_000)

  if (diffMin < -graceMinutes) {
    return { appointment, bucket: "overdue", minutesUntil: diffMin }
  }
  if (diffMin <= 0) {
    return { appointment, bucket: "due_now", minutesUntil: diffMin }
  }
  return { appointment, bucket: "upcoming", minutesUntil: diffMin }
}

export function classifyTodayArrivals(
  appointments: AppointmentRecord[],
  now = new Date(),
  graceMinutes = 15
): {
  overdue: ClassifiedAppointment[]
  dueNow: ClassifiedAppointment[]
  upcoming: ClassifiedAppointment[]
} {
  const classified = appointments.map((a) =>
    classifyAppointmentArrival(a, now, graceMinutes)
  )

  const sortByTime = (a: ClassifiedAppointment, b: ClassifiedAppointment) =>
    new Date(a.appointment.scheduled_at).getTime() -
    new Date(b.appointment.scheduled_at).getTime()

  return {
    overdue: classified.filter((c) => c.bucket === "overdue").sort(sortByTime),
    dueNow: classified.filter((c) => c.bucket === "due_now").sort(sortByTime),
    upcoming: classified.filter((c) => c.bucket === "upcoming").sort(sortByTime),
  }
}

export function formatArrivalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
}
