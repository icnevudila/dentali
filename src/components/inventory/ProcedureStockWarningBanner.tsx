"use client"

import { AlertTriangle } from "lucide-react"

export function ProcedureStockWarningBanner({
  warnings,
}: {
  warnings: { name: string; quantity_on_hand: number; min_stock_level: number }[]
}) {
  if (warnings.length === 0) return null

  return (
    <div
      role="status"
      className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="font-medium">Low stock for this procedure</p>
        <ul className="mt-1 list-inside list-disc text-amber-800">
          {warnings.map((w) => (
            <li key={w.name}>
              {w.name}: {w.quantity_on_hand} on hand (min {w.min_stock_level})
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
