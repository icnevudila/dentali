import { createClient } from "@/lib/supabase/client"
import { checkInAppointment } from "@/lib/appointments/appointment-service"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

export type QueueStatus = "waiting" | "ready" | "now_serving" | "in_chair" | "served" | "cancelled"

export interface QueueEntry {
  id: string
  patient_id: string
  patient_name?: string
  patient_number?: string | null
  appointment_id: string | null
  encounter_id?: string | null
  provider_id?: string | null
  display_code: string
  status: QueueStatus
  chair_label: string | null
  notes: string | null
  checked_in_at: string
  called_at: string | null
  in_chair_at: string | null
  completed_at: string | null
  patient_mood?: string | null
}

export async function fetchQueueEntries(
  branchId: string,
  activeOnly = true
): Promise<{ data: QueueEntry[]; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id && activeOnly) {
    return { data: showcase.queueEntries, error: null }
  }

  const supabase = createClient()

  let query = supabase
    .from("queue_entries")
    .select(
      "id, patient_id, appointment_id, encounter_id, display_code, status, chair_label, notes, checked_in_at, called_at, in_chair_at, completed_at, patient_mood, patients(first_name, last_name, patient_number), appointments(provider_id)"
    )
    .eq("branch_id", branchId)
    .order("checked_in_at", { ascending: true })

  if (activeOnly) {
    query = query.in("status", ["waiting", "ready", "now_serving", "in_chair"])
  } else {
    query = query.in("status", ["served", "cancelled"])
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }

  const mapped = (data ?? []).map((row) => {
    const p = row.patients as
      | { first_name: string; last_name: string; patient_number?: string | null }
      | { first_name: string; last_name: string; patient_number?: string | null }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    const appt = row.appointments as { provider_id: string | null } | { provider_id: string | null }[] | null
    const appointment = Array.isArray(appt) ? appt[0] : appt
    return {
      id: row.id,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      patient_number: patient?.patient_number ?? null,
      appointment_id: row.appointment_id,
      encounter_id: (row as { encounter_id?: string | null }).encounter_id ?? null,
      provider_id: appointment?.provider_id ?? null,
      display_code: row.display_code,
      status: row.status as QueueStatus,
      chair_label: row.chair_label,
      notes: row.notes,
      checked_in_at: row.checked_in_at,
      called_at: row.called_at,
      in_chair_at: row.in_chair_at,
      completed_at: row.completed_at,
      patient_mood: row.patient_mood,
    } as QueueEntry
  })

  return { data: mapped, error: null }
}

/** All queue entries checked in on a Manila calendar day (any status). */
export async function fetchQueueEntriesForDay(
  branchId: string,
  dateKey: string
): Promise<{ data: QueueEntry[]; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    const day = new Date(dateKey).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
    const data = showcase.queueEntries.filter((entry) => {
      const entryDay = new Date(entry.checked_in_at).toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      })
      return entryDay === day
    })
    return { data, error: null }
  }

  const start = `${dateKey}T00:00:00+08:00`
  const end = `${dateKey}T23:59:59.999+08:00`

  const supabase = createClient()
  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      "id, patient_id, appointment_id, encounter_id, display_code, status, chair_label, notes, checked_in_at, called_at, in_chair_at, completed_at, patient_mood, patients(first_name, last_name, patient_number), appointments(provider_id)"
    )
    .eq("branch_id", branchId)
    .gte("checked_in_at", start)
    .lte("checked_in_at", end)
    .order("checked_in_at", { ascending: true })

  if (error) return { data: [], error: error.message }

  const mapped = (data ?? []).map((row) => {
    const p = row.patients as
      | { first_name: string; last_name: string; patient_number?: string | null }
      | { first_name: string; last_name: string; patient_number?: string | null }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    const appt = row.appointments as { provider_id: string | null } | { provider_id: string | null }[] | null
    const appointment = Array.isArray(appt) ? appt[0] : appt
    return {
      id: row.id,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      patient_number: patient?.patient_number ?? null,
      appointment_id: row.appointment_id,
      encounter_id: (row as { encounter_id?: string | null }).encounter_id ?? null,
      provider_id: appointment?.provider_id ?? null,
      display_code: row.display_code,
      status: row.status as QueueStatus,
      chair_label: row.chair_label,
      notes: row.notes,
      checked_in_at: row.checked_in_at,
      called_at: row.called_at,
      in_chair_at: row.in_chair_at,
      completed_at: row.completed_at,
      patient_mood: row.patient_mood,
    } as QueueEntry
  })

  return { data: mapped, error: null }
}

export async function checkInPatient(params: {
  branchId: string
  patientId: string
  appointmentId?: string
  notes?: string
  forceCheckin?: boolean
  forceBillingOverride?: boolean
  reuseEncounterId?: string
}): Promise<{
  data: { id: string; display_code: string; alreadyQueued?: boolean } | null
  error: string | null
}> {
  const supabase = createClient()
  const payload: Record<string, string | boolean> = {
    branch_id: params.branchId,
    patient_id: params.patientId,
    appointment_id: params.appointmentId ?? "",
    notes: params.notes ?? "",
    force_checkin: params.forceCheckin ?? false,
    force_billing_override: params.forceBillingOverride ?? false,
  }
  if (params.reuseEncounterId) {
    payload.reuse_encounter_id = params.reuseEncounterId
  }
  const { data, error } = await supabase.rpc("check_in_patient", {
    p_payload: payload,
  })

  if (error) {
    if (error.message.includes("already in the queue")) {
      const { data: active, error: activeError } = await fetchPatientActiveQueueEntry(
        params.patientId,
        params.branchId
      )
      if (!activeError && active) {
        return {
          data: {
            id: active.id,
            display_code: active.display_code,
            alreadyQueued: true,
          },
          error: null,
        }
      }
    }
    return { data: null, error: error.message }
  }
  const result = data as { id: string; display_code: string } | null
  return { data: result, error: null }
}

export async function reorderQueueBoard(
  branchId: string,
  orderedEntryIds: string[]
): Promise<{ error: string | null }> {
  if (orderedEntryIds.length === 0) return { error: null }
  const supabase = createClient()
  const { error } = await supabase.rpc("reorder_queue_board", {
    p_branch_id: branchId,
    p_ordered_entry_ids: orderedEntryIds,
  })
  return { error: error?.message ?? null }
}

export type QueueStatusUpdateResult = {
  soap_draft_id?: string | null
  invoice_draft_id?: string | null
}

export async function updateQueueStatus(
  entryId: string,
  status: QueueStatus,
  chairLabel?: string
): Promise<{ data: QueueStatusUpdateResult | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("update_queue_status", {
    p_entry_id: entryId,
    p_status: status,
    p_chair_label: chairLabel ?? null,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as QueueStatusUpdateResult | null
  return { data: raw, error: null }
}

export async function recallQueuePatient(
  entryId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("recall_queue_patient", {
    p_entry_id: entryId,
  })
  return { error: error?.message ?? null }
}

export async function callNextPatient(
  branchId: string
): Promise<{ data: { id: string; display_code: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("call_next_patient", { p_branch_id: branchId })

  if (error) return { data: null, error: error.message }
  const result = data as { found: boolean; id?: string; display_code?: string }
  if (!result.found) return { data: null, error: null }
  return { data: { id: result.id!, display_code: result.display_code! }, error: null }
}

export type PatientQueueVisit = {
  id: string
  display_code: string
  status: QueueStatus
  chair_label: string | null
  checked_in_at: string
  completed_at: string | null
  appointment_id: string | null
}

export async function fetchPatientQueueHistory(
  patientId: string,
  branchId?: string | null
): Promise<{ data: PatientQueueVisit[]; error: string | null }> {
  const supabase = createClient()
  let query = supabase
    .from("queue_entries")
    .select("id, display_code, status, chair_label, checked_in_at, completed_at, appointment_id")
    .eq("patient_id", patientId)
    .in("status", ["served", "cancelled", "in_chair", "now_serving"])
    .order("checked_in_at", { ascending: false })
    .limit(50)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PatientQueueVisit[], error: null }
}

export function waitMinutes(checkedInAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60_000))
}

/** Served visits checked in today (branch-local Manila calendar day). */
export async function fetchTodayServedCount(
  branchId: string
): Promise<{ count: number; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
    const count = showcase.queueEntries.filter((entry) => {
      if (entry.status !== "served") return false
      const day = new Date(entry.checked_in_at).toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      })
      return day === today
    }).length
    return { count, error: null }
  }

  const supabase = createClient()
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
  const start = `${today}T00:00:00+08:00`
  const end = `${today}T23:59:59.999+08:00`

  const { count, error } = await supabase
    .from("queue_entries")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("status", "served")
    .gte("checked_in_at", start)
    .lte("checked_in_at", end)

  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

const CHAIR_STATUSES: QueueStatus[] = ["now_serving", "in_chair"]

export async function fetchChairQueueEntries(
  branchId: string
): Promise<{ data: QueueEntry[]; error: string | null }> {
  const { data, error } = await fetchQueueEntries(branchId, true)
  if (error) return { data: [], error }
  return {
    data: data.filter((e) => CHAIR_STATUSES.includes(e.status)),
    error: null,
  }
}

export async function fetchActiveQueueEntryByAppointment(
  appointmentId: string
): Promise<{ data: QueueEntry | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      "id, patient_id, appointment_id, display_code, status, chair_label, notes, checked_in_at, called_at, in_chair_at, completed_at, patient_mood, patients(first_name, last_name, patient_number)"
    )
    .eq("appointment_id", appointmentId)
    .in("status", ["waiting", "ready", "now_serving", "in_chair"])
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  const p = data.patients as
    | { first_name: string; last_name: string; patient_number?: string | null }
    | { first_name: string; last_name: string; patient_number?: string | null }[]
    | null
  const patient = Array.isArray(p) ? p[0] : p

  return {
    data: {
      id: data.id,
      patient_id: data.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      patient_number: patient?.patient_number ?? null,
      appointment_id: data.appointment_id,
      display_code: data.display_code,
      status: data.status as QueueStatus,
      chair_label: data.chair_label,
      notes: data.notes,
      checked_in_at: data.checked_in_at,
      called_at: data.called_at,
      in_chair_at: data.in_chair_at,
      completed_at: data.completed_at,
      patient_mood: data.patient_mood,
    },
    error: null,
  }
}

export type CallToServeResult = {
  queue_id: string
  display_code: string
  auto_checked_in: boolean
}

/** Check in if needed, then move patient to now_serving (appears on dentist board). */
export async function callAppointmentToServe(
  appointmentId: string,
  options?: {
    forceBillingOverride?: boolean
    forceCheckin?: boolean
    reuseEncounterId?: string
  }
): Promise<{ data: CallToServeResult | null; error: string | null }> {
  const { data: existing, error: existingError } =
    await fetchActiveQueueEntryByAppointment(appointmentId)
  if (existingError) return { data: null, error: existingError }

  if (existing) {
    if (existing.status === "now_serving") {
      return {
        data: {
          queue_id: existing.id,
          display_code: existing.display_code,
          auto_checked_in: false,
        },
        error: null,
      }
    }
    const { error: serveError } = await updateQueueStatus(existing.id, "now_serving")
    if (serveError) return { data: null, error: serveError }
    return {
      data: {
        queue_id: existing.id,
        display_code: existing.display_code,
        auto_checked_in: false,
      },
      error: null,
    }
  }

  const { data: checkInData, error: checkInError } = await checkInAppointment(appointmentId, options)
  if (checkInError) {
    if (checkInError.includes("already in the queue")) {
      const supabase = createClient()
      const { data: appt, error: apptError } = await supabase
        .from("appointments")
        .select("patient_id, branch_id")
        .eq("id", appointmentId)
        .maybeSingle()
      if (apptError || !appt) return { data: null, error: checkInError }
      const { data: active, error: activeError } = await fetchPatientActiveQueueEntry(
        appt.patient_id,
        appt.branch_id
      )
      if (activeError || !active) return { data: null, error: checkInError }
      const { error: serveError } = await updateQueueStatus(active.id, "now_serving")
      if (serveError) return { data: null, error: serveError }
      return {
        data: {
          queue_id: active.id,
          display_code: active.display_code,
          auto_checked_in: false,
        },
        error: null,
      }
    }
    return { data: null, error: checkInError }
  }

  if (!checkInData) return { data: null, error: "Check-in failed" }

  const { error: serveError } = await updateQueueStatus(checkInData.queue_id, "now_serving")
  if (serveError) return { data: null, error: serveError }

  return {
    data: {
      queue_id: checkInData.queue_id,
      display_code: checkInData.display_code,
      auto_checked_in: true,
    },
    error: null,
  }
}

export async function fetchPatientActiveQueueEntry(
  patientId: string,
  branchId: string
): Promise<{ data: QueueEntry | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      "id, patient_id, appointment_id, display_code, status, chair_label, notes, checked_in_at, called_at, in_chair_at, completed_at, patient_mood, patients(first_name, last_name, patient_number)"
    )
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .in("status", ["waiting", "ready", "now_serving", "in_chair"])
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  const p = data.patients as
    | { first_name: string; last_name: string; patient_number?: string | null }
    | { first_name: string; last_name: string; patient_number?: string | null }[]
    | null
  const patient = Array.isArray(p) ? p[0] : p

  return {
    data: {
      id: data.id,
      patient_id: data.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      patient_number: patient?.patient_number ?? null,
      appointment_id: data.appointment_id,
      display_code: data.display_code,
      status: data.status as QueueStatus,
      chair_label: data.chair_label,
      notes: data.notes,
      checked_in_at: data.checked_in_at,
      called_at: data.called_at,
      in_chair_at: data.in_chair_at,
      completed_at: data.completed_at,
      patient_mood: data.patient_mood,
    },
    error: null,
  }
}
