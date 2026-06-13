import { PERMANENT_TEETH } from "@/lib/types/dental"

/** Six-point pocket chart sites (buccal + lingual). */
export const PERIO_SITES = ["mb", "b", "db", "ml", "l", "dl"] as const
export type PerioSite = (typeof PERIO_SITES)[number]

export const PERIO_SITE_LABELS: Record<PerioSite, string> = {
  mb: "MB",
  b: "B",
  db: "DB",
  ml: "ML",
  l: "L",
  dl: "DL",
}

export type PerioSiteReading = {
  depth: number | null
  bop?: boolean
}

export type PerioToothReading = Partial<Record<PerioSite, PerioSiteReading>>

export type PeriodontalChartData = Record<string, PerioToothReading>

export const PERMANENT_TOOTH_ORDER: number[] = [
  ...PERMANENT_TEETH.upperRight,
  ...PERMANENT_TEETH.upperLeft,
  ...PERMANENT_TEETH.lowerLeft.slice().reverse(),
  ...PERMANENT_TEETH.lowerRight.slice().reverse(),
]

export function emptyPeriodontalChart(): PeriodontalChartData {
  const chart: PeriodontalChartData = {}
  for (const tooth of PERMANENT_TOOTH_ORDER) {
    chart[String(tooth)] = {}
  }
  return chart
}

export function mergePeriodontalChart(stored: PeriodontalChartData | null): PeriodontalChartData {
  const base = emptyPeriodontalChart()
  if (!stored) return base
  for (const [tooth, reading] of Object.entries(stored)) {
    if (base[tooth] !== undefined) base[tooth] = { ...reading }
  }
  return base
}

export function countPerioAlerts(chart: PeriodontalChartData): {
  pockets4Plus: number
  bopSites: number
  teethRecorded: number
} {
  let pockets4Plus = 0
  let bopSites = 0
  let teethRecorded = 0

  for (const reading of Object.values(chart)) {
    let hasAny = false
    for (const site of PERIO_SITES) {
      const s = reading[site]
      if (!s) continue
      if (s.depth != null) {
        hasAny = true
        if (s.depth >= 4) pockets4Plus++
      }
      if (s.bop) {
        hasAny = true
        bopSites++
      }
    }
    if (hasAny) teethRecorded++
  }

  return { pockets4Plus, bopSites, teethRecorded }
}
