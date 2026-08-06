"use client"

import { use } from "react"
import { Printer, FlaskConical, Calendar, CheckSquare, ShieldCheck } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { BRAND_NAME } from "@/lib/brand"

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
    instructions?: string
  }>
}) {
  const { id: caseId } = use(params)
  const raw = use(searchParams)
  const { t, locale } = useLocale()
  const hasData = Boolean(raw.patientName || raw.labName || raw.workType || raw.orderNo)

  if (!hasData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-sm font-semibold text-rose-600">
          {t("print.emptyLab", "No lab work order data to print. Open this page from a lab case.")}
        </p>
      </div>
    )
  }

  const notSpecified = t("print.notSpecified", "Not specified")
  const patientName = raw.patientName ?? notSpecified
  const labName = raw.labName ?? notSpecified
  const workType = raw.workType ?? notSpecified
  const teeth = raw.teeth ?? notSpecified
  const shade = raw.shade ?? notSpecified
  const targetDate = raw.targetDate ?? notSpecified
  const orderNo = raw.orderNo ?? `LAB-${caseId.slice(0, 8).toUpperCase()}`
  const instructions = raw.instructions

  const stages = [
    t("print.labStage1", "Substructure fit"),
    t("print.labStage2", "Dentin & shade fit"),
    t("print.labStage3", "Occlusal alignment"),
    t("print.labStage4", "Glaze & final polish"),
  ]

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {t("print.labPreviewTitle", "Dental laboratory work order preview")}
          </h2>
          <p className="text-xs text-slate-500">
            {t(
              "print.labPreviewHint",
              "Print and enclose this sheet when dispatching physical impressions to the lab."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>{t("print.printLab", "Print work order / Save PDF")}</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6 relative">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-teal-700 font-black text-lg">
              <FlaskConical className="h-6 w-6" />
              <span>{BRAND_NAME.toUpperCase()}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {t("print.labDocTitle", "Official dental laboratory work order & try-in sheet")}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">
              {t("print.labOrderNo", "Order No")}: {orderNo}
            </p>
            <p className="text-slate-500">
              {t("print.labDate", "Date")}: {formatDate(locale, new Date())}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <span className="font-bold text-slate-400 uppercase text-[10px]">
              {t("print.labPatientDetails", "Patient details")}
            </span>
            <p className="font-black text-slate-900 text-sm">{patientName}</p>
            <p className="text-slate-500">
              {t("print.labTargetPositions", "Target position(s)")}:{" "}
              <span className="font-bold text-slate-800">{teeth}</span>
            </p>
          </div>

          <div className="rounded-xl bg-teal-50/60 border border-teal-200 p-3.5 space-y-2">
            <span className="font-bold text-teal-700 uppercase text-[10px]">
              {t("print.labTargetLab", "Target laboratory")}
            </span>
            <p className="font-black text-teal-950 text-sm">{labName}</p>
            <p className="text-teal-800 flex items-center gap-1 font-semibold">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {t("print.labDeliveryDate", "Target delivery date")}: {targetDate}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            {t("print.labSpecs", "Prosthetic & aesthetic specifications")}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-slate-400 font-bold uppercase text-[10px]">
                {t("print.labRestoration", "Restoration type")}
              </span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{workType}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-slate-400 font-bold uppercase text-[10px]">
                {t("print.labShade", "VITA tooth shade selection")}
              </span>
              <p className="font-bold text-teal-700 text-sm mt-0.5">{shade}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            {t("print.labChecklist", "Laboratory try-in & fit verification checklist")}
          </h3>

          <div className="grid grid-cols-4 gap-2 text-center">
            {stages.map((label, index) => (
              <div key={label} className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
                <span className="font-bold text-slate-400 text-[10px]">
                  {t("print.labStage", "Stage {n}").replace("{n}", String(index + 1))}
                </span>
                <p className="font-bold text-slate-900 mt-1">{label}</p>
                <CheckSquare className="h-4 w-4 text-slate-300 mx-auto mt-2" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1 text-xs">
          <span className="font-bold text-slate-700 uppercase text-[10px]">
            {t("print.labInstructions", "Dentist special instructions for technician")}:
          </span>
          <p className="text-slate-600 leading-relaxed italic">
            {instructions
              ? `"${instructions}"`
              : t("print.labNoInstructions", "No special instructions recorded.")}
          </p>
        </div>

        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>{t("print.labApproved", "Official work order approved")}</span>
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">
                {t("print.labDentistSign", "Attending dentist signature")}
              </p>
              <p className="text-[10px] text-slate-500">{BRAND_NAME}</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
