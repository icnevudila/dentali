"use client"

import { use, useEffect, useState } from "react"
import { fetchPatientCertificates, MedicalCertificateRecord } from "@/lib/clinical/medical-certificate-service"
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
        <p className="text-sm font-semibold text-slate-600">Loading certificate...</p>
      </div>
    )
  }

  if (!cert) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-rose-600">No valid medical certificate found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Medical Rest Certificate Preview</h2>
          <p className="text-xs text-slate-500">Click &quot;Print&quot; to output an official letterhead copy or save to PDF.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-8">
        {/* Letterhead */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900 tracking-wider">DENTALI CLINICAL OPERATING SYSTEM</h1>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-widest">Official Dental Medical Rest Certificate</p>
          </div>
          <div className="text-right text-xs space-y-0.5 text-slate-600">
            <p className="font-bold">Doc No: {cert.protocol_no}</p>
            <p>Issue Date: {new Date(cert.created_at).toLocaleDateString("en-US")}</p>
          </div>
        </div>

        {/* Patient Details Table */}
        <div className="rounded-xl border border-slate-300 overflow-hidden text-xs">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="p-3 font-bold text-slate-600 w-1/3 border-r border-slate-200">Patient ID / Reference:</td>
                <td className="p-3 font-black text-slate-900 text-sm">{cert.patient_id}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Clinical Diagnosis:</td>
                <td className="p-3 font-bold text-teal-800">{cert.diagnosis}</td>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Rest Start Date:</td>
                <td className="p-3 font-bold text-slate-800">{new Date(cert.start_date).toLocaleDateString("en-US")}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Rest End Date:</td>
                <td className="p-3 font-bold text-slate-800">{new Date(cert.end_date).toLocaleDateString("en-US")}</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-600 border-r border-slate-200">Approved Rest Duration:</td>
                <td className="p-3 font-black text-slate-900 text-sm">{cert.rest_days} Days</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Official Body Statement */}
        <div className="space-y-3 text-xs leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p>
            It is hereby certified that the above-named patient underwent dental examination and treatment at our clinic. Due to clinical findings and required post-operative recovery, the patient is advised to rest for <span className="font-bold">{cert.rest_days} days</span> starting from <span className="font-bold">{new Date(cert.start_date).toLocaleDateString("en-US")}</span>.
          </p>
          {cert.notes && (
            <p className="italic text-slate-600 border-t border-slate-200 pt-2 mt-2">
              Clinical Advice: &quot;{cert.notes}&quot;
            </p>
          )}
        </div>

        {/* QR & Doctor Signature */}
        <div className="pt-8 border-t border-slate-300 flex items-end justify-between text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle className="h-4 w-4" />
              <span>Digital QR Verification</span>
            </div>
            <p className="text-[10px] text-slate-400">Scan to verify document validity.</p>
          </div>

          <div className="text-center space-y-8">
            <div>
              <p className="font-bold text-slate-900">{cert.doctor_name || "Attending Dentist Signature"}</p>
              <p className="text-[10px] text-slate-500">Dentali Health Center</p>
            </div>
            <div className="h-10 border-b border-slate-400 w-44 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
