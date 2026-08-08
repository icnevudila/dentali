import { createClient } from "@/lib/supabase/client"
import { ERROR_COPY, publicChannelSafeError } from "@/lib/kiosk/kiosk-service"

export type CheckInTokenPreview = {
  ok: true
  token: string
  branch_name: string
  patient_first_name: string
  patient_last_name: string
  scheduled_at: string
  appointment_status: string
  expires_at: string
}

const CHECKIN_FALLBACK = ERROR_COPY.checkInFailed

function mapCheckInRpcError(raw: string | null | undefined): string {
  const code = (raw ?? "").trim().toLowerCase()
  if (code === "invalid" || code === "expired" || code === "already_used" || code === "redeem_failed") {
    return code
  }
  return "invalid"
}

export async function createAppointmentCheckInToken(
  appointmentId: string,
  ttlHours = 12
): Promise<{ data: { token: string; expires_at: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_appointment_checkin_token", {
    p_appointment_id: appointmentId,
    p_ttl_hours: ttlHours,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { token?: string; expires_at?: string }
  if (!raw?.token) return { data: null, error: "Failed to create check-in token" }
  return {
    data: { token: raw.token, expires_at: String(raw.expires_at ?? "") },
    error: null,
  }
}

export function buildCheckInUrl(token: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? ""
  return `${base.replace(/\/$/, "")}/check-in/${token}`
}

export async function fetchCheckInByToken(
  token: string
): Promise<{ data: CheckInTokenPreview | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_appointment_checkin_by_token", {
    p_token: token,
  })
  if (error) {
    return {
      data: null,
      error: mapCheckInRpcError(publicChannelSafeError(error.message, "invalid")),
    }
  }
  const raw = data as Record<string, unknown>
  if (!raw?.ok) {
    return { data: null, error: mapCheckInRpcError(String(raw?.error ?? "invalid")) }
  }
  return {
    data: {
      ok: true,
      token,
      branch_name: String(raw.branch_name ?? "Clinic"),
      patient_first_name: String(raw.patient_first_name ?? ""),
      patient_last_name: String(raw.patient_last_name ?? ""),
      scheduled_at: String(raw.scheduled_at ?? ""),
      appointment_status: String(raw.appointment_status ?? ""),
      expires_at: String(raw.expires_at ?? ""),
    },
    error: null,
  }
}

export async function redeemCheckInToken(
  token: string
): Promise<{
  data: { display_code?: string; already_in_queue?: boolean } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("redeem_appointment_checkin_token", {
    p_token: token,
  })
  if (error) {
    return {
      data: null,
      error: mapCheckInRpcError(publicChannelSafeError(error.message, "redeem_failed")),
    }
  }
  const raw = data as Record<string, unknown>
  if (!raw?.ok) {
    return { data: null, error: mapCheckInRpcError(String(raw?.error ?? "redeem_failed")) }
  }
  return {
    data: {
      display_code: raw.display_code ? String(raw.display_code) : undefined,
      already_in_queue: Boolean(raw.already_in_queue),
    },
    error: null,
  }
}

/** Patient-facing copy for known check-in error codes (no raw plumbing). */
export function checkInPublicErrorMessage(code: string | null | undefined): string {
  const map: Record<string, string> = {
    invalid: "This check-in link is invalid.",
    expired: "This check-in link has expired. Please see the front desk.",
    already_used: "This check-in link was already used.",
    redeem_failed: CHECKIN_FALLBACK,
  }
  return map[code ?? ""] ?? CHECKIN_FALLBACK
}
