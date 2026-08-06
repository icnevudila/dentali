import { getPatientPeriodontal } from "@/lib/odontogram/periodontal-service"
import {
  countPerioAlerts,
  PERIO_SITES,
  PERMANENT_TOOTH_ORDER,
  type PeriodontalChartData,
} from "@/lib/odontogram/periodontal-types"
import { createClient } from "@/lib/supabase/client"
import { fetchBranchContext } from "@/lib/org/branch-context-service"
import { loadPeriodontalChart } from "@/lib/odontogram/periodontal-storage"

export type PerioToothSummary = {
  tooth: number
  depths: number[]
  avgDepth: number | null
  hasBop: boolean
}

export type PerioPrintData = {
  patient_name: string
  clinic_name: string
  chart: PeriodontalChartData
  teeth: PerioToothSummary[]
  avgPocketMm: number | null
  bopSiteCount: number
  bopPercent: number | null
  pockets4Plus: number
  teethRecorded: number
}

function formatPatientName(row: {
  first_name?: string | null
  last_name?: string | null
} | null): string {
  if (!row) return "Patient"
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Patient"
}

function summarizeChart(chart: PeriodontalChartData): {
  teeth: PerioToothSummary[]
  avgPocketMm: number | null
  totalSites: number
  bopSites: number
} {
  const teeth: PerioToothSummary[] = []
  let depthSum = 0
  let depthCount = 0
  let totalSites = 0
  let bopSites = 0

  for (const tooth of PERMANENT_TOOTH_ORDER) {
    const reading = chart[String(tooth)] ?? {}
    const depths: number[] = []
    let hasBop = false
    for (const site of PERIO_SITES) {
      const s = reading[site]
      if (!s) continue
      if (s.depth != null) {
        depths.push(s.depth)
        depthSum += s.depth
        depthCount += 1
        totalSites += 1
      }
      if (s.bop) {
        hasBop = true
        bopSites += 1
        if (s.depth == null) totalSites += 1
      }
    }
    if (depths.length === 0 && !hasBop) continue
    teeth.push({
      tooth,
      depths,
      avgDepth:
        depths.length > 0
          ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
          : null,
      hasBop,
    })
  }

  return {
    teeth,
    avgPocketMm: depthCount > 0 ? Math.round((depthSum / depthCount) * 10) / 10 : null,
    totalSites,
    bopSites,
  }
}

export async function fetchPerioPrintData(
  patientId: string,
  branchId: string
): Promise<{ data: PerioPrintData | null; error: string | null }> {
  const supabase = createClient()

  const [{ data: patient, error: patientError }, branchResult, perioResult] = await Promise.all([
    supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", patientId)
      .maybeSingle(),
    fetchBranchContext(branchId),
    getPatientPeriodontal(patientId, branchId),
  ])

  if (patientError) return { data: null, error: patientError.message }
  if (perioResult.error) {
    // Fall back to local draft chart if server fails
    const local = loadPeriodontalChart(patientId, branchId)
    const alerts = countPerioAlerts(local)
    if (alerts.teethRecorded === 0) {
      return { data: null, error: perioResult.error }
    }
    const summary = summarizeChart(local)
    return {
      data: {
        patient_name: formatPatientName(patient),
        clinic_name: branchResult.data?.branch_name?.trim() || "Clinic",
        chart: local,
        teeth: summary.teeth,
        avgPocketMm: summary.avgPocketMm,
        bopSiteCount: summary.bopSites,
        bopPercent:
          summary.totalSites > 0
            ? Math.round((summary.bopSites / summary.totalSites) * 1000) / 10
            : null,
        pockets4Plus: alerts.pockets4Plus,
        teethRecorded: alerts.teethRecorded,
      },
      error: null,
    }
  }

  const chart = perioResult.data?.data
  if (!chart) return { data: null, error: null }

  const alerts = countPerioAlerts(chart)
  if (alerts.teethRecorded === 0) return { data: null, error: null }

  const summary = summarizeChart(chart)
  return {
    data: {
      patient_name: formatPatientName(patient),
      clinic_name: branchResult.data?.branch_name?.trim() || "Clinic",
      chart,
      teeth: summary.teeth,
      avgPocketMm: summary.avgPocketMm,
      bopSiteCount: summary.bopSites,
      bopPercent:
        summary.totalSites > 0
          ? Math.round((summary.bopSites / summary.totalSites) * 1000) / 10
          : null,
      pockets4Plus: alerts.pockets4Plus,
      teethRecorded: alerts.teethRecorded,
    },
    error: null,
  }
}
