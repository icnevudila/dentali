"use client"

import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import type { ReportsSummary } from "@/lib/reports/reports-service"
import { formatStatusLabel } from "@/lib/reports/reports-service"

export type ReportsHubPrintMetric = {
  label: string
  value: string
}

type ReportsHubPrintDocumentProps = {
  clinicName?: string
  branchName: string
  periodDays: number
  title: string
  subtitle?: string
  summary: ReportsSummary
  todayMetrics?: ReportsHubPrintMetric[]
  printedAt?: Date
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`
}

export function ReportsHubPrintDocument({
  clinicName = "Dental Clinic",
  branchName,
  periodDays,
  title,
  subtitle,
  summary,
  todayMetrics = [],
  printedAt = new Date(),
}: ReportsHubPrintDocumentProps) {
  const stamp = printedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })

  const periodMetrics: ReportsHubPrintMetric[] = [
    { label: "Appointments", value: String(summary.totals.appointments) },
    { label: "Completed", value: String(summary.totals.completed) },
    { label: "No-shows", value: String(summary.totals.noShow) },
    { label: "Cancelled", value: String(summary.totals.cancelled) },
    { label: "Collected", value: formatPhp(summary.totals.collected) },
  ]

  return (
    <div id="reports-hub-print-document" className="hidden bg-white text-neutral-900">
      <header className="closeout-print-header">
        <p className="closeout-print-eyebrow">{clinicName}</p>
        <h1 className="closeout-print-title">{title}</h1>
        <div className="closeout-print-meta">
          <span>Branch: {branchName}</span>
          <span>Period: last {periodDays} days</span>
          <span>Printed: {stamp}</span>
        </div>
        {subtitle ? <p className="closeout-print-subtitle">{subtitle}</p> : null}
      </header>

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">Period totals</h2>
        <table className="closeout-print-metrics-table">
          <tbody>
            {Array.from({ length: Math.ceil(periodMetrics.length / 3) }, (_, rowIndex) => {
              const row = periodMetrics.slice(rowIndex * 3, rowIndex * 3 + 3)
              return (
                <tr key={rowIndex}>
                  {row.map((metric) => (
                    <td key={metric.label}>
                      <p className="closeout-print-metric-label">{metric.label}</p>
                      <p className="closeout-print-metric-value">{metric.value}</p>
                    </td>
                  ))}
                  {row.length < 3
                    ? Array.from({ length: 3 - row.length }, (_, i) => (
                        <td key={`pad-${i}`} aria-hidden />
                      ))
                    : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {todayMetrics.length > 0 ? (
        <section className="closeout-print-section">
          <h2 className="closeout-print-section-title">Today&apos;s pulse</h2>
          <table className="closeout-print-data-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th className="closeout-print-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {todayMetrics.map((metric) => (
                <tr key={metric.label}>
                  <td>{metric.label}</td>
                  <td className="closeout-print-num">{metric.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">Daily appointments</h2>
        <table className="closeout-print-data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Label</th>
              <th className="closeout-print-num">Count</th>
            </tr>
          </thead>
          <tbody>
            {summary.dailyAppointments.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.label}</td>
                <td className="closeout-print-num">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">Daily collections</h2>
        <table className="closeout-print-data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Label</th>
              <th className="closeout-print-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.dailyCollections.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.label}</td>
                <td className="closeout-print-num">{formatPhp(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="closeout-print-section">
        <h2 className="closeout-print-section-title">Appointment status mix</h2>
        <table className="closeout-print-data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th className="closeout-print-num">Count</th>
            </tr>
          </thead>
          <tbody>
            {summary.statusBreakdown.map((slice) => (
              <tr key={slice.status}>
                <td>{formatStatusLabel(slice.status)}</td>
                <td className="closeout-print-num">{slice.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="closeout-print-section border-t pt-4 text-xs text-neutral-500">
        Generated from Reports Hub · {branchName} · {periodDays}-day window
      </footer>
    </div>
  )
}
