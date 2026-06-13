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
): Promise<{ data: { display_code: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("submit_kiosk_checkin", {
    p_session_id: sessionId,
    p_phone: phone,
    p_last_name: lastName,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { display_code: string }
  return { data: { display_code: result.display_code }, error: null }
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
}

export async function submitKioskIntake(
  sessionId: string,
  payload: KioskIntakePayload
): Promise<{ data: { intake_id: string; status: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("submit-kiosk-intake", {
    body: { session_id: sessionId, payload },
  })

  if (error) return { data: null, error: error.message }
  const result = data as { data?: { intake_id: string; status: string }; error?: string }
  if (result.error) return { data: null, error: result.error }
  if (!result.data?.intake_id) return { data: null, error: "Invalid response from kiosk intake" }
  return { data: { intake_id: result.data.intake_id, status: result.data.status }, error: null }
}

export async function generateBranchPublicToken(
  branchId: string,
  tokenType: "kiosk" | "display",
  label?: string
): Promise<{ data: { token: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("generate_branch_public_token", {
    p_branch_id: branchId,
    p_token_type: tokenType,
    p_label: label ?? null,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { token: string }
  return { data: { token: result.token }, error: null }
}

export function buildPublicDeviceUrl(
  type: "kiosk" | "display",
  token: string,
  origin = typeof window !== "undefined" ? window.location.origin : ""
): string {
  return `${origin}/${type}?token=${encodeURIComponent(token)}`
}

export async function openPublicDevice(
  branchId: string,
  type: "kiosk" | "display"
): Promise<{ error: string | null }> {
  const { data, error } = await generateBranchPublicToken(branchId, type)
  if (error || !data?.token) {
    return { error: error ?? "Failed to generate device link" }
  }

  const url = buildPublicDeviceUrl(type, data.token)
  window.open(url, "_blank", "noopener,noreferrer")
  return { error: null }
}
