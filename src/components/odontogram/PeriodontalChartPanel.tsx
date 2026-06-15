"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PeriodontalPocketPanel } from "./PeriodontalPocketPanel"
import { PeriodontalScreeningPanel } from "./PeriodontalScreeningPanel"

/** Periodontal module: collapsible screening + 6-site pocket grid */
export function PeriodontalChartPanel({
  patientId,
  branchId,
  organizationId,
  actorUserId,
  canWrite,
  selectedTooth,
  onSelectTooth,
  defaultCollapsed = true,
}: {
  patientId: string
  branchId: string
  organizationId?: string | null
  actorUserId?: string | null
  canWrite?: boolean
  selectedTooth?: number | null
  onSelectTooth?: (tooth: number) => void
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  return (
    <Card data-testid="periodontal-chart-panel" className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Periodontics</CardTitle>
            <CardDescription className="text-xs">Pocket depths &amp; screening</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 text-xs"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
          >
            {collapsed ? "Expand" : "Collapse"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
          </Button>
        </div>
      </CardHeader>
      {collapsed ? (
        <CardContent className="pt-0 pb-4 text-xs text-neutral-500">
          Periodontal chart collapsed — expand to record pocket depths.
        </CardContent>
      ) : (
        <CardContent className="space-y-4 border-t pt-4">
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
        </CardContent>
      )}
    </Card>
  )
}
