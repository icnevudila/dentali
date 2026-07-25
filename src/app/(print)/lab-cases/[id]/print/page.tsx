"use client"

import { use } from "react"
import { Printer, FlaskConical, Calendar, CheckSquare, ShieldCheck } from "lucide-react"

export default function LabCasePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    patientName?: string
    labName?: string
    workType?: string
    teeth?: string
    shade?: string
    targetDate?: string
    orderNo?: string
  }>
}) {
  const { id: caseId } = use(params)
  const {
    patientName = "Patient Full Name",
    labName = "Dental Prosthetics Laboratory",
    workType = "Zirconia Porcelain Crown / Aesthetic Veneers",
    teeth = "#11, #12, #21, #22 (Upper Anterior Aesthetic Zone)",
    shade = "A2 (VITA Classical)",
    targetDate = "2026-08-05",
    orderNo = `LAB-${caseId.slice(0, 8).toUpperCase()}`,
  } = use(searchParams)

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Action Bar */}
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Dental Laboratory Work Order Preview</h2>
          <p className="text-xs text-slate-500">Print and enclose this sheet when dispatching physical impressions to the lab.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Print Work Order / Save PDF</span>
        </button>
      </div>

      {/* Official Printable Lab Work Order Sheet */}
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-teal-700 font-black text-lg">
              <FlaskConical className="h-6 w-6" />
              <span>DENTALI HEALTH CENTER</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Official Dental Laboratory Work Order & Try-in Sheet
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">Order No: {orderNo}</p>
            <p className="text-slate-500">Date: {new Date().toLocaleDateString("en-US")}</p>
          </div>
        </div>

        {/* Patient & Lab Spec Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Patient Details</span>
            <p className="font-black text-slate-900 text-sm">{patientName}</p>
            <p className="text-slate-500">Target Position(s): <span className="font-bold text-slate-800">{teeth}</span></p>
          </div>

          <div className="rounded-xl bg-teal-50/60 border border-teal-200 p-3.5 space-y-2">
            <span className="font-bold text-teal-700 uppercase text-[10px]">Target Laboratory</span>
            <p className="font-black text-teal-950 text-sm">{labName}</p>
            <p className="text-teal-800 flex items-center gap-1 font-semibold">
              <Calendar className="h-3.5 w-3.5" />
              <span>Target Delivery Date: {targetDate}</span>
            </p>
          </div>
        </div>

        {/* Technical Prosthetic Specifications */}
        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            Prosthetic & Aesthetic Specifications
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Restoration Type</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{workType}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-slate-400 font-bold uppercase text-[10px]">VITA Tooth Shade Selection</span>
              <p className="font-bold text-teal-700 text-sm mt-0.5">{shade}</p>
            </div>
          </div>
        </div>

        {/* Stage Try-in Tracking Checklist */}
        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            Laboratory Try-in & Fit Verification Checklist
          </h3>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
              <span className="font-bold text-slate-400 text-[10px]">STAGE 1</span>
              <p className="font-bold text-slate-900 mt-1">Substructure Fit</p>
              <CheckSquare className="h-4 w-4 text-slate-300 mx-auto mt-2" />
            </div>

            <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
              <span className="font-bold text-slate-400 text-[10px]">STAGE 2</span>
              <p className="font-bold text-slate-900 mt-1">Dentin & Shade Fit</p>
              <CheckSquare className="h-4 w-4 text-slate-300 mx-auto mt-2" />
            </div>

            <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
              <span className="font-bold text-slate-400 text-[10px]">STAGE 3</span>
              <p className="font-bold text-slate-900 mt-1">Occlusal Alignment</p>
              <CheckSquare className="h-4 w-4 text-slate-300 mx-auto mt-2" />
            </div>

            <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
              <span className="font-bold text-slate-400 text-[10px]">STAGE 4</span>
              <p className="font-bold text-slate-900 mt-1">Glaze & Final Polish</p>
              <CheckSquare className="h-4 w-4 text-slate-300 mx-auto mt-2" />
            </div>
          </div>
        </div>

        {/* Technician Special Instructions */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1 text-xs">
          <span className="font-bold text-slate-700 uppercase text-[10px]">Dentist Special Instructions for Technician:</span>
          <p className="text-slate-600 leading-relaxed italic">
            &quot;Please apply slight mamelon translucency on incisal edges for anterior aesthetic zone (#11, #21). Ensure tight contact points.&quot;
          </p>
        </div>

        {/* Signatures */}
        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>Official Work Order Approved</span>
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">Attending Dentist Signature</p>
              <p className="text-[10px] text-slate-500">Dentali Health Center</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
