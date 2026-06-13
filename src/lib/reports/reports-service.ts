import { createClient } from "@/lib/supabase/client"
import { fetchAppointmentsRange } from "@/lib/appointments/appointment-service"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"
import { bucketAmountsByDate, bucketByDate, buildDayRange } from "@/lib/reports/date-buckets"

export type StatusSlice = {
  status: string
  count: number
  color: string
}

export type ReportsSummary = {
  periodDays: number
  dailyAppointments: { date: string; label: string; value: number }[]
  dailyCollections: { date: string; label: string; value: number }[]
  statusBreakdown: StatusSlice[]
  totals: {
    appointments: number
    completed: number
    cancelled: number
    noShow: number
    collected: number
  }
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500",
  scheduled: "bg-primary-500",
  confirmed: "bg-sky-500",
  checked_in: "bg-violet-500",
  cancelled: "bg-neutral-300",
  no_show: "bg-amber-500",
}

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-neutral-400"
}

function periodBounds(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function fetchReportsSummary(
  branchId: string,
  organizationId: string,
  periodDays = 7,
  locale?: string
): Promise<{ data: ReportsSummary | null; error: string | null }> {
  const supabase = createClient()
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_owner_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
    p_locale: locale ?? "en",
  })

  if (!rpcError && rpcData) {
    const raw = rpcData as Record<string, unknown>
    const statusBreakdown: StatusSlice[] = (
      (raw.status_breakdown as { status: string; count: number }[]) ?? []
    ).map((s) => ({
      status: s.status,
      count: Number(s.count),
      color: statusColor(s.status),
    }))
    const totals = raw.totals as Record<string, number>
    return {
      data: {
        periodDays,
        dailyAppointments: (raw.daily_appointments as ReportsSummary["dailyAppointments"]) ?? [],
        dailyCollections: (raw.daily_collections as ReportsSummary["dailyCollections"]) ?? [],
        statusBreakdown,
        totals: {
          appointments: Number(totals?.appointments ?? 0),
          completed: Number(totals?.completed ?? 0),
          cancelled: Number(totals?.cancelled ?? 0),
          noShow: Number(totals?.no_show ?? 0),
          collected: Number(totals?.collected ?? 0),
        },
      },
      error: null,
    }
  }

  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    const empty = buildDayRange(periodDays, locale).map((d) => ({ ...d, value: 0 }))
    return {
      data: {
        periodDays,
        dailyAppointments: empty,
        dailyCollections: empty,
        statusBreakdown: [],
        totals: {
          appointments: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          collected: 0,
        },
      },
      error: null,
    }
  }

  const { start, end } = periodBounds(periodDays)

  const [appointmentsResult, paymentsResult] = await Promise.all([
    fetchAppointmentsRange(branchId, start, end),
    supabase
      .from("invoice_payments")
      .select("amount, created_at, invoices!inner(branch_id)")
      .eq("organization_id", organizationId)
      .eq("invoices.branch_id", branchId)
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`),
  ])

  if (appointmentsResult.error) {
    return { data: null, error: appointmentsResult.error }
  }
  if (paymentsResult.error) {
    return { data: null, error: paymentsResult.error.message }
  }

  const appointments = appointmentsResult.data
  const payments = paymentsResult.data ?? []

  const dailyAppointments = bucketByDate(
    appointments,
    (a) => a.scheduled_at.slice(0, 10),
    periodDays,
    locale
  )

  const dailyCollections = bucketAmountsByDate(
    payments,
    (p) => (p.created_at as string).slice(0, 10),
    (p) => Number(p.amount),
    periodDays,
    locale
  )

  const statusCounts = new Map<string, number>()
  for (const apt of appointments) {
    statusCounts.set(apt.status, (statusCounts.get(apt.status) ?? 0) + 1)
  }

  const statusBreakdown: StatusSlice[] = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({
      status,
      count,
      color: statusColor(status),
    }))

  const collected = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  return {
    data: {
      periodDays,
      dailyAppointments,
      dailyCollections,
      statusBreakdown,
      totals: {
        appointments: appointments.length,
        completed: statusCounts.get("completed") ?? 0,
        cancelled: statusCounts.get("cancelled") ?? 0,
        noShow: statusCounts.get("no_show") ?? 0,
        collected,
      },
    },
    error: null,
  }
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Owner-only extended summary (all branches when branchId null) */
export { fetchOwnerAnalytics } from "@/lib/analytics/analytics-service"
export type { OwnerAnalytics } from "@/lib/analytics/analytics-service"
