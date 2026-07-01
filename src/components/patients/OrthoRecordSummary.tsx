"use client"

import * as React from "react"
import Link from "next/link"
import { Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { useBranch } from "@/hooks/use-branch"
import {
  fetchOrthoAdjustments,
  fetchOrthoBalance,
  fetchOrthoCase,
  type OrthoAdjustment,
  type OrthoBalance,
  type OrthoCase,
} from "@/lib/clinical/ortho-service"
import { OrthoCaseTimelinePanel } from "@/components/clinical/OrthoCaseTimelinePanel"

export function OrthoRecordSummary({ patientId }: { patientId: string }) {
  const { activeBranch } = useBranch()
  const [orthoCase, setOrthoCase] = React.useState<OrthoCase | null>(null)
  const [adjustments, setAdjustments] = React.useState<OrthoAdjustment[]>([])
  const [balance, setBalance] = React.useState<OrthoBalance | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!activeBranch?.id || !patientId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: c, error: caseErr } = await fetchOrthoCase(patientId, activeBranch.id)
      if (cancelled) return
      if (caseErr) setError(caseErr)
      setOrthoCase(c)
      if (c) {
        const [adjRes, balRes] = await Promise.all([
          fetchOrthoAdjustments(c.id),
          fetchOrthoBalance(c.id),
        ])
        if (!cancelled) {
          setAdjustments(adjRes.data)
          setBalance(balRes.data)
          if (adjRes.error) setError(adjRes.error)
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id])

  if (loading) {
    return <PageLoadingSkeleton variant="block" className="h-32" />
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>
  }

  if (!orthoCase) {
    return (
      <div className="text-center py-10 text-sm text-neutral-500">
        <Activity className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
        No active ortho case.
        <div className="mt-3">
          <Button size="sm" asChild>
            <Link href={`/patients/${patientId}/ortho`}>Start ortho record</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <p className="text-xs text-neutral-500">Status</p>
          <Badge variant={orthoCase.status === "active" ? "info" : "default"}>{orthoCase.status}</Badge>
        </div>
        {orthoCase.appliance_type ? (
          <div>
            <p className="text-xs text-neutral-500">Appliance</p>
            <p className="font-medium">{orthoCase.appliance_type}</p>
          </div>
        ) : null}
        {orthoCase.diagnosis ? (
          <div>
            <p className="text-xs text-neutral-500">Diagnosis</p>
            <p className="font-medium text-neutral-800">{orthoCase.diagnosis}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs text-neutral-500">Contract</p>
          <p className="font-medium">₱{Number(orthoCase.contract_amount).toLocaleString()}</p>
        </div>
        {balance ? (
          <div>
            <p className="text-xs text-neutral-500">Balance</p>
            <p className="font-medium">₱{Number(balance.balance).toLocaleString()}</p>
          </div>
        ) : null}
      </div>

      {adjustments.length > 0 ? (
        <>
        <OrthoCaseTimelinePanel
          compact
          contractAmount={balance?.contract_amount ?? orthoCase.contract_amount}
          adjustments={adjustments}
        />
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-3 py-2 font-medium text-neutral-600">Date</th>
                <th className="px-3 py-2 font-medium text-neutral-600">Procedure</th>
                <th className="px-3 py-2 font-medium text-neutral-600">Next visit</th>
                <th className="px-3 py-2 font-medium text-neutral-600 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {adjustments.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-neutral-600">
                    {new Date(row.adjustment_date).toLocaleDateString("en-PH")}
                  </td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{row.procedure}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {row.next_visit_date
                      ? new Date(row.next_visit_date).toLocaleDateString("en-PH")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.payment_amount > 0 ? `₱${Number(row.payment_amount).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <p className="text-sm text-neutral-500">No adjustment rows logged yet.</p>
      )}

      <Button variant="outline" size="sm" asChild>
        <Link href={`/patients/${patientId}/ortho`}>Open full ortho record</Link>
      </Button>
    </div>
  )
}
