import { createClient } from "@/lib/supabase/client"

export interface KioskSession {
  session_id: string
  branch_id: string
  branch_name: string
  expires_at: string
}

export async function createKioskSession(
  token: string
): Promise<{ data: KioskSession | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_kiosk_session", { p_token: token })

  if (error) return { data: null, error: error.message }
  return { data: data as KioskSession, error: null }
}

export async function submitKioskCheckin(
  sessionId: string,
  phone: string,
  lastName: string
): Promise<{ data: { display_code: string; entry_id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("submit_kiosk_checkin", {
    p_session_id: sessionId,
    p_phone: phone,
    p_last_name: lastName,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { display_code: string; entry_id: string }
  return { data: { display_code: result.display_code, entry_id: result.entry_id }, error: null }
}

export async function updateKioskMood(
  entryId: string,
  mood: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_queue_entry_mood", {
    p_entry_id: entryId,
    p_mood: mood,
  })
  return { error: error ? error.message : null }
}

export async function getKioskQueueStats(
  branchId: string
): Promise<{ data: { serving: string[]; waitCount: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_kiosk_queue_stats", {
    p_branch_id: branchId,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as { serving: string[]; waitCount: number }, error: null }
}

export type KioskIntakePayload = {
  first_name: string
  last_name: string
  phone?: string
  email?: string
  date_of_birth?: string
  gender?: string
  address_line1?: string
  city?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  medical_alerts?: string
  intake_profile?: Record<string, unknown>
}

function isPublicIntakeSchemaError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("intake_profile") ||
    lower.includes("submit_kiosk_intake") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the function") ||
    lower.includes("pgrst202")
  )
}

const PUBLIC_INTAKE_SQL_HINT =
  "Portal/kiosk intake SQL is not fully applied. Run supabase/scripts/APPLY_PUBLIC_INTAKE_PROFILE_HARDENING.sql in Supabase SQL Editor, then retry."

export function publicChannelSafeError(
  error: string | null | undefined,
  fallback: string
): string {
  if (!error) return fallback
  if (isPublicIntakeSchemaError(error) || error.includes(PUBLIC_INTAKE_SQL_HINT)) {
    return fallback
  }
  return error
}

function isTechnicalQueueCodeError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("_next_queue_display_code") ||
    lower.includes("queue_display_code") ||
    (lower.includes("function") && lower.includes("is not unique"))
  )
}

/** Hide raw Postgres errors from kiosk/portal patients. */
export function kioskCheckInSafeError(
  error: string | null | undefined,
  fallback: string
): string {
  if (!error) return fallback
  if (isTechnicalQueueCodeError(error)) {
    return fallback
  }
  const trimmed = error.trim()
  if (
    trimmed.startsWith("We could not find") ||
    trimmed.startsWith("Please see the front desk") ||
    trimmed.startsWith("You are already checked in") ||
    trimmed.startsWith("Phone and last name") ||
    trimmed.startsWith("Kiosk session expired")
  ) {
    return trimmed
  }
  return fallback
}

export async function submitKioskIntake(
  sessionId: string,
  payload: KioskIntakePayload
): Promise<{ data: { intake_id: string; status: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("submit_kiosk_intake", {
    p_session_id: sessionId,
    p_payload: payload,
  })

  if (error) {
    const message = error.message ?? ""
    return {
      data: null,
      error: isPublicIntakeSchemaError(message) ? `${PUBLIC_INTAKE_SQL_HINT} (${message})` : message,
    }
  }
  const result = data as { intake_id: string; status: string }
  if (!result?.intake_id) return { data: null, error: "Invalid response from kiosk intake" }
  return { data: { intake_id: result.intake_id, status: result.status }, error: null }
}

export async function generateBranchPublicToken(
  branchId: string,
  tokenType: "kiosk" | "display" | "portal",
  label?: string,
  replaceExisting = true
): Promise<{
  data: { token: string; revokedPrevious: number } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("generate_branch_public_token", {
    p_branch_id: branchId,
    p_token_type: tokenType,
    p_label: label ?? null,
    p_replace_existing: replaceExisting,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { token: string; revoked_previous?: number }
  return {
    data: {
      token: result.token,
      revokedPrevious: Number(result.revoked_previous ?? 0),
    },
    error: null,
  }
}

export function buildPublicDeviceUrl(
  type: "kiosk" | "display" | "portal",
  token: string,
  origin = typeof window !== "undefined" ? window.location.origin : ""
): string {
  return `${origin}/${type}?token=${encodeURIComponent(token)}`
}

export async function openPublicDevice(
  branchId: string,
  type: "kiosk" | "display" | "portal"
): Promise<{ error: string | null }> {
  const { data, error } = await generateBranchPublicToken(branchId, type)
  if (error || !data?.token) {
    return { error: error ?? "Failed to generate device link" }
  }

  const url = buildPublicDeviceUrl(type, data.token)
  window.open(url, "_blank", "noopener,noreferrer")
  return { error: null }
}

export async function verifyPortalPatient(
  sessionId: string,
  phone: string,
  lastName: string
): Promise<{ data: { patient_id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("verify_portal_patient", {
    p_session_id: sessionId,
    p_phone: phone,
    p_last_name: lastName,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { patient_id: string }
  if (!result?.patient_id) return { data: null, error: "We could not find your record." }
  return { data: { patient_id: result.patient_id }, error: null }
}

export async function submitPortalAppointment(params: {
  sessionId: string
  phone: string
  lastName: string
  providerId: string
  date: string
  time: string
  purpose?: string
}): Promise<{ data: { appointment_id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("submit_portal_appointment", {
    p_session_id: params.sessionId,
    p_phone: params.phone,
    p_last_name: params.lastName,
    p_provider_id: params.providerId,
    p_date: params.date,
    p_time: params.time,
    p_purpose: params.purpose,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { appointment_id: string }
  if (!result?.appointment_id) return { data: null, error: "Invalid response from portal booking" }
  return { data: { appointment_id: result.appointment_id }, error: null }
}
