"use client"

import { use } from "react"
import { Printer, Calculator } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { BRAND_NAME } from "@/lib/brand"

export default function TreatmentQuotePrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientName?: string
    totalAmount?: string
    discountAmount?: string
    netAmount?: string
    installment?: string
  }>
}) {
  const raw = use(searchParams)
  const { t, locale } = useLocale()
  const hasData = Boolean(raw.patientName || raw.netAmount || raw.totalAmount)

  if (!hasData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-sm font-semibold text-rose-600">
          {t(
            "print.emptyQuote",
            "No treatment quote data to print. Open this page from an approved treatment estimate."
          )}
        </p>
      </div>
    )
  }

  const patientName = raw.patientName ?? t("print.notSpecified", "Not specified")
  const totalAmount = raw.totalAmount ?? "—"
  const discountAmount = raw.discountAmount ?? "—"
  const netAmount = raw.netAmount ?? "—"
  const installment = raw.installment ?? "—"

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {t("print.quotePreviewTitle", "Treatment plan cost estimate preview")}
          </h2>
          <p className="text-xs text-slate-500">
            {t(
              "print.quotePreviewHint",
              "Print the approved treatment cost estimate and payment plan for the patient."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>{t("print.printQuote", "Print treatment quote / Save PDF")}</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-700 font-black text-lg">
              <Calculator className="h-6 w-6" />
              <span>{BRAND_NAME.toUpperCase()}</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {t("print.quoteDocTitle", "Official treatment cost estimate & payment plan")}
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500">
            {t("print.quoteDate", "Quote date")}: {formatDate(locale, new Date())}
          </p>
        </div>

        <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-4 flex justify-between items-center text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px]">
              {t("print.quotePatient", "Valued patient")}
            </span>
            <p className="font-black text-base text-slate-900">{patientName}</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-slate-400 uppercase text-[10px]">
              {t("print.quoteValidity", "Quote validity")}
            </span>
            <p className="font-bold text-blue-800">
              {t("print.quoteValidDays", "Valid for 30 days")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            {t("print.quoteBreakdown", "Proposed treatment procedures")}
          </h3>

          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                <th className="p-2.5 font-bold">{t("print.quoteProcedure", "Procedure / Description")}</th>
                <th className="p-2.5 font-bold text-center">{t("print.quoteTooth", "Tooth No")}</th>
                <th className="p-2.5 font-bold text-right">{t("print.quoteFee", "Fee")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="p-4 text-center text-slate-400">
                  {t("print.emptyQuoteLines", "No procedure line items on this quote.")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-300 p-4 bg-slate-50 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>{t("print.quoteGross", "Total gross standard fee")}:</span>
            <span className="font-bold text-slate-900">{totalAmount}</span>
          </div>

          <div className="flex justify-between items-center text-emerald-700 font-semibold">
            <span>{t("print.quoteDiscount", "Applied clinic courtesy / discount")}:</span>
            <span>- {discountAmount}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-300 text-sm font-black text-slate-900">
            <span>{t("print.quoteNet", "Net total payable")}:</span>
            <span className="text-blue-700 text-base">{netAmount}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 text-slate-600 flex justify-between items-center">
            <span>{t("print.quoteInstallment", "Payment / installment option")}:</span>
            <span className="font-bold text-slate-900">{installment}</span>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">
                {t("print.quotePatientSign", "Patient acceptance signature")}
              </p>
              <p className="text-[10px] text-slate-500">
                {t("print.quotePatientSignHint", "I accept the proposed treatment & payment plan.")}
              </p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">
                {t("print.quoteClinicSign", "Clinic representative signature")}
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
