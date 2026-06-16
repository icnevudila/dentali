"use client"

import type { CloseoutSnapshot, DailyCloseout } from "@/lib/analytics/analytics-service"

export type CloseoutPrintMetric = {
  label: string
  value: string
}

export type CloseoutCompareRow = {
  label: string
  previous: number
  current: number
  format: (value: number) => string
}

type CloseoutPrintDocumentProps = {
  clinicName?: string
  branchName?: string | null
  reportDate: string
  previousDate?: string | null
  title: string
  subtitle?: string
  metrics: CloseoutPrintMetric[]
  data: DailyCloseout
  previousData?: DailyCloseout | null
  compareRows?: CloseoutCompareRow[]
  history: CloseoutSnapshot[]
  snapshotTitle: string
  historyTitle: string
  snapshotSaved?: boolean
  printedAt?: Date
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`
}

function deltaText(current: number, previous: number, isMoney = false) {
  const diff = current - previous
  if (diff === 0) return "No change"
  const sign = diff > 0 ? "+" : "−"
  const abs = Math.abs(diff)
  return isMoney ? `${sign}₱${abs.toLocaleString("en-PH")}` : `${sign}${abs}`
}

export function CloseoutPrintDocument({
  clinicName = "Dental Clinic",
  branchName,
  reportDate,
  previousDate,
  title,
  subtitle,
  metrics,
  data,
  previousData,
  compareRows = [],
  history,
  snapshotTitle,
  historyTitle,
  snapshotSaved,
  printedAt = new Date(),
}: CloseoutPrintDocumentProps) {
  const stamp = printedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })

  const detailRows: { label: string; value: string; note?: string }[] = [
    { label: "Collected", value: formatPhp(data.collected), note: "Payments posted this clinic day" },
    { label: "Open balance", value: formatPhp(data.openBalance), note: "Outstanding AR at report time" },
    { label: "Open invoices", value: String(data.openInvoiceCount) },
    { label: "Completed visits", value: String(data.appointmentsCompleted) },
    { label: "No-shows", value: String(data.noShow) },
    { label: "Pending consents", value: String(data.pendingConsents) },
    { label: "HMO claims pending", value: String(data.hmoPending) },
    { label: "Low stock SKUs", value: String(data.lowStock) },
  ]

  return (
    <div id="closeout-print-document" className="hidden bg-white text-neutral-900">
      <header className="closeout-print-header">
        <p className="closeout-print-eyebrow">{clinicName}</p>
        <h1 className="closeout-print-title">{title}</h1>
        <div className="closeout-print-meta">
          {branchName ? <span>Branch: {branchName}</span> : null}
          <span>Clinic day: {reportDate}</span>
          <span>Printed: {stamp}</span>
          {snapshotSaved != null ? (
            <span>Snapshot: {snapshotSaved ? "Saved for this day" : "Not saved yet"}</span>
          ) : null}
        </div>
        {subtitle ? <p className="closeout-print-subtitle">{subtitle}</p> : null}
      </header>

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">At a glance</h2>
        <table className="closeout-print-metrics-table">
          <tbody>
            {Array.from({ length: Math.ceil(metrics.length / 3) }, (_, rowIndex) => {
              const row = metrics.slice(rowIndex * 3, rowIndex * 3 + 3)
              return (
                <tr key={rowIndex}>
                  {row.map((metric) => (
                    <td key={metric.label}>
                      <p className="closeout-print-metric-label">{metric.label}</p>
                      <p className="closeout-print-metric-value">{metric.value}</p>
                    </td>
                  ))}
                  {row.length < 3
                    ? Array.from({ length: 3 - row.length }, (_, i) => <td key={`pad-${i}`} aria-hidden />)
                    : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {compareRows.length > 0 && previousData && previousDate ? (
        <section className="closeout-print-section">
          <h2 className="closeout-print-section-title">
            Day-over-day ({previousDate} → {reportDate})
          </h2>
          <table className="closeout-print-data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="closeout-print-num">{previousDate}</th>
                <th className="closeout-print-num">{reportDate}</th>
                <th className="closeout-print-num">Change</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => {
                const isMoney = row.label.toLowerCase().includes("collect")
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="closeout-print-num">{row.format(row.previous)}</td>
                    <td className="closeout-print-num">{row.format(row.current)}</td>
                    <td className="closeout-print-num">
                      {deltaText(row.current, row.previous, isMoney)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">{snapshotTitle}</h2>
        <table className="closeout-print-data-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="closeout-print-num">Value</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="closeout-print-num">{row.value}</td>
                <td className="text-neutral-600">{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {history.length > 0 ? (
        <section className="closeout-print-section">
          <h2 className="closeout-print-section-title">{historyTitle}</h2>
          <table className="closeout-print-data-table">
            <thead>
              <tr>
                <th>Clinic day</th>
                <th className="closeout-print-num">Collected</th>
                <th className="closeout-print-num">Open balance</th>
                <th className="closeout-print-num">Completed</th>
                <th className="closeout-print-num">No-shows</th>
                <th className="closeout-print-num">HMO pending</th>
              </tr>
            </thead>
            <tbody>
              {history.map((snap) => {
                const payload = snap.payload as DailyCloseout | null
                return (
                  <tr key={snap.id}>
                    <td>{snap.snapshot_date}</td>
                    <td className="closeout-print-num">{formatPhp(Number(payload?.collected ?? 0))}</td>
                    <td className="closeout-print-num">{formatPhp(Number(payload?.openBalance ?? 0))}</td>
                    <td className="closeout-print-num">{String(payload?.appointmentsCompleted ?? "—")}</td>
                    <td className="closeout-print-num">{String(payload?.noShow ?? "—")}</td>
                    <td className="closeout-print-num">{String(payload?.hmoPending ?? "—")}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="closeout-print-section border-t pt-4 text-xs text-neutral-500">
        <p>
          This report reflects clinic-day totals in Asia/Manila. Open balance and pending items are
          point-in-time when generated. Re-saving a closeout snapshot updates the same day&apos;s
          record — it does not create duplicates.
        </p>
      </footer>
    </div>
  )
}
