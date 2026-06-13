"use client"

import * as React from "react"
import { computeChartStats } from "@/lib/odontogram/chart-stats"
import type { ToothFinding } from "@/lib/types/dental"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type OdontogramQuickBarProps = {
  findings: ToothFinding[]
  selectedTooth: number | null
  onSelectTooth: (n: number) => void
  readOnly?: boolean
}

export function OdontogramQuickBar({
  findings,
  selectedTooth,
  onSelectTooth,
  readOnly,
}: OdontogramQuickBarProps) {
  const stats = React.useMemo(() => computeChartStats(findings), [findings])
  const [jumpValue, setJumpValue] = React.useState("")

  const handleJump = () => {
    const n = parseInt(jumpValue, 10)
    if (Number.isNaN(n) || n < 11 || n > 85) return
    onSelectTooth(n)
    setJumpValue("")
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <StatPill label="Findings" value={stats.total} tone="neutral" />
        <StatPill label="Decayed" value={stats.decayed} tone="red" />
        <StatPill label="Missing" value={stats.missing} tone="amber" />
        <StatPill label="Restored" value={stats.restored} tone="blue" />
        {stats.impacted > 0 ? <StatPill label="Impacted" value={stats.impacted} tone="violet" /> : null}
      </div>

      {!readOnly ? (
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-20 text-center font-mono text-sm"
            placeholder="#"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value.replace(/\D/g, "").slice(0, 2))}
            onKeyDown={(e) => e.key === "Enter" && handleJump()}
            aria-label="Jump to tooth number"
          />
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleJump}>
            Go to tooth
          </Button>
          {selectedTooth ? (
            <span className="text-xs text-neutral-500">
              Selected: <strong className="text-primary-700">{selectedTooth}</strong>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "neutral" | "red" | "amber" | "blue" | "violet"
}) {
  const styles = {
    neutral: "bg-white text-neutral-700 border-neutral-200",
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    violet: "bg-violet-50 text-violet-800 border-violet-200",
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", styles[tone])}>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  )
}
