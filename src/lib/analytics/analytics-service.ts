import { createClient } from "@/lib/supabase/client"
import { toDateKey } from "@/lib/appointments/week-calendar"
import type { DayBucket } from "@/lib/reports/date-buckets"
import type { StatusSlice } from "@/lib/reports/reports-service"

export type OwnerAnalytics = {
  periodDays: number
  dailyAppointments: DayBucket[]
  dailyCollections: DayBucket[]
  statusBreakdown: StatusSlice[]
  totals: {
    appointments: number
    completed: number
    cancelled: number
    noShow: number
    collected: number
    openInvoices: number
    pendingConsents: number
    queueWaiting: number
    hmoDraft: number
  }
  branchCompare?: { label: string; value: number }[]
}

export type QueueAnalytics = {
  medianWaitMinutes: number
  peakHours: { label: string; value: number }[]
  todayFlow: { label: string; value: number }[]
}

export type DailyCloseout = {
  date: string
  collected: number
  openBalance: number
  openInvoiceCount: number
  appointmentsCompleted: number
  noShow: number
  pendingConsents: number
  hmoPending: number
  lowStock: number
}

export type ArAgingBucket = { label: string; value: number }

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500",
  scheduled: "bg-primary-500",
  confirmed: "bg-sky-500",
  checked_in: "bg-violet-500",
  cancelled: "bg-neutral-300",
  no_show: "bg-amber-500",
}

export async function fetchOwnerAnalytics(
  branchId: string | null,
  periodDays = 7,
  locale?: string
): Promise<{ data: OwnerAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_owner_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
    p_locale: locale ?? "en",
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const raw = data as Record<string, unknown>
  const statusBreakdown: StatusSlice[] = (
    (raw.status_breakdown as { status: string; count: number }[]) ?? []
  ).map((s) => ({
    status: s.status,
    count: Number(s.count),
    color: STATUS_COLORS[s.status] ?? "bg-neutral-400",
  }))

  return {
    data: {
      periodDays,
      dailyAppointments: (raw.daily_appointments as DayBucket[]) ?? [],
      dailyCollections: (raw.daily_collections as DayBucket[]) ?? [],
      statusBreakdown,
      totals: {
        appointments: Number((raw.totals as Record<string, number>)?.appointments ?? 0),
        completed: Number((raw.totals as Record<string, number>)?.completed ?? 0),
        cancelled: Number((raw.totals as Record<string, number>)?.cancelled ?? 0),
        noShow: Number((raw.totals as Record<string, number>)?.no_show ?? 0),
        collected: Number((raw.totals as Record<string, number>)?.collected ?? 0),
        openInvoices: Number((raw.totals as Record<string, number>)?.open_invoices ?? 0),
        pendingConsents: Number((raw.totals as Record<string, number>)?.pending_consents ?? 0),
        queueWaiting: Number((raw.totals as Record<string, number>)?.queue_waiting ?? 0),
        hmoDraft: Number((raw.totals as Record<string, number>)?.hmo_draft ?? 0),
      },
      branchCompare: raw.branch_compare as { label: string; value: number }[] | undefined,
    },
    error: null,
  }
}

export async function fetchQueueAnalytics(
  branchId: string,
  periodDays = 7
): Promise<{ data: QueueAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_queue_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      medianWaitMinutes: Number(raw.median_wait_minutes ?? 0),
      peakHours: (raw.peak_hours as { label: string; value: number }[]) ?? [],
      todayFlow: (raw.today_flow as { label: string; value: number }[]) ?? [],
    },
    error: null,
  }
}

export async function fetchDailyCloseout(
  branchId: string | null,
  date?: string
): Promise<{ data: DailyCloseout | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_daily_closeout", {
    p_branch_id: branchId,
    p_date: date ?? toDateKey(new Date()),
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, number | string>
  return {
    data: {
      date: String(raw.date),
      collected: Number(raw.collected ?? 0),
      openBalance: Number(raw.open_balance ?? 0),
      openInvoiceCount: Number(raw.open_invoice_count ?? 0),
      appointmentsCompleted: Number(raw.appointments_completed ?? 0),
      noShow: Number(raw.no_show ?? 0),
      pendingConsents: Number(raw.pending_consents ?? 0),
      hmoPending: Number(raw.hmo_pending ?? 0),
      lowStock: Number(raw.low_stock ?? 0),
    },
    error: null,
  }
}

export async function fetchArAging(
  branchId: string
): Promise<{ data: ArAgingBucket[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_ar_aging", { p_branch_id: branchId })
  if (error) return { data: [], error: error.message }
  return { data: (data as ArAgingBucket[]) ?? [], error: null }
}

export async function fetchWorkflowSettings(
  branchId: string
): Promise<{ data: Record<string, boolean> | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_branch_workflow_settings", {
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, boolean>) ?? null, error: null }
}

export type AppointmentsAnalytics = {
  hourlyLoad: { label: string; value: number }[]
  noShowTrend: DayBucket[]
  cancelTrend: DayBucket[]
  dayHourHeatmap: { dow: string; hour: string; value: number }[]
  providerUtilization: { label: string; value: number }[]
  occupancyPct: number
}

export type WaitlistAnalytics = {
  statusFunnel: { label: string; value: number }[]
  conversionPct: number
  activeWaiting: number
}

export type PatientsAnalytics = {
  newPatientsTrend: DayBucket[]
  consentCompletionPct: number
  totalActive: number
}

export type InventoryAnalytics = {
  stockLevels: { label: string; value: number }[]
  lowStockCount: number
  totalSkus: number
}

export type AuditAnalytics = {
  dailyEvents: DayBucket[]
  topActions: { label: string; value: number }[]
  totalEvents: number
}

export async function fetchAppointmentsAnalytics(
  branchId: string,
  periodDays = 7
): Promise<{ data: AppointmentsAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_appointments_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      hourlyLoad: (raw.hourly_load as { label: string; value: number }[]) ?? [],
      noShowTrend: (raw.no_show_trend as DayBucket[]) ?? [],
      cancelTrend: (raw.cancel_trend as DayBucket[]) ?? [],
      dayHourHeatmap:
        (raw.day_hour_heatmap as { dow: string; hour: string; value: number }[]) ?? [],
      providerUtilization: (raw.provider_utilization as { label: string; value: number }[]) ?? [],
      occupancyPct: Number(raw.occupancy_pct ?? 0),
    },
    error: null,
  }
}

export async function fetchWaitlistAnalytics(
  branchId: string,
  periodDays = 30
): Promise<{ data: WaitlistAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_waitlist_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      statusFunnel: (raw.status_funnel as { label: string; value: number }[]) ?? [],
      conversionPct: Number(raw.conversion_pct ?? 0),
      activeWaiting: Number(raw.active_waiting ?? 0),
    },
    error: null,
  }
}

export async function fetchPatientsAnalytics(
  branchId: string,
  periodDays = 30
): Promise<{ data: PatientsAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patients_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      newPatientsTrend: (raw.new_patients_trend as DayBucket[]) ?? [],
      consentCompletionPct: Number(raw.consent_completion_pct ?? 0),
      totalActive: Number(raw.total_active ?? 0),
    },
    error: null,
  }
}

export async function fetchInventoryAnalytics(
  branchId: string
): Promise<{ data: InventoryAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_inventory_analytics", {
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      stockLevels: (raw.stock_levels as { label: string; value: number }[]) ?? [],
      lowStockCount: Number(raw.low_stock_count ?? 0),
      totalSkus: Number(raw.total_skus ?? 0),
    },
    error: null,
  }
}

export async function fetchAuditAnalytics(
  branchId: string | null,
  periodDays = 7
): Promise<{ data: AuditAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_audit_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      dailyEvents: (raw.daily_events as DayBucket[]) ?? [],
      topActions: (raw.top_actions as { label: string; value: number }[]) ?? [],
      totalEvents: Number(raw.total_events ?? 0),
    },
    error: null,
  }
}

export async function updateWorkflowSettings(
  branchId: string,
  patch: Record<string, boolean>
): Promise<{ data: Record<string, boolean> | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("upsert_branch_workflow_settings", {
    p_branch_id: branchId,
    p_settings: patch,
  })
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, boolean>) ?? null, error: null }
}

export type HmoPipelineAnalytics = {
  statusFunnel: { label: string; value: number }[]
  pendingAmount: number
}

export type PhilHealthAnalytics = {
  statusBreakdown: { label: string; value: number }[]
  readinessPct: number
}

export type NotificationAnalytics = {
  dailyDelivery: DayBucket[]
  deliveryRatePct: number
  totalSent: number
}

export type KioskAnalytics = {
  dailyCheckins: DayBucket[]
  totalPeriod: number
  intakesPeriod: number
}

export type InventoryMovementAnalytics = {
  movementTrend: { label: string; value: number; in: number; out: number }[]
}

export type OrthoAnalytics = {
  activeCases: number
  balanceDistribution: { label: string; value: number }[]
  adjustmentTimeline: { label: string; value: number }[]
}

export type DisplayAnalytics = {
  activeDisplayTokens: number
  activeKioskTokens: number
  lastKioskSessionAt: string | null
  displayTokensCreated7d: number
}

export type TvDisplayAnalytics = {
  lastRefreshAt: string | null
  minutesSinceRefresh: number | null
  activeDisplays7d: number
  isOnline: boolean
}

export type AutomationLogEntry = {
  id: string
  event_type: string
  entity_type: string | null
  entity_id: string | null
  branch_id: string | null
  payload: Record<string, unknown>
  created_at: string
  processed_at: string | null
}

export type CloseoutSnapshot = {
  id: string
  snapshot_date: string
  branch_id: string | null
  payload: DailyCloseout
  created_at: string
  finalized?: boolean
}

export async function fetchHmoPipelineAnalytics(
  branchId: string
): Promise<{ data: HmoPipelineAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_hmo_pipeline_analytics", { p_branch_id: branchId })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      statusFunnel: (raw.status_funnel as { label: string; value: number }[]) ?? [],
      pendingAmount: Number(raw.pending_amount ?? 0),
    },
    error: null,
  }
}

export async function fetchPhilHealthAnalytics(
  branchId: string
): Promise<{ data: PhilHealthAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_philhealth_analytics", { p_branch_id: branchId })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      statusBreakdown: (raw.status_breakdown as { label: string; value: number }[]) ?? [],
      readinessPct: Number(raw.readiness_pct ?? 0),
    },
    error: null,
  }
}

export async function fetchNotificationAnalytics(
  branchId: string,
  periodDays = 30
): Promise<{ data: NotificationAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_notification_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  const daily = ((raw.daily_delivery as { label: string; value: number }[]) ?? []).map((d) => ({
    date: d.label,
    label: d.label,
    value: d.value,
  }))
  return {
    data: {
      dailyDelivery: daily,
      deliveryRatePct: Number(raw.delivery_rate_pct ?? 0),
      totalSent: Number(raw.total_sent ?? 0),
    },
    error: null,
  }
}

export async function fetchKioskAnalytics(
  branchId: string,
  periodDays = 7
): Promise<{ data: KioskAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_kiosk_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  const daily = ((raw.daily_checkins as { label: string; value: number }[]) ?? []).map((d) => ({
    date: d.label,
    label: d.label,
    value: d.value,
  }))
  return {
    data: {
      dailyCheckins: daily,
      totalPeriod: Number(raw.total_period ?? 0),
      intakesPeriod: Number(raw.intakes_period ?? 0),
    },
    error: null,
  }
}

export async function fetchInventoryMovementAnalytics(
  branchId: string,
  periodDays = 30
): Promise<{ data: InventoryMovementAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_inventory_movement_analytics", {
    p_branch_id: branchId,
    p_period_days: periodDays,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      movementTrend:
        (raw.movement_trend as { label: string; value: number; in: number; out: number }[]) ?? [],
    },
    error: null,
  }
}

export async function fetchOrthoAnalytics(
  branchId: string
): Promise<{ data: OrthoAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_ortho_analytics", { p_branch_id: branchId })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      activeCases: Number(raw.active_cases ?? 0),
      balanceDistribution: (raw.balance_distribution as { label: string; value: number }[]) ?? [],
      adjustmentTimeline: (raw.adjustment_timeline as { label: string; value: number }[]) ?? [],
    },
    error: null,
  }
}

export async function fetchDisplayAnalytics(
  branchId: string
): Promise<{ data: DisplayAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_display_analytics", {
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      activeDisplayTokens: Number(raw.active_display_tokens ?? 0),
      activeKioskTokens: Number(raw.active_kiosk_tokens ?? 0),
      lastKioskSessionAt: (raw.last_kiosk_session_at as string | null) ?? null,
      displayTokensCreated7d: Number(raw.display_tokens_created_7d ?? 0),
    },
    error: null,
  }
}

export async function fetchTvDisplayAnalytics(
  branchId: string
): Promise<{ data: TvDisplayAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_display_health_analytics", {
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      lastRefreshAt: (raw.last_refresh_at as string | null) ?? null,
      minutesSinceRefresh:
        raw.minutes_since_refresh == null ? null : Number(raw.minutes_since_refresh),
      activeDisplays7d: Number(raw.active_displays_7d ?? raw.active_display_tokens ?? 0),
      isOnline: Boolean(raw.is_online),
    },
    error: null,
  }
}

export async function fetchAutomationRunLog(
  branchId: string | null,
  limit = 50
): Promise<{ data: AutomationLogEntry[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_automation_run_log", {
    p_branch_id: branchId,
    p_limit: limit,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data as AutomationLogEntry[]) ?? [], error: null }
}

export async function saveCloseoutSnapshot(
  branchId: string | null,
  date?: string
): Promise<{ data: string | null; error: string | null; updated: boolean }> {
  const supabase = createClient()
  const targetDate = date ?? toDateKey(new Date())

  let existingQuery = supabase
    .from("closeout_snapshots")
    .select("id")
    .eq("snapshot_date", targetDate)
  existingQuery = branchId
    ? existingQuery.eq("branch_id", branchId)
    : existingQuery.is("branch_id", null)
  const { data: existing } = await existingQuery.maybeSingle()

  const { data, error } = await supabase.rpc("save_closeout_snapshot", {
    p_branch_id: branchId,
    p_date: targetDate,
  })
  if (error) return { data: null, error: error.message, updated: !!existing?.id }
  return { data: String(data), error: null, updated: !!existing?.id }
}

export async function finalizeCloseoutDay(
  branchId: string | null,
  date?: string
): Promise<{ data: string | null; error: string | null }> {
  const supabase = createClient()
  const targetDate = date ?? toDateKey(new Date())
  const { data, error } = await supabase.rpc("finalize_closeout_snapshot", {
    p_branch_id: branchId,
    p_date: targetDate,
  })
  if (error) return { data: null, error: error.message }
  return { data: String(data), error: null }
}

export async function fetchCloseoutHistory(
  branchId: string | null,
  limit = 30
): Promise<{ data: CloseoutSnapshot[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_closeout_history", {
    p_branch_id: branchId,
    p_limit: limit,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data as CloseoutSnapshot[]) ?? [], error: null }
}

export async function fetchBranchBenchmark(
  periodDays = 30
): Promise<{ data: { label: string; appointments: number; collected: number; noShow: number; openAr: number }[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_branch_benchmark", { p_period_days: periodDays })
  if (error) return { data: [], error: error.message }
  const rows = (data as { label: string; appointments: number; collected: number; no_show: number; open_ar: number }[]) ?? []
  return {
    data: rows.map((r) => ({
      label: r.label,
      appointments: Number(r.appointments ?? 0),
      collected: Number(r.collected ?? 0),
      noShow: Number(r.no_show ?? 0),
      openAr: Number(r.open_ar ?? 0),
    })),
    error: null,
  }
}

export type FinanceSummaryAnalytics = {
  openAr: number
  openInvoiceCount: number
  hmoPendingAmount: number
  hmoDraftCount: number
  arAging: ArAgingBucket[]
}

export async function fetchFinanceSummaryAnalytics(
  branchId: string | null
): Promise<{ data: FinanceSummaryAnalytics | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_finance_summary_analytics", {
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      openAr: Number(raw.open_ar ?? 0),
      openInvoiceCount: Number(raw.open_invoice_count ?? 0),
      hmoPendingAmount: Number(raw.hmo_pending_amount ?? 0),
      hmoDraftCount: Number(raw.hmo_draft_count ?? 0),
      arAging: (raw.ar_aging as ArAgingBucket[]) ?? [],
    },
    error: null,
  }
}

export async function fetchBranchChartConditionAnalytics(
  branchId: string
): Promise<{ data: { label: string; value: number }[]; totalFindings: number; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_branch_chart_condition_analytics", {
    p_branch_id: branchId,
  })
  if (error) return { data: [], totalFindings: 0, error: error.message }
  const raw = data as { total_findings?: number; conditions?: { label: string; value: number }[] }
  const conditions = (raw.conditions ?? []).map((c) => ({
    label: c.label,
    value: Number(c.value ?? 0),
  }))
  return {
    data: conditions,
    totalFindings: Number(raw.total_findings ?? 0),
    error: null,
  }
}
