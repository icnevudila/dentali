import { createClient } from "@/lib/supabase/client"
import { appointmentDateKey } from "@/lib/appointments/week-calendar"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

export type { AppointmentRecord } from "@/lib/appointments/types"

export async function fetchPatientAppointments(
  patientId: string
): Promise<{ data: AppointmentRecord[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_appointments", {
    p_patient_id: patientId,
    p_limit: 20,
  })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as AppointmentRecord[], error: null }
}

function filterShowcaseAppointments(
  appointments: AppointmentRecord[],
  startDate?: string,
  endDate?: string,
  dayDate?: string
): AppointmentRecord[] {
  if (dayDate) {
    return appointments.filter((a) => appointmentDateKey(a.scheduled_at) === dayDate)
  }
  if (startDate && endDate) {
    return appointments.filter((a) => {
      const key = appointmentDateKey(a.scheduled_at)
      return key >= startDate && key <= endDate
    })
  }
  return appointments
}

export async function fetchAppointments(
  branchId: string,
  date?: string
): Promise<{ data: AppointmentRecord[]; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    return {
      data: filterShowcaseAppointments(showcase.appointments, undefined, undefined, date),
      error: null,
    }
  }

  if (date) {
    const { data, error } = await fetchDaySchedule(branchId, date)
    return { data, error }
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, purpose, status, patient_id, provider_id, booking_source, patients(first_name, last_name)")
    .eq("branch_id", branchId)
    .order("scheduled_at", { ascending: true })

  if (error) return { data: [], error: error.message }

  const mapped = (data ?? []).map((row) => {
    const p = row.patients as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      scheduled_at: row.scheduled_at,
      purpose: row.purpose,
      status: row.status,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      provider_id: row.provider_id,
      booking_source: row.booking_source ?? null,
    }
  })

  return { data: mapped, error: null }
}

export interface DayScheduleSummary {
  total: number
  scheduled: number
  completed: number
  cancelled: number
  no_show: number
}

export async function fetchDaySchedule(
  branchId: string,
  date: string
): Promise<{ data: AppointmentRecord[]; summary: DayScheduleSummary | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_day_schedule", {
    p_branch_id: branchId,
    p_date: date,
  })

  if (error) return { data: [], summary: null, error: error.message }

  const raw = data as { appointments?: AppointmentRecord[]; summary?: DayScheduleSummary }
  return {
    data: raw.appointments ?? [],
    summary: raw.summary ?? null,
    error: null,
  }
}

export async function fetchAppointmentsRange(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<{ data: AppointmentRecord[]; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    return {
      data: filterShowcaseAppointments(showcase.appointments, startDate, endDate),
      error: null,
    }
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, purpose, status, patient_id, provider_id, booking_source, patients(first_name, last_name)")
    .eq("branch_id", branchId)
    .gte("scheduled_at", `${startDate}T00:00:00+08:00`)
    .lte("scheduled_at", `${endDate}T23:59:59+08:00`)
    .order("scheduled_at", { ascending: true })

  if (error) return { data: [], error: error.message }

  const mapped = (data ?? []).map((row) => {
    const p = row.patients as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      scheduled_at: row.scheduled_at,
      purpose: row.purpose,
      status: row.status,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      provider_id: row.provider_id,
      booking_source: row.booking_source ?? null,
    }
  })

  return { data: mapped, error: null }
}

export async function rescheduleAppointment(
  appointmentId: string,
  scheduledAt: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_scheduled_at: scheduledAt,
  })
  return { error: error?.message ?? null }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_appointment_status", {
    p_appointment_id: appointmentId,
    p_status: status,
  })
  return { error: error?.message ?? null }
}

export async function updateAppointmentDetails(
  appointmentId: string,
  params: {
    providerId?: string | null
    purpose?: string
    durationMinutes?: number
  }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const payload: Record<string, string | number | null> = {}
  if (params.providerId !== undefined) payload.provider_id = params.providerId
  if (params.purpose !== undefined) payload.purpose = params.purpose
  if (params.durationMinutes !== undefined) payload.duration_minutes = params.durationMinutes

  const { error } = await supabase.rpc("update_appointment_details", {
    p_appointment_id: appointmentId,
    p_payload: payload,
  })
  return { error: error?.message ?? null }
}

export async function markAppointmentNoShow(
  appointmentId: string
): Promise<{ data: { scheduled_at: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("mark_appointment_no_show", {
    p_appointment_id: appointmentId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { scheduled_at: string }
  return { data: { scheduled_at: raw.scheduled_at }, error: null }
}

export async function fetchAppointmentScheduledAt(
  appointmentId: string
): Promise<{ data: { scheduled_at: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("id", appointmentId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: { scheduled_at: data.scheduled_at }, error: null }
}

/** Runs on queue page load — no extra Vercel/Supabase cron. */
export async function autoNoShowForBranch(
  branchId: string,
  graceMinutes = 15
): Promise<{ data: { marked: number; skipped: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("auto_no_show_for_branch", {
    p_branch_id: branchId,
    p_grace_minutes: graceMinutes,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { marked: number; skipped: number }
  return { data: raw, error: null }
}

export async function createAppointment(params: {
  organizationId: string
  branchId: string
  patientId: string
  scheduledAt: string
  purpose: string
  userId: string
  providerId?: string
  durationMinutes?: number
  bookingSource?: "staff" | "portal" | "kiosk" | "phone" | "walk_in"
  forceBillingOverride?: boolean
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_appointment_validated", {
    p_payload: {
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      provider_id: params.providerId ?? "",
      scheduled_at: params.scheduledAt,
      purpose: params.purpose,
      duration_minutes: params.durationMinutes ?? 30,
      booking_source: params.bookingSource ?? "staff",
      force_billing_override: params.forceBillingOverride ?? false,
    },
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { id: string }
  return { data: { id: raw.id }, error: null }
}

export async function checkInAppointment(
  appointmentId: string,
  options?: {
    forceBillingOverride?: boolean
    forceCheckin?: boolean
    reuseEncounterId?: string
  }
): Promise<{
  data: { queue_id: string; display_code: string; encounter_id?: string | null } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("check_in_appointment", {
    p_appointment_id: appointmentId,
    p_force_billing_override: options?.forceBillingOverride ?? false,
    p_force_checkin: options?.forceCheckin ?? false,
    p_reuse_encounter_id: options?.reuseEncounterId ?? null,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { queue_id: string; display_code: string; encounter_id?: string | null }
  return {
    data: {
      queue_id: raw.queue_id,
      display_code: raw.display_code,
      encounter_id: raw.encounter_id ?? null,
    },
    error: null,
  }
}
