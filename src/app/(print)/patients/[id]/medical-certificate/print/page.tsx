"use client"

import { use, useEffect, useState } from "react"
import { fetchPatientCertificates, MedicalCertificateRecord } from "@/lib/clinical/medical-certificate-service"
import { Shield, Printer, CheckCircle } from "lucide-react"

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
        <p className="text-sm font-semibold text-slate-600">Rapor hazırlanıyor...</p>
      </div>
    )
  }

  if (!cert) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-rose-600">Geçerli bir tıbbi rapor bulunamadı.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Tıbbi İstirahat Raporu Önizleme</h2>
          <p className="text-xs text-slate-500">Resmi çıktı almak için &quot;Yazdır&quot; butonuna basınız.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Yazdır / PDF İndir</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto rounded-none bg-white p-10 shadow-lg border border-slate-200 print:shadow-none print:border-none print:p-6 space-y-8 font-sans">
        {/* Header Letterhead */}
        <div className="flex items-center justify-between border-b-2 border-teal-600 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white font-black text-xl shadow-md">
              D
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">DENTALI DİŞ SAĞLIĞI KLİNİĞİ</h1>
              <p className="text-xs font-medium text-slate-500">Ağız ve Diş Sağlığı Polikliniği Muayene & Rapor Servisi</p>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="inline-flex items-center gap-1 font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
              <Shield className="h-3.5 w-3.5" />
              <span>Protokol No: {cert.protocol_no}</span>
            </div>
            <p className="text-[11px] text-slate-500">Tarih: {new Date(cert.created_at).toLocaleDateString("tr-TR")}</p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1 py-2">
          <h2 className="text-lg font-extrabold uppercase tracking-wider text-slate-900">TIBBİ İSTİRAHAT VE MUAYENE RAPORU</h2>
          <div className="h-0.5 w-24 bg-teal-500 mx-auto rounded-full" />
        </div>

        {/* Main Certificate Content */}
        <div className="space-y-6 text-sm leading-relaxed">
          <p>
            Yukarıda protokol numarası belirtilen hastamızın kliniğimizde yapılan ağız, diş ve çene muayenesi neticesinde aşağıdaki klinik tablo ve istirahat kararı uygun görülmüştür:
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold text-slate-500 text-xs uppercase">Klinik Tanı / Teşhis:</span>
              <span className="col-span-2 font-bold text-slate-900 text-sm">{cert.diagnosis}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold text-slate-500 text-xs uppercase">İstirahat Süresi:</span>
              <span className="col-span-2 font-bold text-teal-700 text-sm">{cert.rest_days} (Onaylı Gün)</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold text-slate-500 text-xs uppercase">Başlangıç - Bitiş Tarihi:</span>
              <span className="col-span-2 font-medium text-slate-800 text-sm">
                {cert.start_date} ile {cert.end_date} tarihleri arasında istirahati uygundur.
              </span>
            </div>

            {cert.notes && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-500 text-xs uppercase">Tıbbi Notlar:</span>
                <span className="col-span-2 text-slate-700 text-xs italic">{cert.notes}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            İşbu rapor, hastanın kurum ve kuruluşlara sunabilmesi amacıyla hekim tarafından dijital olarak düzenlenip onaylanmıştır.
          </p>
        </div>

        {/* Footer Signature & Verification Area */}
        <div className="pt-8 grid grid-cols-2 gap-8 items-end border-t border-slate-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
              <CheckCircle className="h-4 w-4" />
              <span>Elektronik İmzalı & Onaylı Belge</span>
            </div>
            <div className="h-16 w-32 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 bg-slate-50">
              Karekod / Dijital Doğrulama
            </div>
          </div>

          <div className="text-center space-y-8">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Düzenleyen Hekim Imzası</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{cert.doctor_name || "Dr. Dt. Dentali Hekim"}</p>
              <p className="text-[11px] text-slate-500">Ağız, Diş ve Çene Cerrahisi / Diş Hekimi</p>
            </div>
            <div className="h-12 border-b border-slate-400 w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
