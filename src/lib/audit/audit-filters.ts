export type AuditPeriod = "all" | "today" | "7d" | "30d"

export function auditPeriodToSince(period: AuditPeriod): string | null {
  if (period === "all") return null

  const d = new Date()
  if (period === "today") {
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(d.getDate() - (period === "7d" ? 7 : 30))
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}
