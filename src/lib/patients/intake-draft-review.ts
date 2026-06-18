import { createClient } from "@/lib/supabase/client"
import {
  parsePatientIntakeProfile,
  type PatientIntakeProfile,
} from "@/lib/patients/patient-intake-profile"
import type { PatientFormValues } from "@/lib/validations/patient"

export interface KioskIntakeDraft {
  id: string
  branch_id: string
  payload: Record<string, unknown>
  created_at: string
}

export type IntakeRegistrationSource = "kiosk" | "portal" | "unknown"

export type IntakeDraftCounts = {
  total: number
  kiosk: number
  portal: number
  unknown: number
}

export function getIntakeSource(payload: Record<string, unknown>): IntakeRegistrationSource {
  const source = String(payload.source ?? "").toLowerCase()
  if (source === "portal") return "portal"
  if (source === "kiosk") return "kiosk"
  return "unknown"
}

export function countIntakeDrafts(drafts: KioskIntakeDraft[]): IntakeDraftCounts {
  return {
    total: drafts.length,
    kiosk: drafts.filter((d) => getIntakeSource(d.payload) === "kiosk").length,
    portal: drafts.filter((d) => getIntakeSource(d.payload) === "portal").length,
    unknown: drafts.filter((d) => getIntakeSource(d.payload) === "unknown").length,
  }
}

const DRAFT_REVIEW_KEY = "ph_dental_intake_draft_review"

export function payloadToFormValues(payload: Record<string, unknown>): Partial<PatientFormValues> {
  return {
    firstName: String(payload.first_name ?? ""),
    lastName: String(payload.last_name ?? ""),
    phoneNumber: String(payload.phone ?? ""),
    email: String(payload.email ?? ""),
    dateOfBirth: String(payload.date_of_birth ?? ""),
    gender: (payload.gender as PatientFormValues["gender"]) ?? "prefer_not_to_say",
    addressLine1: String(payload.address_line1 ?? ""),
    city: String(payload.city ?? ""),
    emergencyContactName: String(payload.emergency_contact_name ?? ""),
    emergencyContactPhone: String(payload.emergency_contact_phone ?? ""),
    medicalAlerts: String(payload.medical_alerts ?? ""),
  }
}

export async function fetchKioskIntakeDrafts(
  branchId: string
): Promise<{ data: KioskIntakeDraft[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_intakes")
    .select("id, branch_id, payload, created_at")
    .eq("branch_id", branchId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as KioskIntakeDraft[], error: null }
}

export function storeDraftForReview(draft: KioskIntakeDraft): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(
    DRAFT_REVIEW_KEY,
    JSON.stringify({
      intakeId: draft.id,
      values: payloadToFormValues(draft.payload),
      intakeProfile: parsePatientIntakeProfile(draft.payload.intake_profile),
    })
  )
}

export function loadDraftForReview(): {
  intakeId: string
  values: Partial<PatientFormValues>
  intakeProfile?: PatientIntakeProfile
} | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(DRAFT_REVIEW_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as {
      intakeId: string
      values: Partial<PatientFormValues>
      intakeProfile?: PatientIntakeProfile
    }
  } catch {
    return null
  }
}

export function clearDraftForReview(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(DRAFT_REVIEW_KEY)
}

export async function downloadIntakePdf(
  intakeId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("generate-intake-pdf", {
    body: { intake_id: intakeId },
  })

  if (error) return { error: error.message }
  const result = data as {
    data?: { format?: string; pdf_base64?: string; filename?: string; content?: string }
    error?: string
  }
  if (result.error) return { error: result.error }

  const doc = result.data
  if (!doc) return { error: "No document content returned" }

  let blob: Blob
  let filename = doc.filename ?? `intake-${intakeId.slice(0, 8)}.pdf`

  if (doc.format === "application/pdf" && doc.pdf_base64) {
    const binary = atob(doc.pdf_base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    blob = new Blob([bytes], { type: "application/pdf" })
  } else if (doc.content) {
    blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" })
    filename = `intake-${intakeId.slice(0, 8)}.txt`
  } else {
    return { error: "No document content returned" }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return { error: null }
}

export async function markIntakeDraftFinalized(
  intakeId: string,
  patientId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("patient_intakes")
    .update({
      status: "finalized",
      patient_id: patientId,
      finalized_at: new Date().toISOString(),
    })
    .eq("id", intakeId)
    .eq("status", "draft")

  if (error) return { error: error.message }
  return { error: null }
}
