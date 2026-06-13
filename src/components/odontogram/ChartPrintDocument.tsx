"use client"

import type { ToothFinding } from "@/lib/types/dental"
import { computeChartStats } from "@/lib/odontogram/chart-stats"
import { AnatomicOdontogramChart } from "./AnatomicOdontogramChart"
import { DentalLegend } from "./DentalLegend"

export function ChartPrintDocument({
  patientName,
  branchName,
  findings,
  printedAt = new Date(),
}: {
  patientName: string
  branchName?: string
  findings: ToothFinding[]
  printedAt?: Date
}) {
  const stats = computeChartStats(findings)
  const stamp = printedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })

  return (
    <div id="chart-print-document" className="hidden bg-white p-8 text-neutral-900">
      <header className="mb-6 border-b border-neutral-300 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Dental chart record</p>
        <h1 className="mt-1 text-2xl font-bold">{patientName}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600">
          {branchName ? <span>Branch: {branchName}</span> : null}
          <span>Printed: {stamp}</span>
          <span>Findings: {stats.total}</span>
          <span>Decay: {stats.decayed}</span>
          <span>Restored: {stats.restored}</span>
          <span>Missing: {stats.missing}</span>
        </div>
      </header>

      <div className="mb-6">
        <AnatomicOdontogramChart
          findings={findings}
          selectedTooth={null}
          onToothClick={() => {}}
          variant="permanent"
        />
      </div>

      <DentalLegend />
    </div>
  )
}
