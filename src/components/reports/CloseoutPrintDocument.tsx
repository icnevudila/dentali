"use client"

import type { CloseoutSnapshot, DailyCloseout } from "@/lib/analytics/analytics-service"

export type CloseoutPrintMetric = {
  label: string
  value: string
}

type CloseoutPrintDocumentProps = {
  clinicName?: string
  branchName?: string | null
  reportDate: string
  title: string
  subtitle?: string
  metrics: CloseoutPrintMetric[]
  data: DailyCloseout
  history: CloseoutSnapshot[]
  snapshotTitle: string
  historyTitle: string
  printedAt?: Date
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`
}

export function CloseoutPrintDocument({
  clinicName = "Dental Clinic",
  branchName,
  reportDate,
  title,
  subtitle,
  metrics,
  data,
  history,
  snapshotTitle,
  historyTitle,
  printedAt = new Date(),
}: CloseoutPrintDocumentProps) {
  const stamp = printedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })

  const summaryRows: { label: string; value: string }[] = [
    { label: metrics[0]?.label ?? "Collected today", value: formatPhp(data.collected) },
    { label: metrics[1]?.label ?? "Open balance", value: formatPhp(data.openBalance) },
    { label: "Open invoices", value: String(data.openInvoiceCount) },
    { label: metrics[2]?.label ?? "Completed visits", value: String(data.appointmentsCompleted) },
    { label: metrics[3]?.label ?? "No-shows", value: String(data.noShow) },
    { label: metrics[4]?.label ?? "Pending consents", value: String(data.pendingConsents) },
    { label: metrics[5]?.label ?? "HMO pending", value: String(data.hmoPending) },
    { label: "Low stock items", value: String(data.lowStock) },
  ]

  return (
    <div id="closeout-print-document" className="hidden bg-white text-neutral-900">
      <header className="closeout-print-header">
        <p className="closeout-print-eyebrow">{clinicName}</p>
        <h1 className="closeout-print-title">{title}</h1>
        <div className="closeout-print-meta">
          {branchName ? <span>Branch: {branchName}</span> : null}
          <span>Date: {reportDate}</span>
          <span>Printed: {stamp}</span>
        </div>
        {subtitle ? <p className="closeout-print-subtitle">{subtitle}</p> : null}
      </header>

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">Key metrics</h2>
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

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">{snapshotTitle}</h2>
        <table className="closeout-print-data-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="closeout-print-num">Value</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="closeout-print-num">{row.value}</td>
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
                <th>Date</th>
                <th className="closeout-print-num">Collected</th>
                <th className="closeout-print-num">Open balance</th>
                <th className="closeout-print-num">Completed</th>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}
