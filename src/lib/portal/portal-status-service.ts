import { createClient } from "@/lib/supabase/client"

export type PortalConsentItem = {
  slug: string
  name: string
  status: string
  consent_id: string | null
}

export type PortalSnapshot = {
  patient_id: string
  patient_name: string
  branch_id: string
  queue: {
    entry_id: string
    display_code: string
    status: string
    ahead_count: number
  } | null
  balance: {
    open_balance: number
    has_balance: boolean
  }
  consents: PortalConsentItem[]
  pending_intake_consents: number
  ready_for_checkin: boolean
}

export async function fetchPortalSnapshot(
  sessionId: string,
  phone: string,
  lastName: string
): Promise<{ data: PortalSnapshot | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_portal_snapshot", {
    p_session_id: sessionId,
    p_phone: phone,
    p_last_name: lastName,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as PortalSnapshot, error: null }
}

export async function createPortalConsentSignToken(
  sessionId: string,
  phone: string,
  lastName: string,
  templateSlug: string
): Promise<{
  data: { token: string; consent_id: string; already_signed?: boolean } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_portal_consent_sign_token", {
    p_session_id: sessionId,
    p_phone: phone,
    p_last_name: lastName,
    p_template_slug: templateSlug,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  if (raw.already_signed) {
    return {
      data: {
        token: "",
        consent_id: String(raw.consent_id),
        already_signed: true,
      },
      error: null,
    }
  }
  return {
    data: {
      token: String(raw.token),
      consent_id: String(raw.consent_id),
    },
    error: null,
  }
}
