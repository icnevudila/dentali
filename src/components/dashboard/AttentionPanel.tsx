"use client"

import Link from "next/link"
import { AlertCircle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import { buildAttentionItems } from "@/lib/dashboard/attention-items"

type AttentionPanelProps = {
  stats: DashboardStats
  permissions?: ReadonlySet<string>
  workflowSettings?: Record<string, boolean> | null
  labels: {
    title: string
    allClear: string
    pendingConsents: string
    pendingIntakeDrafts: string
    appointmentsAwaitingCheckin: string
    queueWaiting: string
    waitlistWaiting: string
    openInvoices: string
    lowStock: string
    missingNotes: string
    overdueInvoices: string
    hmoDraft: string
    philhealthPending: string
    manualActionHint?: string
  }
}

export function AttentionPanel({
  stats,
  permissions,
  workflowSettings,
  labels,
}: AttentionPanelProps) {
  const items = buildAttentionItems(
    stats,
    {
      pendingConsents: labels.pendingConsents,
      pendingIntakeDrafts: labels.pendingIntakeDrafts,
      appointmentsAwaitingCheckin: labels.appointmentsAwaitingCheckin,
      queueWaiting: labels.queueWaiting,
      waitlistWaiting: labels.waitlistWaiting,
      openInvoices: labels.openInvoices,
      lowStock: labels.lowStock,
      missingNotes: labels.missingNotes,
      overdueInvoices: labels.overdueInvoices,
      hmoDraft: labels.hmoDraft,
      philhealthPending: labels.philhealthPending,
    },
    { permissions, workflowSettings }
  )

  const manualHint =
    labels.manualActionHint ?? "Automation off — staff action required"

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
        <h3 className="text-sm font-semibold text-neutral-900">{labels.title}</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{labels.allClear}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  item.tone === "amber" && "border-amber-200/80 bg-amber-50/50 hover:bg-amber-50",
                  item.tone === "sky" && "border-sky-200/80 bg-sky-50/40 hover:bg-sky-50/70",
                  item.tone === "red" && "border-red-200/80 bg-red-50/40 hover:bg-red-50/60"
                )}
              >
                <span className="min-w-0 text-neutral-700">
                  <span className="mr-2 font-bold tabular-nums text-neutral-950">{item.count}</span>
                  {item.label}
                  {item.automationOff ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-amber-700">
                      {manualHint}
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
