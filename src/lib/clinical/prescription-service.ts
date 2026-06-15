import { createClient } from "@/lib/supabase/client"

export interface PrescriptionItem {
  id?: string
  drug_name: string
  strength: string | null
  dosage: string | null
  frequency: string | null
  duration: string | null
  quantity: string | null
  instructions: string | null
  sort_order: number
}

export interface PrescriptionRecord {
  id: string
  patient_id: string
  branch_id: string
  status: "draft" | "signed" | "voided"
  diagnosis: string | null
  general_instructions: string | null
  signed_at: string | null
  voided_at: string | null
  void_reason: string | null
  prescriber_id: string | null
  created_at: string
  prescriber_name?: string
  items?: PrescriptionItem[]
}

export const COMMON_DENTAL_MEDS = [
  { drug_name: "Amoxicillin", strength: "500 mg", dosage: "1 capsule", frequency: "3x daily", duration: "7 days" },
  { drug_name: "Metronidazole", strength: "400 mg", dosage: "1 tablet", frequency: "3x daily", duration: "7 days" },
  { drug_name: "Ibuprofen", strength: "400 mg", dosage: "1 tablet", frequency: "Every 6 hours PRN", duration: "3 days" },
  { drug_name: "Mefenamic Acid", strength: "500 mg", dosage: "1 capsule", frequency: "Every 8 hours PRN", duration: "3 days" },
  { drug_name: "Chlorhexidine mouthwash", strength: "0.12%", dosage: "15 ml rinse", frequency: "2x daily", duration: "7 days" },
  { drug_name: "Paracetamol", strength: "500 mg", dosage: "1 tablet", frequency: "Every 6 hours PRN", duration: "3 days" },
] as const

export async function fetchPatientPrescriptions(
  patientId: string,
  branchId: string
): Promise<{ data: PrescriptionRecord[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      "id, patient_id, branch_id, status, diagnosis, general_instructions, signed_at, voided_at, void_reason, prescriber_id, created_at, profiles:prescriber_id(full_name)"
    )
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => {
      const p = row.profiles as { full_name: string } | { full_name: string }[] | null
      const profile = Array.isArray(p) ? p[0] : p
      return {
        id: row.id,
        patient_id: row.patient_id,
        branch_id: row.branch_id,
        status: row.status as PrescriptionRecord["status"],
        diagnosis: row.diagnosis,
        general_instructions: row.general_instructions,
        signed_at: row.signed_at,
        voided_at: row.voided_at,
        void_reason: row.void_reason,
        prescriber_id: row.prescriber_id,
        created_at: row.created_at,
        prescriber_name: profile?.full_name,
      }
    }),
    error: null,
  }
}

export async function getPrescription(
  prescriptionId: string
): Promise<{ data: PrescriptionRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data: rx, error } = await supabase
    .from("prescriptions")
    .select(
      "id, patient_id, branch_id, status, diagnosis, general_instructions, signed_at, voided_at, void_reason, prescriber_id, created_at, profiles:prescriber_id(full_name)"
    )
    .eq("id", prescriptionId)
    .maybeSingle()

  if (error || !rx) return { data: null, error: error?.message ?? "Not found" }

  const { data: items } = await supabase
    .from("prescription_items")
    .select("id, drug_name, strength, dosage, frequency, duration, quantity, instructions, sort_order")
    .eq("prescription_id", prescriptionId)
    .order("sort_order")

  const p = rx.profiles as { full_name: string } | { full_name: string }[] | null
  const profile = Array.isArray(p) ? p[0] : p

  return {
    data: {
      id: rx.id,
      patient_id: rx.patient_id,
      branch_id: rx.branch_id,
      status: rx.status as PrescriptionRecord["status"],
      diagnosis: rx.diagnosis,
      general_instructions: rx.general_instructions,
      signed_at: rx.signed_at,
      voided_at: rx.voided_at,
      void_reason: rx.void_reason,
      prescriber_id: rx.prescriber_id,
      created_at: rx.created_at,
      prescriber_name: profile?.full_name,
      items: (items ?? []).map((item) => ({
        id: item.id,
        drug_name: item.drug_name,
        strength: item.strength,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
        sort_order: item.sort_order,
      })),
    },
    error: null,
  }
}

export async function savePrescriptionDraft(params: {
  id?: string
  organizationId: string
  branchId: string
  patientId: string
  diagnosis?: string
  generalInstructions?: string
  items: Omit<PrescriptionItem, "id" | "sort_order">[]
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("upsert_prescription_draft", {
    p_payload: {
      id: params.id ?? null,
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      diagnosis: params.diagnosis ?? "",
      general_instructions: params.generalInstructions ?? "",
      items: params.items.map((item) => ({
        drug_name: item.drug_name,
        strength: item.strength ?? "",
        dosage: item.dosage ?? "",
        frequency: item.frequency ?? "",
        duration: item.duration ?? "",
        quantity: item.quantity ?? "",
        instructions: item.instructions ?? "",
      })),
    },
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { id: string }
  return { data: { id: raw.id }, error: null }
}

export async function signPrescription(
  prescriptionId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("sign_prescription", { p_prescription_id: prescriptionId })
  return { error: error?.message ?? null }
}

export async function voidPrescription(
  prescriptionId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("void_prescription", {
    p_prescription_id: prescriptionId,
    p_reason: reason ?? null,
  })
  return { error: error?.message ?? null }
}
