import { createClient } from "@/lib/supabase/client"
import { sendSms } from "@/lib/notifications/notification-service"

export async function sendReviewRequestAfterServed(
  queueEntryId: string
): Promise<{ sent: boolean; skippedReason?: string; error?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("prepare_review_request_sms", {
    p_queue_entry_id: queueEntryId,
  })

  if (error) return { sent: false, error: error.message }

  const raw = data as Record<string, unknown>
  if (raw.skipped) {
    return { sent: false, skippedReason: String(raw.reason ?? "skipped") }
  }

  const phone = String(raw.phone ?? "")
  const body = String(raw.body ?? "")
  const branchId = String(raw.branch_id ?? "")
  const patientId = String(raw.patient_id ?? "")

  if (!phone || !body || !branchId) {
    return { sent: false, skippedReason: "invalid_payload" }
  }

  const { error: sendError } = await sendSms({
    phone,
    body,
    branchId,
    templateKey: "google_review_request",
    patientId: patientId || undefined,
  })

  if (sendError) return { sent: false, error: sendError }
  return { sent: true }
}
