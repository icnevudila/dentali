"use client"

import { use, useEffect, useState } from "react"
import { fetchPatientCertificates, MedicalCertificateRecord } from "@/lib/clinical/medical-certificate-service"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { BRAND_NAME } from "@/lib/brand"
import { Printer, CheckCircle } from "lucide-react"

export default function MedicalCertificatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ certId?: string }>
}) {
  const { id: patientId } = use(params)
  const { certId } = use(searchParams)
  const { t, locale } = useLocale()
  const [cert, setCert] = useState<MedicalCertificateRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatientCertificates(patientId, "").then((res) => {
      if (res.data.length > 0) {
        const target = certId ? res.data.find((c) => c.id === certId) ?? res.data[0] : res.data[0]
        setCert(target)
      }
      setLoading(false)
    })
  }, [patientId, certId])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">
          {t("print.loadingCertificate", "Loading certificate…")}
        </p>
      </div>
    )
  }

  if (!cert) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-sm font-semibold text-rose-600">
          {t("print.emptyCertificate", "No medical certificate found for this patient.")}
        </p>
      </div>
    )
  }

  const daysLabel = t("print.medDays", "{count} days").replace("{count}", String(cert.rest_days))
  const startLabel = formatDate(locale, cert.start_date)
  const body = t(
    "print.medBody",
    "It is hereby certified that the above-named patient underwent dental examination and treatment at our clinic. Due to clinical findings and required post-operative recovery, the patient is advised to rest for {days} days starting from {start}."
  )
    .replace("{days}", String(cert.rest_days))
    .replace("{start}", startLabel)

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {t("print.medPreviewTitle", "Medical rest certificate preview")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("print.medPreviewHint", "Print an official letterhead copy or save as PDF.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>{t("print.printSavePdf", "Print / Save PDF")}</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-8">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900 tracking-wider">
              {BRAND_NAME.toUpperCase()} {t("print.brandClinic", "Clinical operating system").toUpperCase()}
            </h1>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-widest">
              {t("print.medDocTitle", "Official dental medical rest certificate")}
            </p>
          </div>
          <div className="text-right text-xs space-y-0.5 text-slate-600">
            <p className="font-bold">
              {t("print.medDocNo", "Doc No")}: {cert.protocol_no}
            </p>
            <p>
              {t("print.medIssueDate", "Issue date")}: {formatDate(locale, cert.created_at)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-300 overflow-hidden text-xs">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="p-3 font-bold text-slate-600 w-1/3 border-r border-slate-200">
                  {t("print.medPatientRef", "Patient ID / Reference")}:
                </td>
                <td className="p-3 font-black text-slate-900 text-sm">{cert.patient_id}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">
                  {t("print.medDiagnosis", "Clinical diagnosis")}:
                </td>
                <td className="p-3 font-bold text-teal-800">{cert.diagnosis}</td>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">
                  {t("print.medStartDate", "Rest start date")}:
                </td>
                <td className="p-3 font-bold text-slate-800">{formatDate(locale, cert.start_date)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">
                  {t("print.medEndDate", "Rest end date")}:
                </td>
                <td className="p-3 font-bold text-slate-800">{formatDate(locale, cert.end_date)}</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">
                  {t("print.medDuration", "Approved rest duration")}:
                </td>
                <td className="p-3 font-black text-slate-900 text-sm">{daysLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p>{body}</p>
          {cert.notes ? (
            <p className="italic text-slate-600 border-t border-slate-200 pt-2 mt-2">
              {t("print.medAdvice", "Clinical advice")}: &quot;{cert.notes}&quot;
            </p>
          ) : null}
        </div>

        <div className="pt-8 border-t border-slate-300 flex items-end justify-between text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle className="h-4 w-4" />
              <span>{t("print.medQrVerify", "Digital QR verification")}</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {t("print.medQrHint", "Scan to verify document validity.")}
            </p>
          </div>

          <div className="text-center space-y-8">
            <div>
              <p className="font-bold text-slate-900">
                {cert.doctor_name || t("print.medDentistFallback", "Attending dentist signature")}
              </p>
              <p className="text-[10px] text-slate-500">{BRAND_NAME}</p>
            </div>
            <div className="h-10 border-b border-slate-400 w-44 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
