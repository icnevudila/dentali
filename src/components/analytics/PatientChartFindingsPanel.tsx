"use client"

import * as React from "react"
import type { ToothFinding } from "@/lib/types/dental"
import { DistributionPie } from "@/components/charts/ChartKit"
import { useLocale } from "@/hooks/use-locale"

function formatConditionLabel(condition: string): string {
  return condition.replace(/_/g, " ")
}

export function PatientChartFindingsPanel({ findings }: { findings: ToothFinding[] }) {
  const { t } = useLocale()

  const active = React.useMemo(
    () => findings.filter((f) => f.status === "active"),
    [findings]
  )

  const conditionMix = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of active) {
      const key = f.condition ?? f.restoration_type ?? "present"
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label: formatConditionLabel(label), value }))
      .sort((a, b) => b.value - a.value)
  }, [active])

  const restorationCount = active.filter((f) => f.restoration_type).length
  const decayCount = active.filter((f) => f.condition === "decayed").length

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("chart.activeFindings", "Active findings")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{active.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("chart.decayedTeeth", "Decayed")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{decayCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <h3 className="text-sm font-semibold text-neutral-900">
          {t("chart.patientConditionMix", "This patient's chart")}
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          {restorationCount > 0
            ? t("chart.restorationsCount", "{n} restoration(s)").replace("{n}", String(restorationCount))
            : t("chart.noRestorations", "No restorations recorded")}
        </p>
        <div className="mt-3">
          <DistributionPie
            data={conditionMix}
            height={200}
            emptyLabel={t("chart.noFindings", "No active findings recorded")}
          />
        </div>
      </div>

      {active.length > 0 ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <h3 className="text-sm font-semibold text-neutral-900 mb-2">
            {t("chart.affectedTeeth", "Affected teeth")}
          </h3>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto hide-scrollbar text-sm">
            {active.map((f) => (
              <li key={f.id ?? f.tooth_number} className="flex justify-between gap-2 text-neutral-700">
                <span className="font-mono font-medium">#{f.tooth_number}</span>
                <span className="truncate text-xs text-neutral-500">
                  {formatConditionLabel(f.condition ?? f.restoration_type ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
