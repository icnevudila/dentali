import type { PeriodontalChartData } from "@/lib/odontogram/periodontal-types"
import { mergePeriodontalChart } from "@/lib/odontogram/periodontal-types"

const STORAGE_PREFIX = "dentali-perio-chart"

function storageKey(patientId: string, branchId: string) {
  return `${STORAGE_PREFIX}:${patientId}:${branchId}`
}

export function loadPeriodontalChart(
  patientId: string,
  branchId: string
): PeriodontalChartData {
  if (typeof window === "undefined") return mergePeriodontalChart(null)
  try {
    const raw = window.localStorage.getItem(storageKey(patientId, branchId))
    if (!raw) return mergePeriodontalChart(null)
    return mergePeriodontalChart(JSON.parse(raw) as PeriodontalChartData)
  } catch {
    return mergePeriodontalChart(null)
  }
}

export function savePeriodontalChart(
  patientId: string,
  branchId: string,
  chart: PeriodontalChartData
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(patientId, branchId), JSON.stringify(chart))
  } catch {
    // quota / private mode — silent
  }
}
