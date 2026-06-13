import type { ReportsSummary } from "@/lib/reports/reports-service"
import { formatStatusLabel } from "@/lib/reports/reports-service"

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildReportsCsv(params: {
  branchName: string
  summary: ReportsSummary
  generatedAt?: Date
}): string {
  const { branchName, summary } = params
  const generated = (params.generatedAt ?? new Date()).toISOString()
  const lines: string[] = []

  lines.push("Report,Reports Hub Summary")
  lines.push(`Branch,${escapeCsv(branchName)}`)
  lines.push(`Period days,${summary.periodDays}`)
  lines.push(`Generated,${generated}`)
  lines.push("")

  lines.push("Totals")
  lines.push("Metric,Value")
  lines.push(`Appointments,${summary.totals.appointments}`)
  lines.push(`Completed,${summary.totals.completed}`)
  lines.push(`Cancelled,${summary.totals.cancelled}`)
  lines.push(`No-shows,${summary.totals.noShow}`)
  lines.push(`Collected (PHP),${summary.totals.collected.toFixed(2)}`)
  lines.push("")

  lines.push("Daily appointments")
  lines.push("Date,Label,Count")
  for (const row of summary.dailyAppointments) {
    lines.push(`${row.date},${escapeCsv(row.label)},${row.value}`)
  }
  lines.push("")

  lines.push("Daily collections (PHP)")
  lines.push("Date,Label,Amount")
  for (const row of summary.dailyCollections) {
    lines.push(`${row.date},${escapeCsv(row.label)},${row.value.toFixed(2)}`)
  }
  lines.push("")

  lines.push("Appointment status mix")
  lines.push("Status,Count")
  for (const slice of summary.statusBreakdown) {
    lines.push(`${escapeCsv(formatStatusLabel(slice.status))},${slice.count}`)
  }

  return lines.join("\n")
}

export function downloadReportsCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
