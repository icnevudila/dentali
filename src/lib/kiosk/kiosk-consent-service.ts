import { createClient } from "@/lib/supabase/client"
import {
  fetchPortalSnapshot,
  type PortalConsentItem,
  type PortalSnapshot,
} from "@/lib/portal/portal-status-service"

export type { PortalConsentItem, PortalSnapshot }

export async function fetchKioskConsentSnapshot(
  sessionId: string,
  phone: string,
  lastName: string
): Promise<{ data: PortalSnapshot | null; error: string | null }> {
  return fetchPortalSnapshot(sessionId, phone, lastName)
}

export function hasPendingKioskConsents(snapshot: PortalSnapshot | null): boolean {
  if (!snapshot) return false
  return snapshot.consents.some(
    (item) => item.status === "pending" || item.status === "not_started"
  )
}

export async function createKioskConsentSignToken(
  sessionId: string,
  phone: string,
  lastName: string,
  templateSlug: string
): Promise<{
  data: { token: string; consent_id: string; already_signed?: boolean } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_kiosk_consent_sign_token", {
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
