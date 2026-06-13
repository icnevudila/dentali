import type { OrthoAdjustment } from "@/lib/clinical/ortho-service"
import type { ChartPoint } from "@/components/charts/ChartKit"

function formatVisitLabel(date: string): string {
  return new Date(date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
}

export function buildOrthoBalanceTimeline(
  contractAmount: number,
  adjustments: OrthoAdjustment[]
): ChartPoint[] {
  const sorted = [...adjustments].sort((a, b) => a.adjustment_date.localeCompare(b.adjustment_date))
  if (sorted.length === 0) {
    return [{ label: "Contract", value: contractAmount }]
  }

  let cumulativePaid = 0
  const points: ChartPoint[] = [{ label: "Start", value: contractAmount }]

  for (const adj of sorted) {
    cumulativePaid += Number(adj.payment_amount)
    points.push({
      label: formatVisitLabel(adj.adjustment_date),
      value: Math.max(0, contractAmount - cumulativePaid),
    })
  }

  return points
}

export function buildOrthoVisitTimeline(adjustments: OrthoAdjustment[]): ChartPoint[] {
  return [...adjustments]
    .sort((a, b) => a.adjustment_date.localeCompare(b.adjustment_date))
    .map((adj) => ({
      label: formatVisitLabel(adj.adjustment_date),
      value: 1,
    }))
}

export function buildOrthoPaymentTimeline(adjustments: OrthoAdjustment[]): ChartPoint[] {
  return [...adjustments]
    .sort((a, b) => a.adjustment_date.localeCompare(b.adjustment_date))
    .map((adj) => ({
      label: formatVisitLabel(adj.adjustment_date),
      value: Number(adj.payment_amount),
    }))
}
