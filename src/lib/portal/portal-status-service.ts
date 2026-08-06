import { createClient } from "@/lib/supabase/client"
import { publicChannelSafeError } from "@/lib/kiosk/kiosk-service"

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
    open_invoice_id?: string | null
  }
  consents: PortalConsentItem[]
  pending_intake_consents: number
  ready_for_checkin: boolean
}

const PORTAL_FALLBACK = "Something went wrong. Please try again or see the front desk."

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

  if (error) {
    return { data: null, error: publicChannelSafeError(error.message, PORTAL_FALLBACK) }
  }
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

  if (error) {
    return {
      data: null,
      error: publicChannelSafeError(
        error.message,
        "Could not open the signing form. Please see the front desk."
      ),
    }
  }
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

export async function createPortalPaymentIntent(params: {
  sessionId: string
  phone: string
  lastName: string
  invoiceId: string
  provider?: "paymongo" | "gcash"
  amount?: number
}): Promise<{
  data: {
    id: string
    checkout_url: string
    amount: number
    dry_run?: boolean
  } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("portal-create-payment-intent", {
    body: {
      session_id: params.sessionId,
      phone: params.phone,
      last_name: params.lastName,
      invoice_id: params.invoiceId,
      provider: params.provider ?? "paymongo",
      amount: params.amount ?? null,
    },
  })

  if (error) {
    return {
      data: null,
      error: publicChannelSafeError(
        error.message,
        "Could not start online payment. Please settle at the front desk."
      ),
    }
  }
  const raw = data as Record<string, unknown>
  if (raw?.error) {
    return {
      data: null,
      error: publicChannelSafeError(
        String(raw.error),
        "Could not start online payment. Please settle at the front desk."
      ),
    }
  }

  return {
    data: {
      id: String(raw.id),
      checkout_url: String(raw.checkout_url),
      amount: Number(raw.amount),
      dry_run: raw.dry_run === true,
    },
    error: null,
  }
}
