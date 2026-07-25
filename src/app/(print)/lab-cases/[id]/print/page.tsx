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
    patientName = "Hasta Adı Soyadı",
    labName = "Özel Diş Protez Laboratuvarı",
    workType = "Zirkonyum Porselen Kron / Estetik Lamine",
    teeth = "#11, #12, #21, #22 (Üst Ön Estetik Bölge)",
    shade = "A2 (VITA Classical)",
    targetDate = "2026-08-05",
    orderNo = `LAB-${caseId.slice(0, 8).toUpperCase()}`,
  } = use(searchParams)

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Action Bar */}
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Diş Laboratuvarı Resmi İş Emri Önizleme</h2>
          <p className="text-xs text-slate-500">Protez vakasını laboratuvara gönderirken çıktısını alıp teslim ediniz.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>İş Emrini Yazdır / PDF</span>
        </button>
      </div>

      {/* Official Printable Lab Work Order Sheet */}
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6 relative">
        {/* Header Banner */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-teal-700 font-black text-lg">
              <FlaskConical className="h-6 w-6" />
              <span>DENTALI AĞIZ VE DİŞ SAĞLIĞI POLİKLİNİĞİ</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Resmi Diş Protez Laboratuvar Sipariş & Prova Takip Pusulası
            </p>
          </div>

          <div className="text-right space-y-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1 font-mono text-xs font-bold text-white">
              {orderNo}
            </span>
            <p className="text-[11px] text-slate-500 font-medium">Tarih: {new Date().toLocaleDateString("tr-TR")}</p>
          </div>
        </div>

        {/* Patient & Lab Details Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
          <div className="space-y-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Hasta Bilgileri</span>
            <p className="font-extrabold text-sm text-slate-900">{patientName}</p>
            <p className="text-slate-600">İşlem Gören Dişler: <span className="font-bold text-slate-800">{teeth}</span></p>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Laboratuvar & Hedef Tarih</span>
            <p className="font-bold text-sm text-teal-800">{labName}</p>
            <div className="flex items-center gap-1 text-slate-700 font-semibold">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Teslim Target Tarihi: {targetDate}</span>
            </div>
          </div>
        </div>

        {/* Work Order Specifications */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            Sipariş & Materyal Detayları
          </h3>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Restorasyon Tipi</span>
              <p className="font-bold text-slate-900">{workType}</p>
            </div>

            <div className="rounded-lg border border-amber-300 p-3 bg-amber-50/50 space-y-1">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Seçilen VITA Renk Tonu</span>
              <p className="font-black text-amber-900 text-sm">{shade}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Estetik Marjin</span>
              <p className="font-bold text-slate-900">Basamaklı Zirkon / Subgingival</p>
            </div>
          </div>
        </div>

        {/* Try-in Stages Checklist */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            Laboratuvar Prova & Kalite Takip Adımları
          </h3>

          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              { label: "1. Altyapı Provası", date: "___ / ___ / 2026" },
              { label: "2. Dentin Provası", date: "___ / ___ / 2026" },
              { label: "3. Oklüzyon & Rejistrasyon", date: "___ / ___ / 2026" },
              { label: "4. Glaze & Simantasyon", date: "___ / ___ / 2026" },
            ].map((stage, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3 text-center space-y-1">
                <CheckSquare className="h-4 w-4 mx-auto text-slate-400" />
                <span className="font-bold text-slate-800 text-[11px] block">{stage.label}</span>
                <span className="text-[10px] text-slate-400 font-mono block">{stage.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Special Technician Instructions */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-1 bg-slate-50/50 text-xs">
          <span className="font-bold text-slate-700 uppercase text-[10px]">Diş Hekiminin Özel Teknisyen Notu:</span>
          <p className="text-slate-600 italic">
            &quot;Anatomik insizal şeffaflık veriniz. Papil uçları estetik olarak doldurulsun. Kontak noktaları sıkı simantasyona uygun olsun.&quot;
          </p>
        </div>

        {/* Signature Row */}
        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>Klinik & Laboratuvar İş Birliği Onaylıdır</span>
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">Diş Hekimi İmza & Kaşe</p>
              <p className="text-[10px] text-slate-500">Dentali Ağız ve Diş Sağlığı</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
