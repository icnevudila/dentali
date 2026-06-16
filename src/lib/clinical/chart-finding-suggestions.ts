import type { ToothFinding } from "@/lib/types/dental"

export type ProcedureLike = {
  id: string
  name: string
  effective_price: number
}

export type ChartFindingSuggestion = {
  finding: ToothFinding
  procedureId: string | null
  description: string
  estimatedPrice: number
  alreadyOnPlan: boolean
}

const SKIP_CONDITIONS = new Set(["present", "missing_other"])

function isActionableFinding(finding: ToothFinding): boolean {
  if (finding.status === "voided") return false
  if (!finding.condition) return false
  if (SKIP_CONDITIONS.has(finding.condition)) return false
  return true
}

/** Mirrors `bulk_add_chart_findings_to_plan` procedure matching on the client for preview. */
export function matchProcedureForFinding(
  finding: ToothFinding,
  procedures: ProcedureLike[]
): { procedureId: string | null; description: string; estimatedPrice: number } {
  const name = (p: ProcedureLike) => p.name.toLowerCase()
  const code = (p: any) => (p.code || "").toLowerCase()

  const matched = procedures.find((p) => {
    const n = name(p)
    const c = code(p)
    
    // Decayed / caries -> Fillings
    if (finding.condition === "decayed" || finding.condition === "missing_caries") {
      if (
        n.includes("filling") ||
        n.includes("fill") ||
        n.includes("dolgu") ||
        c.includes("fill") ||
        c.includes("comp")
      ) {
        return true
      }
    }
    // Extraction
    if (finding.condition === "indicated_extraction") {
      if (
        n.includes("extraction") ||
        n.includes("extract") ||
        n.includes("çekim") ||
        n.includes("cekim") ||
        c.includes("ext")
      ) {
        return true
      }
    }
    // Crown
    if (finding.restoration_type === "jacket_crown") {
      if (
        n.includes("crown") ||
        n.includes("jacket") ||
        n.includes("kron") ||
        n.includes("kaplama") ||
        c.includes("crwn")
      ) {
        return true
      }
    }
    return false
  })

  if (matched) {
    return {
      procedureId: matched.id,
      description: matched.name,
      estimatedPrice: 0,
    }
  }

  const label = finding.condition
    ? finding.condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Finding"
  return {
    procedureId: null,
    description: `${label} — Tooth ${finding.tooth_number}`,
    estimatedPrice: 0,
  }
}

export function buildChartFindingSuggestions(
  findings: ToothFinding[],
  procedures: ProcedureLike[],
  existingItems: { tooth_number?: string | null; description: string }[]
): ChartFindingSuggestion[] {
  return findings
    .filter(isActionableFinding)
    .map((finding) => {
      const match = matchProcedureForFinding(finding, procedures)
      const alreadyOnPlan = existingItems.some(
        (item) =>
          item.tooth_number === finding.tooth_number &&
          item.description === match.description
      )
      return {
        finding,
        procedureId: match.procedureId,
        description: match.description,
        estimatedPrice: match.estimatedPrice,
        alreadyOnPlan,
      }
    })
    .filter((s) => !s.alreadyOnPlan)
}
