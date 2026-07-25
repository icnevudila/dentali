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

export const DENTAL_PRESCRIPTION_PRESETS = [
  {
    name: "Acute Dental Pain & Infection Protocol",
    diagnosis: "Acute Periapical Abscess / Pulpal Pain",
    general_instructions: "Take medication with food. Avoid alcohol and extreme heat with food.",
    items: [
      { drug_name: "Amoxicillin", strength: "500 mg", dosage: "1 Capsule", frequency: "Every 8 hours (3x1)", duration: "7 days", quantity: "21 Capsules", instructions: "Take with plenty of water after meals." },
      { drug_name: "Paracetamol", strength: "500 mg", dosage: "1 Tablet", frequency: "Every 6 hours as needed", duration: "3-5 days", quantity: "10 Tablets", instructions: "Take in case of severe pain." },
    ],
  },
  {
    name: "Surgical Extraction & Implant Post-Op Protocol",
    diagnosis: "Post-Operative Surgical Extraction / Graft Care",
    general_instructions: "Do not brush the surgical area for 24 hours. Do not spit or use straws.",
    items: [
      { drug_name: "Amoxicillin + Clavulanic Acid", strength: "1000 mg", dosage: "1 Tablet", frequency: "Every 12 hours (2x1)", duration: "7 days", quantity: "14 Tablets", instructions: "Take at the start of meals." },
      { drug_name: "Mefenamic Acid", strength: "500 mg", dosage: "1 Capsule", frequency: "Every 8 hours (3x1) with food", duration: "4 days", quantity: "12 Capsules", instructions: "Take with food." },
      { drug_name: "Chlorhexidine 0.12% Mouthwash", strength: "250 ml", dosage: "15 ml Rinse", frequency: "Twice daily (Morning/Evening)", duration: "7 days", quantity: "1 Bottle", instructions: "Rinse for 1 minute, 30 minutes after brushing." },
    ],
  },
  {
    name: "Periodontal Infection Protocol",
    diagnosis: "Acute Necrotizing Ulcerative Gingivitis / Periodontal Abscess",
    general_instructions: "Follow a soft diet. Avoid smoking and tobacco products.",
    items: [
      { drug_name: "Amoxicillin", strength: "500 mg", dosage: "1 Capsule", frequency: "Every 8 hours", duration: "7 days", quantity: "21 Capsules", instructions: "Take at regular intervals." },
      { drug_name: "Metronidazole", strength: "500 mg", dosage: "1 Tablet", frequency: "Every 8 hours", duration: "7 days", quantity: "21 Tablets", instructions: "Do not consume with alcohol." },
    ],
  },
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

export async function unsignPrescription(
  prescriptionId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("unsign_prescription", {
    p_prescription_id: prescriptionId,
  })
  return { error: error?.message ?? null }
}
