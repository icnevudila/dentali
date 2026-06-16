import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

const REALTIME_TABLES = [
  "queue_entries",
  "appointments",
  "patient_consents",
  "patient_intakes",
  "invoices",
  "invoice_payments",
  "patients",
  "inventory_items",
  "waitlist_entries",
] as const

type Coordinator = {
  channel: RealtimeChannel
  listeners: Set<() => void>
  statusListeners: Set<(live: boolean) => void>
  refCount: number
  debounceTimer: ReturnType<typeof setTimeout> | null
  live: boolean
}

const coordinators = new Map<string, Coordinator>()

function notifyListeners(coord: Coordinator) {
  if (coord.debounceTimer) clearTimeout(coord.debounceTimer)
  coord.debounceTimer = setTimeout(() => {
    coord.listeners.forEach((fn) => fn())
  }, 400)
}

function setLive(coord: Coordinator, live: boolean) {
  if (coord.live === live) return
  coord.live = live
  coord.statusListeners.forEach((fn) => fn(live))
}

function ensureCoordinator(branchId: string, supabase: SupabaseClient): Coordinator {
  const existing = coordinators.get(branchId)
  if (existing) return existing

  let channel = supabase.channel(`dashboard-kpi-${branchId}`)

  for (const table of REALTIME_TABLES) {
    const filter =
      table === "invoice_payments" || table === "patients"
        ? undefined
        : `branch_id=eq.${branchId}`

    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        ...(filter ? { filter } : {}),
      },
      () => {
        const coord = coordinators.get(branchId)
        if (coord) notifyListeners(coord)
      }
    )
  }

  const coord: Coordinator = {
    channel,
    listeners: new Set(),
    statusListeners: new Set(),
    refCount: 0,
    debounceTimer: null,
    live: false,
  }

  channel.subscribe((status) => {
    setLive(coord, status === "SUBSCRIBED")
  })

  coordinators.set(branchId, coord)
  return coord
}

function releaseCoordinator(branchId: string, supabase: SupabaseClient) {
  const coord = coordinators.get(branchId)
  if (!coord || coord.refCount > 0) return

  if (coord.debounceTimer) clearTimeout(coord.debounceTimer)
  setLive(coord, false)
  void supabase.removeChannel(coord.channel)
  coordinators.delete(branchId)
}

/** One Supabase channel per branch; multiple dashboard consumers share it safely. */
export function subscribeDashboardKpiRealtime(
  branchId: string,
  onChange: () => void,
  onLiveChange?: (live: boolean) => void
): () => void {
  const supabase = createClient()
  const coord = ensureCoordinator(branchId, supabase)
  coord.listeners.add(onChange)
  if (onLiveChange) {
    coord.statusListeners.add(onLiveChange)
    onLiveChange(coord.live)
  }
  coord.refCount += 1

  return () => {
    coord.listeners.delete(onChange)
    if (onLiveChange) coord.statusListeners.delete(onLiveChange)
    coord.refCount -= 1
    releaseCoordinator(branchId, supabase)
  }
}
