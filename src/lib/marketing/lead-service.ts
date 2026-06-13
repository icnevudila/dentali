import { createClient } from "@/lib/supabase/client"

export type MarketingLeadPayload = {
  lead_type: "quote" | "contact"
  full_name: string
  email: string
  phone?: string
  clinic_name?: string
  branch_count?: number
  message?: string
}

export async function submitMarketingLead(
  payload: MarketingLeadPayload
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc("submit_marketing_lead", {
    p_payload: payload,
  })

  if (error) {
    const missingRpc =
      error.message.includes("submit_marketing_lead") ||
      error.code === "PGRST202" ||
      error.code === "42883"
    if (missingRpc) {
      return {
        ok: false,
        error:
          "Quote requests are not enabled on this server yet. Email hello@dentali.app or use Start free trial to register.",
      }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true, id: String(data) }
}
