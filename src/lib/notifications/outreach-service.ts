import { createClient } from "@/lib/supabase/client"

export async function logPatientOutreach(params: {
  organizationId: string
  branchId: string
  patientId: string
  phone: string
  bodyPreview: string
  templateKey: string
  createdBy: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("notification_logs").insert({
    organization_id: params.organizationId,
    branch_id: params.branchId,
    patient_id: params.patientId,
    template_key: params.templateKey,
    recipient_phone: params.phone,
    body_preview: params.bodyPreview,
    status: "sent",
    provider_ref: "whatsapp_manual",
    created_by: params.createdBy,
  })
  return { error: error?.message ?? null }
}
