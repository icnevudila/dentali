import { createClient } from "@/lib/supabase/client"

const CONSENT_TOKEN_FALLBACK = "This signing link is invalid or has expired."

function normalizeConsentRpcError(message: string): string {
  if (
    /get_consent_by_signing_token|lock_consent_via_signing_token|schema cache|could not find the function/i.test(
      message
    )
  ) {
    return CONSENT_TOKEN_FALLBACK
  }
  if (/invalid or expired signing link/i.test(message)) {
    return CONSENT_TOKEN_FALLBACK
  }
  return message
}

export interface PatientConsent {
  id: string
  template_slug: string
  template_name: string
  status: "pending" | "signed" | "voided"
  signed_at: string | null
  created_at: string
}

export interface PatientConsentDetail extends PatientConsent {
  signature_data: string | null
  signed_by: string | null
  signed_pdf_path: string | null
  organization_id: string
  field_responses: Record<string, string | boolean> | null
  body_snapshot: string | null
}

export interface ConsentTemplate {
  slug: string
  name: string
  body: string
  version: string
  fields?: unknown
}

export async function fetchPatientConsents(
  patientId: string
): Promise<{ data: PatientConsent[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_consents")
    .select("id, template_slug, template_name, status, signed_at, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PatientConsent[], error: null }
}

export async function fetchPatientConsentDetail(
  patientId: string,
  templateSlug: string
): Promise<{ data: PatientConsentDetail | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_consents")
    .select(
      "id, template_slug, template_name, status, signed_at, created_at, signature_data, signed_by, signed_pdf_path, organization_id, field_responses, body_snapshot"
    )
    .eq("patient_id", patientId)
    .eq("template_slug", templateSlug)
    .neq("status", "voided")
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) return { data: null, error: error.message }
  const row = data?.[0]
  if (!row) return { data: null, error: null }
  return { data: row as PatientConsentDetail, error: null }
}

export async function fetchConsentTemplate(
  slug: string
): Promise<{ data: ConsentTemplate | null; error: string | null }> {
  const supabase = createClient()

  const { data: orgRows, error: orgError } = await supabase
    .from("consent_templates")
    .select("slug, name, body, version, fields")
    .eq("slug", slug)
    .eq("is_active", true)
    .not("organization_id", "is", null)
    .order("version", { ascending: false })
    .limit(1)

  if (orgError) return { data: null, error: orgError.message }
  if (orgRows?.[0]) return { data: orgRows[0] as ConsentTemplate, error: null }

  const { data: globalRows, error: globalError } = await supabase
    .from("consent_templates")
    .select("slug, name, body, version, fields")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("organization_id", null)
    .order("version", { ascending: false })
    .limit(1)

  if (globalError) return { data: null, error: globalError.message }
  if (!globalRows?.[0]) return { data: null, error: "Template not found" }
  return { data: globalRows[0] as ConsentTemplate, error: null }
}

export interface ConsentTemplateAdminRow extends ConsentTemplate {
  id: string
  is_active: boolean
  is_global: boolean
  organization_id: string | null
  fields?: unknown
  form_category?: string
  is_default?: boolean
  source_asset?: string | null
  description?: string | null
}

export type ConsentCatalogItem = ConsentTemplate & {
  form_category: string
  is_default: boolean
  source_asset: string | null
  description: string | null
}

/** Org override wins over global template for the same slug. */
export function mergeConsentCatalog(rows: ConsentTemplateAdminRow[]): ConsentCatalogItem[] {
  const bySlug = new Map<string, ConsentTemplateAdminRow>()
  for (const row of rows) {
    if (!row.is_active) continue
    const existing = bySlug.get(row.slug)
    if (!existing || row.is_global === false) {
      bySlug.set(row.slug, row)
    }
  }
  return [...bySlug.values()]
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      body: row.body,
      version: row.version,
      fields: row.fields,
      form_category: row.form_category ?? "consent",
      is_default: row.is_default ?? false,
      source_asset: row.source_asset ?? null,
      description: row.description ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchConsentCatalog(): Promise<{
  data: ConsentCatalogItem[]
  error: string | null
}> {
  const { data, error } = await fetchOrgConsentTemplates()
  if (error) return { data: [], error }
  return { data: mergeConsentCatalog(data), error: null }
}

export async function fetchOrgConsentTemplates(): Promise<{
  data: ConsentTemplateAdminRow[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_org_consent_templates")
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ConsentTemplateAdminRow[], error: null }
}

export async function upsertOrgConsentTemplate(params: {
  slug: string
  name: string
  body: string
  version: string
  isActive: boolean
  fields?: unknown
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("upsert_org_consent_template", {
    p_payload: {
      slug: params.slug,
      name: params.name,
      body: params.body,
      version: params.version,
      is_active: params.isActive,
      fields: params.fields ?? [],
    },
  })
  return { error: error?.message ?? null }
}

export async function ensurePatientConsent(params: {
  patientId: string
  organizationId: string
  branchId: string | null
  template: ConsentTemplate
}): Promise<{ consentId: string; error: string | null }> {
  const supabase = createClient()

  const { data: existingRows, error: existingError } = await supabase
    .from("patient_consents")
    .select("id, status")
    .eq("patient_id", params.patientId)
    .eq("template_slug", params.template.slug)
    .order("created_at", { ascending: false })
    .limit(1)

  if (existingError) return { consentId: "", error: existingError.message }

  const existing = existingRows?.[0]

  if (existing?.id && existing.status !== "voided") {
    return { consentId: existing.id, error: null }
  }

  if (existing?.id && existing.status === "voided") {
    const { error } = await supabase
      .from("patient_consents")
      .update({
        status: "pending",
        signature_data: null,
        signed_at: null,
        signed_by: null,
        signed_pdf_path: null,
        template_name: params.template.name,
      })
      .eq("id", existing.id)
    return { consentId: existing.id, error: error?.message ?? null }
  }

  const { data, error } = await supabase
    .from("patient_consents")
    .insert({
      patient_id: params.patientId,
      organization_id: params.organizationId,
      branch_id: params.branchId,
      template_slug: params.template.slug,
      template_name: params.template.name,
      status: "pending",
    })
    .select("id")
    .single()

  if (error || !data) return { consentId: "", error: error?.message ?? "Failed to create consent" }
  return { consentId: data.id, error: null }
}

export async function signPatientConsent(params: {
  consentId: string
  userId: string
  signatureData: string
  fieldResponses?: Record<string, string | boolean> | null
  bodySnapshot?: string | null
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("lock_signed_consent", {
    p_consent_id: params.consentId,
    p_signature_data: params.signatureData,
    p_field_responses: params.fieldResponses ?? null,
    p_body_snapshot: params.bodySnapshot ?? null,
  })

  return { error: error?.message ?? null }
}

export interface ConsentSigningContext {
  consent_id: string
  template_slug: string
  template_name: string
  template_body: string
  template_version: string
  fields: unknown
  patient_first_name: string
  patient_last_name: string
  patient_dob: string | null
  org_name: string
}

export async function fetchConsentBySigningToken(
  token: string
): Promise<{ data: ConsentSigningContext | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_consent_by_signing_token", {
    p_token: token,
  })
  if (error) return { data: null, error: normalizeConsentRpcError(error.message) }
  if (!data) return { data: null, error: CONSENT_TOKEN_FALLBACK }
  return { data: data as ConsentSigningContext, error: null }
}

export async function signConsentViaToken(params: {
  token: string
  signatureData: string
  fieldResponses?: Record<string, string | boolean> | null
  bodySnapshot?: string | null
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("lock_consent_via_signing_token", {
    p_token: params.token,
    p_signature_data: params.signatureData,
    p_field_responses: params.fieldResponses ?? null,
    p_body_snapshot: params.bodySnapshot ?? null,
  })
  return { error: error?.message ? normalizeConsentRpcError(error.message) : null }
}

export async function createConsentSigningToken(params: {
  consentId: string
  channel?: "kiosk" | "sms" | "email" | "qr"
  ttlHours?: number
}): Promise<{ token: string | null; expiresAt: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_consent_signing_token", {
    p_consent_id: params.consentId,
    p_channel: params.channel ?? "qr",
    p_ttl_hours: params.ttlHours ?? 72,
  })
  if (error) return { token: null, expiresAt: null, error: error.message }
  const row = data as { token?: string; expires_at?: string }
  return {
    token: row.token ?? null,
    expiresAt: row.expires_at ?? null,
    error: null,
  }
}

export async function seedDefaultConsentsForPatient(params: {
  patientId: string
  organizationId: string
  branchId: string | null
}): Promise<void> {
  const supabase = createClient()
  const { data: templates } = await supabase
    .from("consent_templates")
    .select("slug, name, body, version")
    .eq("is_active", true)
    .eq("is_default", true)

  for (const t of templates ?? []) {
    await ensurePatientConsent({
      patientId: params.patientId,
      organizationId: params.organizationId,
      branchId: params.branchId,
      template: t as ConsentTemplate,
    })
  }
}

export type SignerRole = "patient" | "guardian"

export interface ConsentSignaturePayload {
  name: string
  image: string
  signerRole: SignerRole
  capturedAt: string
  strokeCount?: number
}

export function buildConsentSignaturePayload(params: {
  name: string
  image: string
  signerRole: SignerRole
  strokeCount?: number
}): string {
  const payload: ConsentSignaturePayload = {
    name: params.name.trim(),
    image: params.image,
    signerRole: params.signerRole,
    capturedAt: new Date().toISOString(),
    strokeCount: params.strokeCount,
  }
  return JSON.stringify(payload)
}

export function parseSignatureDisplay(signatureData: string | null): {
  name: string
  imageDataUrl: string | null
  signerRole: SignerRole | null
  capturedAt: string | null
} {
  if (!signatureData) return { name: "", imageDataUrl: null, signerRole: null, capturedAt: null }
  try {
    const parsed = JSON.parse(signatureData) as Partial<ConsentSignaturePayload>
    if (parsed.name || parsed.image) {
      return {
        name: parsed.name ?? "",
        imageDataUrl: parsed.image ?? null,
        signerRole: parsed.signerRole ?? null,
        capturedAt: parsed.capturedAt ?? null,
      }
    }
  } catch {
    /* legacy typed signature */
  }
  return { name: signatureData, imageDataUrl: null, signerRole: null, capturedAt: null }
}

const CONSENT_BUCKET = "consent-documents"

export async function uploadSignedConsentExport(params: {
  organizationId: string
  patientId: string
  consentId: string
  templateSlug: string
  html: string
}): Promise<{ storagePath: string | null; error: string | null }> {
  const supabase = createClient()
  const storagePath = `${params.organizationId}/${params.patientId}/${params.consentId}/${params.templateSlug}-signed.html`
  const blob = new Blob([params.html], { type: "text/html;charset=utf-8" })

  const { error: uploadError } = await supabase.storage
    .from(CONSENT_BUCKET)
    .upload(storagePath, blob, {
      contentType: "text/html;charset=utf-8",
      upsert: true,
    })

  if (uploadError) return { storagePath: null, error: uploadError.message }

  const { error: registerError } = await supabase.rpc("register_signed_consent_pdf", {
    p_consent_id: params.consentId,
    p_storage_path: storagePath,
    p_file_size: blob.size,
  })

  if (registerError) {
    await supabase.storage.from(CONSENT_BUCKET).remove([storagePath])
    return { storagePath: null, error: registerError.message }
  }

  return { storagePath, error: null }
}

export async function getSignedConsentExportUrl(
  storagePath: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(CONSENT_BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error) return { url: null, error: error.message }
  return { url: data.signedUrl, error: null }
}

export async function voidPatientConsent(params: {
  consentId: string
  reason?: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("void_patient_consent", {
    p_consent_id: params.consentId,
    p_reason: params.reason ?? null,
  })
  return { error: error?.message ?? null }
}
