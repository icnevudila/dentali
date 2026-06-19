import { createClient } from "@/lib/supabase/client"

export type PatientDocumentCategory = "xray" | "id" | "referral" | "insurance" | "other"

export const PATIENT_DOCUMENT_CATEGORIES: { value: PatientDocumentCategory; labelKey: string; fallback: string }[] = [
  { value: "xray", labelKey: "patients.docCategoryXray", fallback: "X-ray / imaging" },
  { value: "id", labelKey: "patients.docCategoryId", fallback: "ID / proof" },
  { value: "referral", labelKey: "patients.docCategoryReferral", fallback: "Referral letter" },
  { value: "insurance", labelKey: "patients.docCategoryInsurance", fallback: "Insurance / HMO" },
  { value: "other", labelKey: "patients.docCategoryOther", fallback: "Other" },
]

export const MAX_PATIENT_DOCUMENT_BYTES = 10 * 1024 * 1024

export interface PatientDocument {
  id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  notes: string | null
  category: PatientDocumentCategory
  created_at: string
  uploaded_by: string | null
  uploader_name?: string
}

const BUCKET = "patient-documents"

export async function fetchPatientDocuments(
  patientId: string
): Promise<{ data: PatientDocument[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_documents")
    .select("id, file_name, file_type, file_size, storage_path, notes, category, created_at, uploaded_by")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }

  const rows = data ?? []
  const uploaderIds = [...new Set(rows.map((r) => r.uploaded_by).filter(Boolean))] as string[]
  const nameMap = new Map<string, string>()

  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uploaderIds)
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.full_name ?? p.email ?? "Staff")
    }
  }

  return {
    data: rows.map((row) => ({
      id: row.id,
      file_name: row.file_name,
      file_type: row.file_type,
      file_size: Number(row.file_size),
      storage_path: row.storage_path,
      notes: row.notes,
      category: (row.category ?? "other") as PatientDocumentCategory,
      created_at: row.created_at,
      uploaded_by: row.uploaded_by,
      uploader_name: row.uploaded_by ? nameMap.get(row.uploaded_by) ?? "Staff" : undefined,
    })),
    error: null,
  }
}

export async function uploadPatientDocument(params: {
  organizationId: string
  branchId: string
  patientId: string
  file: File
  notes?: string
  category?: PatientDocumentCategory
}): Promise<{ data: PatientDocument | null; error: string | null }> {
  if (params.file.size > MAX_PATIENT_DOCUMENT_BYTES) {
    return { data: null, error: `File exceeds ${formatFileSize(MAX_PATIENT_DOCUMENT_BYTES)} limit` }
  }

  const supabase = createClient()
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${params.organizationId}/${params.patientId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) return { data: null, error: uploadError.message }

  const { data: docId, error: registerError } = await supabase.rpc("register_patient_document", {
    p_patient_id: params.patientId,
    p_branch_id: params.branchId,
    p_file_name: params.file.name,
    p_file_type: params.file.type || "application/octet-stream",
    p_file_size: params.file.size,
    p_storage_path: storagePath,
    p_notes: params.notes ?? null,
    p_category: params.category ?? "other",
  })

  if (registerError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { data: null, error: registerError.message }
  }

  return {
    data: {
      id: String(docId),
      file_name: params.file.name,
      file_type: params.file.type || "application/octet-stream",
      file_size: params.file.size,
      storage_path: storagePath,
      notes: params.notes ?? null,
      category: params.category ?? "other",
      created_at: new Date().toISOString(),
      uploaded_by: null,
    },
    error: null,
  }
}

const PROFILE_PHOTO_NOTES = "profile_photo"

export async function fetchPatientProfilePhotoUrl(
  patientId: string
): Promise<{ url: string | null; error: string | null }> {
  const { urls, error } = await fetchPatientProfilePhotoUrls([patientId])
  return { url: urls.get(patientId) ?? null, error }
}

/** Latest profile photo signed URL per patient (batch, for list views). */
export async function fetchPatientProfilePhotoUrls(
  patientIds: string[]
): Promise<{ urls: Map<string, string>; error: string | null }> {
  const uniqueIds = [...new Set(patientIds)]
  if (uniqueIds.length === 0) return { urls: new Map(), error: null }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_documents")
    .select("patient_id, storage_path, created_at")
    .in("patient_id", uniqueIds)
    .eq("notes", PROFILE_PHOTO_NOTES)
    .order("created_at", { ascending: false })

  if (error) return { urls: new Map(), error: error.message }
  if (!data?.length) return { urls: new Map(), error: null }

  const storagePathByPatient = new Map<string, string>()
  for (const row of data) {
    const patientId = row.patient_id as string
    if (!storagePathByPatient.has(patientId) && row.storage_path) {
      storagePathByPatient.set(patientId, row.storage_path as string)
    }
  }

  const urls = new Map<string, string>()
  await Promise.all(
    [...storagePathByPatient.entries()].map(async ([patientId, storagePath]) => {
      const { url } = await getPatientDocumentUrl(storagePath)
      if (url) urls.set(patientId, url)
    })
  )

  return { urls, error: null }
}

export async function uploadPatientProfilePhoto(params: {
  organizationId: string
  branchId: string
  patientId: string
  file: File
}): Promise<{ url: string | null; error: string | null }> {
  const result = await uploadPatientDocument({
    ...params,
    notes: PROFILE_PHOTO_NOTES,
    category: "other",
  })
  if (result.error || !result.data) return { url: null, error: result.error ?? "Upload failed" }
  return getPatientDocumentUrl(result.data.storage_path)
}

export async function getPatientDocumentUrl(
  storagePath: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error) return { url: null, error: error.message }
  return { url: data.signedUrl, error: null }
}

export async function deletePatientDocument(params: {
  documentId: string
  storagePath: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error: dbError } = await supabase
    .from("patient_documents")
    .delete()
    .eq("id", params.documentId)

  if (dbError) return { error: dbError.message }

  await supabase.storage.from(BUCKET).remove([params.storagePath])
  return { error: null }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
