"use client"

import { use } from "react"
import { Printer, Activity, ShieldAlert } from "lucide-react"

export default function PeriodontalChartPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientName?: string
    avgPocket?: string
    bopPercent?: string
    mobilityCount?: string
  }>
}) {
  const {
    patientName = "Hasta Adı Soyadı",
    avgPocket = "2.8 mm (Normal - Hafif Gingivitis)",
    bopPercent = "%14 (Kontrol Altında)",
    mobilityCount = "1 Dişte Derece-1 Sallanma",
  } = use(searchParams)

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Action Bar */}
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Periodontal Diş Eti Muayene Raporu Önizleme</h2>
          <p className="text-xs text-slate-500">Hasta periodontal muayene haritasını resmi rapor olarak yazdırın.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Periodontal Raporu Yazdır / PDF</span>
        </button>
      </div>

      {/* Printable Report Card */}
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-700 font-black text-lg">
              <Activity className="h-6 w-6" />
              <span>DENTALI PERIODONTOLOJİ KLİNİĞİ</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Resmi Diş Eti Cebi & Periodontal Durum Raporu
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500">Tarih: {new Date().toLocaleDateString("tr-TR")}</p>
        </div>

        {/* Patient Summary */}
        <div className="rounded-xl bg-rose-50/60 border border-rose-200 p-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px]">Hasta İsmi</span>
            <p className="font-black text-base text-slate-900">{patientName}</p>
          </div>

          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px]">Klinik Teşhis</span>
            <p className="font-bold text-rose-800">Kronik Periodontitis / Gingival İltihap Takibi</p>
          </div>
        </div>

        {/* Periodontal Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Ortalama Cep Derinliği</span>
            <p className="font-black text-slate-900 text-sm">{avgPocket}</p>
          </div>

          <div className="rounded-xl border border-rose-300 p-3 bg-rose-50/50 space-y-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Sondlamada Kanama (BOP)</span>
            <p className="font-black text-rose-900 text-sm">{bopPercent}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Diş Mobilitesi (Sallanma)</span>
            <p className="font-bold text-slate-900">{mobilityCount}</p>
          </div>
        </div>

        {/* Teeth Probing Depth Grid Visual Demonstration */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            Diş Bölgesi Cep Derinlikleri Ölçüm Haritası (mm)
          </h3>

          <div className="grid grid-cols-8 gap-1.5 text-center text-xs">
            {[11, 12, 13, 14, 15, 16, 17, 18].map((tooth) => (
              <div key={tooth} className="rounded-lg border border-slate-200 p-2 bg-slate-50">
                <span className="font-bold text-[10px] text-slate-400">#{tooth}</span>
                <p className="font-bold text-emerald-700 text-xs">2 mm</p>
                <span className="text-[9px] text-slate-400">Sağlıklı</span>
              </div>
            ))}
          </div>
        </div>

        {/* Treatment Recommendation */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1 text-xs">
          <span className="font-bold text-slate-700 uppercase text-[10px]">Periodontolog Tedavi Önerisi:</span>
          <p className="text-slate-600 leading-relaxed">
            &quot;Hastaya 2 seans Detertraj (Diş Taşı Temizliği) ve Subgingival Küretaj (Diş Eti Kök Yüzeyi Düzleştirmesi) önerilmiştir. 3 ay sonra kontrol sondlaması yapılacaktır.&quot;
          </p>
        </div>

        {/* Footer Signature */}
        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <span>Periodontal Takip Kartı Onaylıdır</span>
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">Periodontolog Uzman Hekim İmza</p>
              <p className="text-[10px] text-slate-500">Dentali Polikliniği</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
