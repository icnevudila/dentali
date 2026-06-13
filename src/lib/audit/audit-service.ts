import { createClient } from "@/lib/supabase/client"

export type AuditAction =
  | "patient.create"
  | "patient.update"
  | "organization.update"
  | "branch.create"
  | "branch.update"
  | "branch.deactivate"
  | "staff.deactivate"
  | "staff.reactivate"
  | "staff.assign"
  | "staff.unassign"
  | "staff.invite"
  | "staff.invite.revoke"
  | "invoice.payment"

export async function logAuditEvent(params: {
  organizationId: string
  branchId?: string | null
  action: AuditAction
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("organization_audit_logs").insert({
    organization_id: params.organizationId,
    branch_id: params.branchId ?? null,
    profile_id: user.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  })
}
