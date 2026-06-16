import { createClient } from "@/lib/supabase/client"

export interface TimelineEvent {
  event_type: "clinical_note" | "appointment"
  event_id: string
  occurred_at: string
  title: string
  subtitle: string | null
  status: string
  metadata: Record<string, unknown>
}

export interface ClinicalNote {
  id: string
  patient_id: string
  branch_id: string
  appointment_id: string | null
  title: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  body: string | null
  status: "draft" | "signed"
  version: number
  signed_at: string | null
  created_at: string
  updated_at: string
  author_name?: string | null
}

export async function fetchPatientTimeline(
  patientId: string
): Promise<{ data: TimelineEvent[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_timeline", {
    p_patient_id: patientId,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as TimelineEvent[], error: null }
}

export async function getClinicalNote(
  noteId: string
): Promise<{ data: ClinicalNote | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clinical_notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle()

  if (error || !data) return { data: null, error: error?.message ?? "Note not found" }
  return { data: data as ClinicalNote, error: null }
}

export async function createClinicalNote(params: {
  patientId: string
  organizationId: string
  branchId: string
  userId: string
  title?: string
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  body?: string
  appointmentId?: string | null
  encounterId?: string | null
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clinical_notes")
    .insert({
      patient_id: params.patientId,
      organization_id: params.organizationId,
      branch_id: params.branchId,
      appointment_id: params.appointmentId ?? null,
      encounter_id: params.encounterId ?? null,
      title: params.title?.trim() || "Clinical Note",
      subjective: params.subjective || null,
      objective: params.objective || null,
      assessment: params.assessment || null,
      plan: params.plan || null,
      body: params.body || null,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed to create note" }
  return { data: { id: data.id }, error: null }
}

export async function updateClinicalNote(
  noteId: string,
  userId: string,
  fields: {
    title?: string
    subjective?: string
    objective?: string
    assessment?: string
    plan?: string
    body?: string
  }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("clinical_notes")
    .update({
      ...fields,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("status", "draft")

  return { error: error?.message ?? null }
}

export async function signClinicalNote(
  noteId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("sign_clinical_note", { p_note_id: noteId })
  return { error: error?.message ?? null }
}
