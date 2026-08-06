"use client"

import { use, useEffect, useState } from "react"
import { Calculator, FileText, Printer } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { useBranch } from "@/hooks/use-branch"
import {
  fetchTreatmentQuotePrintData,
  formatQuotePhp,
  type TreatmentQuotePrintData,
} from "@/lib/clinical/treatment-quote-print"

function formatQuoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function TreatmentQuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: patientId } = use(params)
  const { activeBranch } = useBranch()
  const [quote, setQuote] = useState<TreatmentQuotePrintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchTreatmentQuotePrintData(patientId, activeBranch?.id).then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      setQuote(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-600">Loading treatment quote…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={FileText}
          title="Could not load treatment quote"
          description="Try again from the patient chart, or open the treatment plan first."
        />
      </div>
    )
  }

  if (!quote || quote.lines.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          icon={Calculator}
          title="No treatment plan or invoice to quote"
          description="Approve a treatment plan with procedures, or create an invoice for this patient before printing a cost estimate."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8 print:bg-white print:p-0 font-sans">
      <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Treatment plan cost estimate</h2>
          <p className="text-xs text-slate-500">
            Print the approved estimate and payment summary for the patient.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 border-2 border-slate-300 bg-white p-8 shadow-2xl sm:p-10 print:border-2 print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lg font-black text-blue-700">
              <Calculator className="h-6 w-6" />
              <span>{quote.clinic_name.toUpperCase()}</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Official treatment cost estimate
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500">
            Quote date: {formatQuoteDate(quote.quote_date)}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Patient</span>
            <p className="text-base font-black text-slate-900">{quote.patient_name}</p>
            {quote.plan_title ? (
              <p className="mt-1 text-slate-600">Plan: {quote.plan_title}</p>
            ) : null}
            {quote.invoice_number ? (
              <p className="mt-0.5 text-slate-600">Invoice: {quote.invoice_number}</p>
            ) : null}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase text-slate-400">Source</span>
            <p className="font-bold text-blue-800">
              {quote.source === "invoice" ? "Linked invoice" : "Treatment plan"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            Proposed procedures
          </h3>
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                <th className="p-2.5 font-bold">Procedure / description</th>
                <th className="p-2.5 text-center font-bold">Tooth</th>
                <th className="p-2.5 text-right font-bold">Fee (PHP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {quote.lines.map((line, index) => (
                <tr key={`${line.description}-${index}`}>
                  <td className="p-2.5 font-medium text-slate-900">{line.description}</td>
                  <td className="p-2.5 text-center font-bold text-slate-600">
                    {line.tooth_number ? `#${line.tooth_number}` : "—"}
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    {formatQuotePhp(line.fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900">{formatQuotePhp(quote.subtotal)}</span>
          </div>
          {quote.discount > 0 ? (
            <div className="flex items-center justify-between font-semibold text-emerald-700">
              <span>Discount</span>
              <span>- {formatQuotePhp(quote.discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-sm font-black text-slate-900">
            <span>Net total payable</span>
            <span className="text-base text-blue-700">{formatQuotePhp(quote.net_total)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-300 pt-6 text-xs">
          <div className="space-y-6 text-center">
            <div>
              <p className="font-bold text-slate-900">Patient acceptance signature</p>
              <p className="text-[10px] text-slate-500">
                I accept the proposed treatment and estimate.
              </p>
            </div>
            <div className="mx-auto h-8 w-36 border-b border-slate-400" />
          </div>
          <div className="space-y-6 text-center">
            <div>
              <p className="font-bold text-slate-900">Clinic representative</p>
              <p className="text-[10px] text-slate-500">{quote.clinic_name}</p>
            </div>
            <div className="mx-auto h-8 w-36 border-b border-slate-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
