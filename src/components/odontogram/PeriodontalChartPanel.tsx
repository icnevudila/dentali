"use client"

import { PeriodontalPocketPanel } from "./PeriodontalPocketPanel"
import { PeriodontalScreeningPanel } from "./PeriodontalScreeningPanel"

/** Periodontal module: screening reference + 6-site pocket grid */
export function PeriodontalChartPanel({
  patientId,
  branchId,
  organizationId,
  actorUserId,
  canWrite,
  selectedTooth,
  onSelectTooth,
}: {
  patientId: string
  branchId: string
  organizationId?: string | null
  actorUserId?: string | null
  canWrite?: boolean
  selectedTooth?: number | null
  onSelectTooth?: (tooth: number) => void
}) {
  return (
    <div className="space-y-4" data-testid="periodontal-chart-panel">
      <PeriodontalPocketPanel
        patientId={patientId}
        branchId={branchId}
        organizationId={organizationId}
        actorUserId={actorUserId}
        canWrite={canWrite}
        selectedTooth={selectedTooth}
        onSelectTooth={onSelectTooth}
      />
      <PeriodontalScreeningPanel patientId={patientId} />
    </div>
  )
}
