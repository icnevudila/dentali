"use client"

import { use } from "react"
import { Printer, Activity, ShieldAlert } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { BRAND_NAME } from "@/lib/brand"

export default function PeriodontalChartPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientName?: string
    avgPocket?: string
    bopPercent?: string
    mobilityCount?: string
    diagnosis?: string
    advice?: string
  }>
}) {
  const raw = use(searchParams)
  const { t, locale } = useLocale()
  const hasData = Boolean(raw.patientName || raw.avgPocket || raw.bopPercent || raw.mobilityCount)

  if (!hasData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-sm font-semibold text-rose-600">
          {t(
            "print.emptyPerio",
            "No periodontal exam data to print. Open this page from a perio chart."
          )}
        </p>
      </div>
    )
  }

  const notSpecified = t("print.notSpecified", "Not specified")
  const patientName = raw.patientName ?? notSpecified
  const avgPocket = raw.avgPocket ?? notSpecified
  const bopPercent = raw.bopPercent ?? notSpecified
  const mobilityCount = raw.mobilityCount ?? notSpecified
  const diagnosis = raw.diagnosis ?? notSpecified
  const advice = raw.advice

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {t("print.perioPreviewTitle", "Periodontal probing examination report preview")}
          </h2>
          <p className="text-xs text-slate-500">
            {t(
              "print.perioPreviewHint",
              "Print an official periodontal health map for the patient record."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>{t("print.printPerio", "Print periodontal report / PDF")}</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-700 font-black text-lg">
              <Activity className="h-6 w-6" />
              <span>{BRAND_NAME.toUpperCase()}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {t("print.perioDocTitle", "Official periodontal probing depth & gum health report")}
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500">
            {t("print.perioDate", "Date")}: {formatDate(locale, new Date())}
          </p>
        </div>

        <div className="rounded-xl bg-rose-50/60 border border-rose-200 p-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px]">
              {t("print.perioPatient", "Patient name")}
            </span>
            <p className="font-black text-base text-slate-900">{patientName}</p>
          </div>

          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px]">
              {t("print.perioDiagnosis", "Clinical diagnosis")}
            </span>
            <p className="font-bold text-rose-800">{diagnosis}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {t("print.perioAvgPocket", "Average pocket depth")}
            </span>
            <p className="font-black text-slate-900 text-sm">{avgPocket}</p>
          </div>

          <div className="rounded-xl border border-rose-300 p-3 bg-rose-50/50 space-y-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase">
              {t("print.perioBop", "Bleeding on probing (BOP)")}
            </span>
            <p className="font-black text-rose-900 text-sm">{bopPercent}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {t("print.perioMobility", "Tooth mobility")}
            </span>
            <p className="font-bold text-slate-900">{mobilityCount}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            {t("print.perioMapTitle", "Probing depth measurement map per tooth (mm)")}
          </h3>
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
            {t("print.emptyPerioMap", "No probing measurements recorded for this visit.")}
          </p>
        </div>

        {advice ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1 text-xs">
            <span className="font-bold text-slate-700 uppercase text-[10px]">
              {t("print.perioAdvice", "Periodontist clinical advice")}:
            </span>
            <p className="text-slate-600 leading-relaxed">&quot;{advice}&quot;</p>
          </div>
        ) : null}

        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <span>{t("print.perioApproved", "Approved periodontal record")}</span>
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">
                {t("print.perioSpecialistSign", "Periodontist specialist signature")}
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
