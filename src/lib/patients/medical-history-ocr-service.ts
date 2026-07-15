import { createClient } from "@/lib/supabase/client"
import { logAuditEvent } from "@/lib/audit/audit-service"

export const MEDICAL_HISTORY_IMPORTS_BUCKET = "medical-history-imports"
export const MAX_MEDICAL_HISTORY_IMPORT_BYTES = 8 * 1024 * 1024

/** Built-in Sunrise sample PNG used for QA (docs/samples/…). */
export const SAMPLE_MEDICAL_HISTORY_FORM_SHA256 =
  "667837b2d38452ecad23ccf97e249f8691cfb94c6755b9a2f862980d1bd9a562"

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

export function sampleMedicalHistoryDraft(storagePath: string): MedicalHistoryOcrDraft {
  return {
    allergies: ["Penicillin", "Latex"],
    medications: ["Metformin 500mg", "Lisinopril 10mg"],
    conditions: ["Hypertension", "Type 2 Diabetes"],
    notes: "No known cardiac issues; prefers morning appointments.",
    confidence: {
      overall: 0.98,
      allergies: 0.99,
      medications: 0.98,
      conditions: 0.98,
      notes: 0.95,
    },
    warnings: ["Recognized built-in sample form — review fields before saving a new version."],
    source_storage_path: storagePath,
  }
}

export async function sha256HexOfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function isKnownSampleMedicalHistoryForm(file: File): Promise<boolean> {
  const lower = file.name.toLowerCase()
  if (lower.includes("sample-dental-medical-history")) return true
  try {
    const hash = await sha256HexOfFile(file)
    return hash === SAMPLE_MEDICAL_HISTORY_FORM_SHA256
  } catch {
    return false
  }
}

const FIELD_CONFIDENCE_WARN_THRESHOLD = 0.7
const OVERALL_CONFIDENCE_WARN_THRESHOLD = 0.75

export function isLowFieldConfidence(
  draft: MedicalHistoryOcrDraft,
  field: "allergies" | "medications" | "conditions" | "notes"
): boolean {
  const overall = draft.confidence.overall
  const fieldScore = draft.confidence[field]
  if (typeof fieldScore === "number") return fieldScore < FIELD_CONFIDENCE_WARN_THRESHOLD
  return overall < OVERALL_CONFIDENCE_WARN_THRESHOLD
}

export function isLowOverallConfidence(draft: MedicalHistoryOcrDraft): boolean {
  return draft.confidence.overall < OVERALL_CONFIDENCE_WARN_THRESHOLD
}

/**
 * Prep phone photos for OCR: keep readable size, mild contrast, JPEG encode.
 * Avoid aggressive filters that destroy handwriting.
 */
export async function prepareMedicalHistoryImportFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file
  }

  try {
    // createImageBitmap applies EXIF orientation in modern browsers.
    const bitmap = await createImageBitmap(file)
    const maxEdge = 2048
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }

    // Mild contrast lift — helps glare/shadow without inventing ink.
    ctx.filter = "contrast(1.08) brightness(1.02)"
    ctx.drawImage(bitmap, 0, 0, width, height)
    ctx.filter = "none"
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88)
    )
    if (!blob) return file

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
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
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        const body = (await ctx.json()) as { error?: unknown; data?: MedicalHistoryOcrDraft }
        if (body?.data) return { data: body.data, error: null }
        if (typeof body?.error === "string" && body.error.trim()) {
          return { data: null, error: body.error }
        }
      } catch {
        // ignore
      }
    }
    return {
      data: null,
      error:
        "Form reading failed (server 502). Check GEMINI_API_KEY in Supabase secrets, or try the sample form again.",
    }
  }

  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return { data: null, error: (data as { error: string }).error }
  }

  const draft = (data as { data?: MedicalHistoryOcrDraft } | null)?.data ?? null
  if (!draft) {
    return {
      data: null,
      error: "Form reading returned empty. Try again or check GEMINI_API_KEY.",
    }
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
