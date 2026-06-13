"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useBranch } from "@/hooks/use-branch"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { MiniOdontogram } from "@/components/odontogram/MiniOdontogram"
import { AnatomicOdontogramChart } from "@/components/odontogram/AnatomicOdontogramChart"
import type { ToothFinding } from "@/lib/types/dental"

function countFindings(findings: ToothFinding[]) {
  const active = findings.filter((f) => f.status !== "voided")
  return {
    total: active.length,
    decayed: active.filter((f) => f.condition === "decayed" || f.condition === "indicated_extraction").length,
    missing: active.filter((f) =>
      f.condition != null &&
      ["missing_caries", "missing_other", "root_fragment"].includes(f.condition)
    ).length,
    restored: active.filter((f) => !!f.restoration_type).length,
  }
}

export function PatientOdontogramSummary({
  patientId,
  compact = false,
}: {
  patientId: string
  compact?: boolean
}) {
  const router = useRouter()
  const { activeBranch, branchRevision } = useBranch()
  const [findings, setFindings] = React.useState<ToothFinding[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!patientId) return
    let cancelled = false
    setLoading(true)
    getPatientOdontogram(patientId, activeBranch?.id ?? null).then(({ data, error: err }) => {
      if (cancelled) return
      setFindings(data?.findings ?? [])
      setError(err)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id, branchRevision])

  const stats = countFindings(findings)
  const chartHref = `/patients/${patientId}/chart`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{stats.total} findings</Badge>
          {stats.decayed > 0 ? <Badge variant="warning">{stats.decayed} decay</Badge> : null}
          {stats.restored > 0 ? <Badge variant="info">{stats.restored} restored</Badge> : null}
          {stats.missing > 0 ? <Badge variant="default">{stats.missing} missing</Badge> : null}
          {stats.total === 0 ? (
            <span className="text-neutral-500">No charted conditions yet</span>
          ) : null}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link href={chartHref}>
            Open full chart
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Preview Section */}
      <div 
        className="relative cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-primary-300 hover:shadow-md group"
        onClick={() => router.push(chartHref)}
      >
        <div className="pointer-events-none mx-auto min-w-0 max-w-full opacity-90 transition-opacity group-hover:opacity-100">
          <AnatomicOdontogramChart
            findings={findings}
            selectedTooth={null}
            onToothClick={() => {}}
            showAnatomy={false}
            interactive={false}
          />
        </div>
        
        {/* Overlay edit button that appears on hover */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
          <Button variant="default" className="shadow-lg gap-2 pointer-events-none">
            <ExternalLink className="h-4 w-4" />
            {stats.total > 0 ? "Edit dental chart" : "Start dental charting"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 justify-center text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-400" /> Decay
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-teal-500" /> Restored
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-neutral-400" /> Missing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-neutral-200 border border-neutral-300" /> Healthy
        </span>
      </div>
    </div>
  )
}
