import { createClient } from "@/lib/supabase/client"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

export type QueueStatus = "waiting" | "ready" | "now_serving" | "in_chair" | "served" | "cancelled"

export interface QueueEntry {
  id: string
  patient_id: string
  patient_name?: string
  appointment_id: string | null
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
      "id, patient_id, appointment_id, display_code, status, chair_label, notes, checked_in_at, called_at, in_chair_at, completed_at, patient_mood, patients(first_name, last_name)"
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
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      appointment_id: row.appointment_id,
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
}): Promise<{ data: { id: string; display_code: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("check_in_patient", {
    p_payload: {
      branch_id: params.branchId,
      patient_id: params.patientId,
      appointment_id: params.appointmentId ?? "",
      notes: params.notes ?? "",
      force_checkin: params.forceCheckin ?? false,
    },
  })

  if (error) return { data: null, error: error.message }
  const result = data as { id: string; display_code: string } | null
  return { data: result, error: null }
}

export async function updateQueueStatus(
  entryId: string,
  status: QueueStatus,
  chairLabel?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_queue_status", {
    p_entry_id: entryId,
    p_status: status,
    p_chair_label: chairLabel ?? null,
  })
  return { error: error?.message ?? null }
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
