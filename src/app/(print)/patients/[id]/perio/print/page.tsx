"use client"

import { use, useEffect, useState } from "react"
import { Activity, Printer, ShieldAlert } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { useBranch } from "@/hooks/use-branch"
import { fetchPerioPrintData, type PerioPrintData } from "@/lib/clinical/perio-print"

function formatPrintDate(d = new Date()): string {
  return d.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function PeriodontalChartPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: patientId } = use(params)
  const { activeBranch } = useBranch()
  const [report, setReport] = useState<PerioPrintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!activeBranch?.id) {
      setLoading(false)
      setReport(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    void fetchPerioPrintData(patientId, activeBranch.id).then((res) => {
      if (cancelled) return
      if (res.error && !res.data) setError(res.error)
      setReport(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id])

  if (!activeBranch?.id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={Activity}
          title="Select a branch"
          description="Choose an active clinic branch, then open the periodontal print again."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-600">Loading periodontal chart…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={Activity}
          title="Could not load periodontal chart"
          description="Try again from the odontogram after probing depths are saved."
        />
      </div>
    )
  }

  if (!report || report.teethRecorded === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={Activity}
          title="No periodontal probing recorded"
          description="Record pocket depths or BOP on the periodontal chart before printing a probing report."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8 print:bg-white print:p-0 font-sans">
      <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Periodontal probing report</h2>
          <p className="text-xs text-slate-500">
            Print the recorded probing depths and BOP map for the patient record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-rose-700"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 border-2 border-slate-300 bg-white p-8 shadow-2xl sm:p-10 print:border-2 print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lg font-black text-rose-700">
              <Activity className="h-6 w-6" />
              <span>{report.clinic_name.toUpperCase()}</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Periodontal probing depth &amp; gum health report
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500">Date: {formatPrintDate()}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Patient name</span>
            <p className="text-base font-black text-slate-900">{report.patient_name}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Teeth recorded</span>
            <p className="font-bold text-rose-800">{report.teethRecorded} tooth(teeth)</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
            <span className="text-[10px] font-bold uppercase text-slate-400">Average pocket depth</span>
            <p className="text-sm font-black text-slate-900">
              {report.avgPocketMm != null ? `${report.avgPocketMm} mm` : "—"}
            </p>
          </div>
          <div className="space-y-1 rounded-xl border border-rose-300 bg-rose-50/50 p-3">
            <span className="text-[10px] font-bold uppercase text-rose-700">Bleeding on probing</span>
            <p className="text-sm font-black text-rose-900">
              {report.bopPercent != null
                ? `${report.bopPercent}% (${report.bopSiteCount} site${report.bopSiteCount === 1 ? "" : "s"})`
                : `${report.bopSiteCount} site${report.bopSiteCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
            <span className="text-[10px] font-bold uppercase text-slate-400">Pockets ≥ 4 mm</span>
            <p className="font-bold text-slate-900">{report.pockets4Plus} site(s)</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            Probing depth map (mm)
          </h3>
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs sm:grid-cols-8">
            {report.teeth.map((tooth) => (
              <div
                key={tooth.tooth}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <span className="text-[10px] font-bold text-slate-400">#{tooth.tooth}</span>
                <p
                  className={`text-xs font-bold ${
                    tooth.avgDepth != null && tooth.avgDepth >= 4
                      ? "text-rose-700"
                      : "text-emerald-700"
                  }`}
                >
                  {tooth.avgDepth != null ? `${tooth.avgDepth} mm` : "—"}
                </p>
                <span className="text-[9px] text-slate-400">
                  {tooth.hasBop ? "BOP+" : tooth.depths.join("/") || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-300 pt-6 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <span>Recorded periodontal chart · {report.clinic_name}</span>
          </div>
          <div className="space-y-6 text-center">
            <div>
              <p className="font-bold text-slate-900">Clinician signature</p>
              <p className="text-[10px] text-slate-500">{report.clinic_name}</p>
            </div>
            <div className="mx-auto h-8 w-36 border-b border-slate-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
