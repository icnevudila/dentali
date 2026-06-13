"use client"

import * as React from "react"
import { X, History, ChevronDown, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchChartAuditHistory,
  summarizeAuditEvent,
  describeAuditDiffLines,
  type ChartAuditEvent,
} from "@/lib/odontogram/dental-chart-service"

interface ChartHistoryDrawerProps {
  open: boolean
  onClose: () => void
  patientId: string
  chartId: string | null
}

function groupByDate(events: ChartAuditEvent[], locale: string): Map<string, ChartAuditEvent[]> {
  const map = new Map<string, ChartAuditEvent[]>()
  for (const ev of events) {
    const key = new Date(ev.created_at).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const list = map.get(key) ?? []
    list.push(ev)
    map.set(key, list)
  }
  return map
}

function HistorySkeleton() {
  return <PageLoadingSkeleton variant="borderedList" />
}

export function ChartHistoryDrawer({ open, onClose, patientId, chartId }: ChartHistoryDrawerProps) {
  const { t, locale } = useLocale()
  const [events, setEvents] = React.useState<ChartAuditEvent[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const panelRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetchChartAuditHistory({ patientId, chartId }).then(({ data, error: err }) => {
      setEvents(data)
      setError(err)
      setLoading(false)
    })
  }, [open, patientId, chartId])

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  React.useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open, loading])

  if (!open) return null

  const grouped = groupByDate(events, locale)
  const dateLocale = locale === "tr" ? "tr-PH" : locale === "fil" ? "fil-PH" : "en-PH"

  return (
    <>
      <button
        type="button"
        aria-label={t("chart.closeHistory", "Close history")}
        className="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-surface-overlay)] backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-history-title"
        className="fixed inset-y-0 right-0 z-[calc(var(--z-modal)+1)] w-full max-w-md bg-[var(--color-bg-elevated)] border-l border-[var(--color-border-primary)] shadow-[var(--shadow-lg)] flex flex-col outline-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-primary)] px-5 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <History className="h-5 w-5 text-[var(--color-accent-primary)] shrink-0" />
            <div className="min-w-0">
              <h2 id="chart-history-title" className="font-semibold text-[var(--color-text-primary)] truncate">
                {t("chart.historyTitle", "Chart History")}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {loading
                  ? t("common.loading", "Loading…")
                  : t("chart.historySubtitle", "{count} changes from audit log").replace(
                      "{count}",
                      String(events.length)
                    )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("chart.closeHistory", "Close history")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <HistorySkeleton />}

          {error && (
            <p className="text-sm text-[var(--color-status-error)] bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="text-center py-16 text-[var(--color-text-secondary)] text-sm">
              <History className="h-10 w-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p>{t("chart.historyEmpty", "No chart changes recorded yet.")}</p>
              <p className="mt-1">{t("chart.historyEmptyHint", "Edits appear here after you commit the chart.")}</p>
            </div>
          )}

          {!loading &&
            Array.from(grouped.entries()).map(([date, dayEvents]) => (
              <div key={date} className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-3 sticky top-0 bg-[var(--color-bg-elevated)] py-1">
                  {date}
                </h3>
                <ul className="space-y-3">
                  {dayEvents.map((ev) => {
                    const expanded = expandedId === ev.id
                    const diffLines = describeAuditDiffLines(ev)
                    return (
                      <li
                        key={ev.id}
                        className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/60"
                      >
                        <button
                          type="button"
                          className="w-full text-left p-4"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : ev.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                {summarizeAuditEvent(ev)}
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1 flex items-center gap-1">
                                <User className="h-3 w-3 shrink-0" />
                                <span className="truncate">{ev.actor_name}</span>
                                <span aria-hidden>·</span>
                                <time dateTime={ev.created_at}>
                                  {new Date(ev.created_at).toLocaleTimeString(dateLocale, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </time>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-xs capitalize">
                                {ev.action.toLowerCase()}
                              </Badge>
                              <ChevronDown
                                className={`h-4 w-4 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-fast)] ${expanded ? "rotate-180" : ""}`}
                              />
                            </div>
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-[var(--color-border-primary)] px-4 pb-4 pt-3 space-y-3">
                            {diffLines.length > 0 ? (
                              <ul className="space-y-2 text-xs">
                                {diffLines.map((line) => (
                                  <li key={line.label} className="grid grid-cols-[5rem_1fr] gap-2 items-start">
                                    <span className="font-medium text-[var(--color-text-secondary)]">{line.label}</span>
                                    <span className="text-[var(--color-text-primary)]">
                                      <span className="line-through text-[var(--color-text-tertiary)] mr-2">
                                        {line.before}
                                      </span>
                                      <span className="text-[var(--color-accent-primary)] font-medium">{line.after}</span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("chart.noFieldDiff", "No field-level diff available.")}
                              </p>
                            )}
                            {(ev.before_json || ev.after_json) && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-[var(--color-text-link)]">
                                  {t("chart.rawJson", "Raw JSON")}
                                </summary>
                                <div className="mt-2 space-y-2 font-mono">
                                  {ev.before_json && (
                                    <pre className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded p-2 overflow-x-auto text-[10px]">
                                      {JSON.stringify(ev.before_json, null, 2)}
                                    </pre>
                                  )}
                                  {ev.after_json && (
                                    <pre className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded p-2 overflow-x-auto text-[10px]">
                                      {JSON.stringify(ev.after_json, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
        </div>
      </aside>
    </>
  )
}
