import { createClient } from "@/lib/supabase/client"
import { logAuditEvent } from "@/lib/audit/audit-service"

export const MEDICAL_HISTORY_IMPORTS_BUCKET = "medical-history-imports"
export const MAX_MEDICAL_HISTORY_IMPORT_BYTES = 8 * 1024 * 1024

export const MEDICAL_HISTORY_IMPORT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/*,.jpg,.jpeg,.png,.webp"

export type MedicalHistoryOcrDraft = {
  allergies: string[]
  medications: string[]
  conditions: string[]
  notes: string | null
  confidence: {
    overall: number
    allergies?: number
    medications?: number
    conditions?: number
    notes?: number
  }
  warnings: string[]
  source_storage_path: string
}

function extensionForFile(file: File): string {
  const name = file.name.toLowerCase()
  if (name.endsWith(".png") || file.type === "image/png") return "png"
  if (name.endsWith(".webp") || file.type === "image/webp") return "webp"
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf"
  return "jpg"
}

export function validateMedicalHistoryImportFile(file: File): string | null {
  if (file.size <= 0) return "That file looks empty. Try another photo."
  if (file.size > MAX_MEDICAL_HISTORY_IMPORT_BYTES) {
    return "File is too large. Use a photo under 8 MB."
  }
  const lower = file.name.toLowerCase()
  const okType =
    file.type.startsWith("image/") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  if (!okType) {
    return "Use a JPEG or PNG photo of the form (PDF coming later)."
  }
  return null
}

export async function uploadMedicalHistoryImport(params: {
  organizationId: string
  branchId: string
  patientId: string
  file: File
}): Promise<{ storagePath: string | null; error: string | null }> {
  const validationError = validateMedicalHistoryImportFile(params.file)
  if (validationError) return { storagePath: null, error: validationError }

  const supabase = createClient()
  const ext = extensionForFile(params.file)
  const storagePath = `${params.organizationId}/${params.branchId}/${params.patientId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(MEDICAL_HISTORY_IMPORTS_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    })

  if (error) {
    return {
      storagePath: null,
      error: "Could not upload that photo. Check your connection and try again.",
    }
  }

  return { storagePath, error: null }
}

export async function runMedicalHistoryOcr(params: {
  organizationId: string
  branchId: string
  patientId: string
  storagePath: string
}): Promise<{ data: MedicalHistoryOcrDraft | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("medical-history-ocr", {
    body: {
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      storage_path: params.storagePath,
    },
  })

  if (error) {
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return { data: null, error: (data as { error: string }).error }
    }
    return {
      data: null,
      error: "Could not read that form. Try a clearer photo.",
    }
  }

  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return { data: null, error: (data as { error: string }).error }
  }

  const draft = (data as { data?: MedicalHistoryOcrDraft } | null)?.data ?? null
  if (!draft) {
    return { data: null, error: "Could not read that form. Try a clearer photo." }
  }

  return { data: draft, error: null }
}

export async function logMedicalHistoryOcrImport(params: {
  organizationId: string
  branchId: string
  patientId: string
  version: number
  storagePath: string
  overallConfidence: number
  fieldCounts: { allergies: number; medications: number; conditions: number }
}): Promise<void> {
  await logAuditEvent({
    organizationId: params.organizationId,
    branchId: params.branchId,
    action: "medical_history.ocr_import",
    entityType: "patient_medical_history",
    entityId: params.patientId,
    metadata: {
      version: params.version,
      storage_path: params.storagePath,
      overall_confidence: params.overallConfidence,
      field_counts: params.fieldCounts,
    },
  })
}
