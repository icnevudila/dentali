import { createClient } from "@/lib/supabase/client"

export type EncounterStatus = "open" | "closed" | "cancelled"
export type EncounterSourceType = "appointment" | "walk_in"

export type PatientEncounterSummary = {
  id: string
  display_code: string | null
  source_type: EncounterSourceType
  status: EncounterStatus
  opened_at: string
  closed_at: string | null
  appointment_id: string | null
  queue_entry_id: string | null
  branch_id: string
  queue_status: string | null
  queue_code: string | null
  note_count: number
  plan_count: number
  invoice_count: number
}

export type EncounterQueueRow = {
  id: string
  status: string
  display_code: string
  chair_label: string | null
  checked_in_at: string
  completed_at: string | null
  in_chair_at: string | null
  called_at: string | null
}

export type EncounterNoteRow = {
  id: string
  title: string
  status: string
  signed_at: string | null
  created_at: string
}

export type EncounterPlanRow = {
  id: string
  title: string
  status: string
  total_estimated: number
  approved_at: string | null
  created_at: string
}

export type EncounterInvoiceRow = {
  id: string
  invoice_number: string | null
  status: string
  total_amount: number
  paid_amount: number
  created_at: string
}

export type PatientEncounterDetail = {
  encounter: {
    id: string
    display_code: string | null
    source_type: EncounterSourceType
    status: EncounterStatus
    opened_at: string
    closed_at: string | null
    patient_id: string
    branch_id: string
    appointment_id: string | null
    queue_entry_id: string | null
  }
  queue: EncounterQueueRow | null
  appointment: Record<string, unknown> | null
  notes: EncounterNoteRow[]
  plans: EncounterPlanRow[]
  invoices: EncounterInvoiceRow[]
}

export async function fetchPatientEncounters(
  patientId: string,
  branchId?: string | null,
  limit = 50
): Promise<{ data: PatientEncounterSummary[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_encounters", {
    p_patient_id: patientId,
    p_branch_id: branchId ?? null,
    p_limit: limit,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PatientEncounterSummary[], error: null }
}

export async function fetchEncounterDetail(
  encounterId: string
): Promise<{ data: PatientEncounterDetail | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_encounter_detail", {
    p_encounter_id: encounterId,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as PatientEncounterDetail, error: null }
}

export async function fetchActiveEncounter(
  patientId: string,
  branchId: string
): Promise<{ data: PatientEncounterDetail | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_active_patient_encounter", {
    p_patient_id: patientId,
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: data as PatientEncounterDetail, error: null }
}

export async function closePatientEncounter(
  encounterId: string
): Promise<{ data: { id: string; status: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("close_patient_encounter", {
    p_encounter_id: encounterId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { id: string; status: string }
  return { data: raw, error: null }
}

export async function linkNoteToEncounter(
  noteId: string,
  encounterId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("clinical_notes")
    .update({ encounter_id: encounterId })
    .eq("id", noteId)
  return { error: error?.message ?? null }
}

export function encounterPublicId(encounter: { id: string; display_code?: string | null }) {
  if (encounter.display_code) return encounter.display_code
  return `VIS-${encounter.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}
