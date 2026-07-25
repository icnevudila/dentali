"use client"

import { use } from "react"
import { Printer, ShieldCheck, Award } from "lucide-react"

export default function GuaranteeCertificatePrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientName?: string
    treatment?: string
    teeth?: string
    years?: string
    certNo?: string
  }>
}) {
  const queryParams = use(searchParams)
  const patientName = queryParams.patientName ?? "Patient Full Name"
  const treatment = queryParams.treatment ?? "Zirconia Porcelain Crown / Implant Prosthesis"
  const teeth = queryParams.teeth ?? "#11, #12, #21, #22 (Upper Anterior Aesthetic Region)"
  const years = queryParams.years ?? "5"
  const certNo = queryParams.certNo ?? "GRN-984012"

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Action Bar */}
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Dental Guarantee Certificate Preview</h2>
          <p className="text-xs text-slate-500">Click &quot;Print&quot; to issue an official certificate copy to the patient.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Print Certificate / PDF</span>
        </button>
      </div>

      {/* Official Certificate Card */}
      <div className="max-w-3xl mx-auto bg-white p-10 shadow-2xl border-4 border-amber-500/80 print:shadow-none print:border-4 print:p-8 space-y-8 font-serif relative overflow-hidden">
        {/* Corner Golden Accent Line */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-bl-full pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 border-b border-amber-200 pb-6">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg border-2 border-amber-300">
              <Award className="h-9 w-9" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wider">DENTALI HEALTH CENTER</h1>
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest font-sans">
            Official Dental Prosthesis & Implant Guarantee Certificate
          </p>
          <p className="text-[10px] text-slate-400 font-sans">Certificate No: {certNo}</p>
        </div>

        {/* Certificate Body Text */}
        <div className="text-center space-y-6 font-sans">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">This Certificate Is Proudly Presented To:</p>
          <h2 className="text-2xl font-black text-slate-900 border-b-2 border-slate-900 pb-2 inline-block px-8">
            {patientName}
          </h2>

          <p className="text-xs leading-relaxed text-slate-700 max-w-xl mx-auto">
            The dental restoration and/or implant procedure specified below has been completed with high-grade biocompatible materials and validated quality standards. This restoration is guaranteed for <span className="font-bold text-amber-800">{years} YEARS</span> against material fracture and structural defect under standard oral hygiene maintenance.
          </p>
        </div>

        {/* Treatment Details Box */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 font-sans grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold text-amber-900 uppercase text-[10px]">Restoration / Procedure</span>
            <p className="font-bold text-slate-900">{treatment}</p>
          </div>
          <div>
            <span className="font-bold text-amber-900 uppercase text-[10px]">Treated Tooth Position(s)</span>
            <p className="font-bold text-slate-900">{teeth}</p>
          </div>
        </div>

        {/* Guarantee Conditions */}
        <div className="text-[11px] text-slate-500 font-sans space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-700">Guarantee Terms & Conditions:</p>
          <p>1. Patient must attend regular 6-month routine dental check-ups.</p>
          <p>2. Accidental facial trauma and unrecommended hard food biting are excluded.</p>
        </div>

        {/* Signatures */}
        <div className="pt-6 border-t border-amber-200 flex items-center justify-between font-sans text-xs">
          <div className="flex items-center gap-2 text-amber-700 font-bold">
            <ShieldCheck className="h-5 w-5" />
            <span>Verified Clinic Guarantee</span>
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">Attending Dentist / Clinic Director</p>
              <p className="text-[10px] text-slate-500">Dentali Health Center</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-40 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
