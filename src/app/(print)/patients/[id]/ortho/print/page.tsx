"use client"

import { use, useEffect, useState } from "react"
import { Activity, Calendar, FileText, Printer, User } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { useBranch } from "@/hooks/use-branch"
import { fetchOrthoPrintData, type OrthoPrintData } from "@/lib/clinical/ortho-print"

function formatPhDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatPhp(amount: number): string {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function OrthoPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const { activeBranch } = useBranch()
  const [orthoData, setOrthoData] = useState<OrthoPrintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchOrthoPrintData(patientId, activeBranch?.id).then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      setOrthoData(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-600">Loading orthodontic case…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={FileText}
          title="Could not load orthodontic case"
          description="Try again from the patient chart after the case is saved."
        />
      </div>
    )
  }

  if (!orthoData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={Activity}
          title="No orthodontic case"
          description="Create an orthodontic case for this patient before printing the case examination sheet."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-4xl items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Orthodontic case examination sheet</h2>
          <p className="text-xs text-slate-500">
            Print a paper copy for patient records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Export form</span>
        </button>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 rounded-none border border-slate-200 bg-white p-8 font-sans shadow-lg print:border-none print:p-4 print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-md">
              O
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                {orthoData.branch_name}
              </h1>
              <p className="text-xs font-semibold text-indigo-600">
                Orthodontic treatment &amp; case follow-up card
              </p>
            </div>
          </div>
          <div className="space-y-0.5 text-right text-xs text-slate-500">
            <p className="font-bold text-slate-800">Date: {formatPhDate(new Date().toISOString())}</p>
            <p>Case ID: {orthoData.case_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <User className="h-4 w-4 text-indigo-600" />
              <span>Patient: {orthoData.patient_name}</span>
            </div>
            <p className="text-slate-600">Birth date: {formatPhDate(orthoData.birth_date)}</p>
            <p className="text-slate-600">Phone: {orthoData.phone || "—"}</p>
          </div>
          <div className="space-y-2 border-l border-slate-200 pl-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span>Diagnosis: {orthoData.diagnosis || "—"}</span>
            </div>
            <p className="text-slate-600">Appliance: {orthoData.appliance_type || "—"}</p>
            <div className="flex items-center gap-4 pt-1 font-semibold text-slate-700">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Start: {formatPhDate(orthoData.start_date)}
              </span>
              <span>Contract: {formatPhp(orthoData.contract_amount)}</span>
            </div>
          </div>
        </div>

        {orthoData.notes ? (
          <div className="rounded-xl border border-slate-200 p-3 text-xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Case notes
            </h4>
            <p className="mt-1 text-slate-700">{orthoData.notes}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Adjustment / visit history
          </h3>
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100 font-bold text-slate-700">
              <tr>
                <th className="w-28 p-2.5">Date</th>
                <th className="p-2.5">Procedure</th>
                <th className="p-2.5">Next visit plan</th>
                <th className="w-36 p-2.5">Clinician sign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orthoData.visits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">
                    No adjustments logged yet.
                  </td>
                </tr>
              ) : (
                orthoData.visits.map((visit, index) => (
                  <tr key={`${visit.visit_date}-${index}`}>
                    <td className="p-2.5 font-mono font-semibold text-slate-800">
                      {formatPhDate(visit.visit_date)}
                    </td>
                    <td className="p-2.5 font-medium text-slate-900">{visit.procedure || "—"}</td>
                    <td className="p-2.5 text-slate-600">{visit.next_procedure || "—"}</td>
                    <td className="border-l border-slate-200 p-2.5" />
                  </tr>
                ))
              )}
              {Array.from({ length: Math.max(0, 5 - orthoData.visits.length) }).map((_, i) => (
                <tr key={`blank_${i}`} className="h-10">
                  <td className="border-b border-slate-100 p-2.5" />
                  <td className="border-b border-slate-100 p-2.5" />
                  <td className="border-b border-slate-100 p-2.5" />
                  <td className="border-b border-slate-100 border-l border-slate-200 p-2.5" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-6 text-xs">
          <p className="text-slate-400">{orthoData.branch_name} · Orthodontic case form</p>
          <div className="space-y-6 text-right">
            <p className="font-bold text-slate-800">Orthodontist signature / stamp</p>
            <div className="ml-auto h-10 w-44 border-b border-slate-300" />
          </div>
        </div>
      </div>
    </div>
  )
}
