import { createClient } from "@/lib/supabase/client"
import {
  formatAuditActionLabel,
  formatAuditDetailsLabel,
  formatAuditEntityLabel,
} from "@/lib/audit/audit-labels"

export type AuditSource = "all" | "organization" | "session"

export interface AuditLogRecord {
  id: string
  source: AuditSource | string
  action: string
  entity_type: string | null
  entity_id: string | null
  branch_id: string | null
  profile_id: string | null
  actor_name: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export async function fetchUnifiedAuditTrail(params: {
  branchId?: string | null
  source?: AuditSource
  limit?: number
  offset?: number
  since?: string | null
  until?: string | null
  actionContains?: string
  actorContains?: string
  entityType?: string
  entityId?: string
}): Promise<{ data: AuditLogRecord[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_unified_audit_trail", {
    p_branch_id: params.branchId ?? null,
    p_source: params.source ?? "all",
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0,
    p_since: params.since ?? null,
    p_until: params.until ?? null,
    p_action_contains: params.actionContains?.trim() || null,
    p_actor_contains: params.actorContains?.trim() || null,
    p_entity_type: params.entityType?.trim() || null,
    p_entity_id: params.entityId?.trim() || null,
  })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as AuditLogRecord[], error: null }
}

export async function fetchEntityAuditTrail(params: {
  entityType: string
  entityId: string
  limit?: number
}): Promise<{ data: AuditLogRecord[]; error: string | null }> {
  return fetchUnifiedAuditTrail({
    source: "organization",
    limit: params.limit ?? 25,
    entityType: params.entityType,
    entityId: params.entityId,
  })
}

/** @deprecated Use fetchUnifiedAuditTrail */
export async function fetchAuditLogs(limit = 50): Promise<{ data: AuditLogRecord[]; error: string | null }> {
  return fetchUnifiedAuditTrail({ limit, source: "organization" })
}

export function exportAuditLogsCsv(
  logs: AuditLogRecord[],
  t?: (key: string, fallback: string) => string
): string {
  const translate = t ?? ((_: string, fallback: string) => fallback)
  const header = ["Time", "Source", "Action", "Entity", "Entity ID", "Actor", "Branch", "IP", "Details"]
  const rows = logs.map((log) => [
    new Date(log.created_at).toISOString(),
    log.source,
    formatAuditActionLabel(log.action, translate),
    formatAuditEntityLabel(log.entity_type, translate),
    log.entity_id ?? "",
    log.actor_name ?? "",
    log.branch_id ?? "",
    log.ip_address ?? "",
    formatAuditDetailsLabel(log, translate),
  ])
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n")
}

export function downloadAuditCsv(
  logs: AuditLogRecord[],
  filename = "audit-trail.csv",
  t?: (key: string, fallback: string) => string
) {
  const csv = exportAuditLogsCsv(logs, t)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
