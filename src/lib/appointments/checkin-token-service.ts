import { createClient } from "@/lib/supabase/client"

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
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  if (!raw?.ok) {
    return { data: null, error: String(raw?.error ?? "invalid") }
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
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  if (!raw?.ok) {
    return { data: null, error: String(raw?.error ?? "redeem_failed") }
  }
  return {
    data: {
      display_code: raw.display_code ? String(raw.display_code) : undefined,
      already_in_queue: Boolean(raw.already_in_queue),
    },
    error: null,
  }
}
