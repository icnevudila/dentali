import type { ToothFinding } from "@/lib/types/dental"
import { getToothVisualState } from "@/lib/odontogram/tooth-visual-state"

export type ChartStats = {
  total: number
  decayed: number
  missing: number
  restored: number
  impacted: number
  other: number
}

export function computeChartStats(findings: ToothFinding[]): ChartStats {
  const active = findings.filter((f) => f.status === "active")
  const stats: ChartStats = {
    total: active.length,
    decayed: 0,
    missing: 0,
    restored: 0,
    impacted: 0,
    other: 0,
  }

  for (const finding of active) {
    const state = getToothVisualState(finding)
    if (state === "decayed") stats.decayed++
    else if (state === "missing") stats.missing++
    else if (state === "restored") stats.restored++
    else if (state === "impacted") stats.impacted++
    else if (state === "other") stats.other++
  }

  return stats
}
