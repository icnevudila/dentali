"use client"

import { use } from "react"
import { Printer, ShieldCheck, Award, CheckCircle2 } from "lucide-react"

export default function GuaranteeCertificatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    patientName?: string
    treatment?: string
    teeth?: string
    years?: string
    certNo?: string
  }>
}) {
  const { id: patientId } = use(params)
  const {
    patientName = "Hasta Adı Soyadı",
    treatment = "Zirkonyum Porselen Kron / İmplant Destekli Protez",
    teeth = "#11, #12, #21, #22 (Üst Ön Estetik Bölge)",
    years = "5",
    certNo = `GRN-${Date.now().toString().slice(-6)}`,
  } = use(searchParams)

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      {/* Action Bar */}
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Diş Protez & İmplant Garanti Sertifikası Önizleme</h2>
          <p className="text-xs text-slate-500">Resmi sertifikayı hastaya teslim etmek için &quot;Yazdır&quot; butonuna basınız.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Sertifikayı Yazdır / PDF</span>
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
          <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">DENTALI DİŞ SAĞLIĞI KLİNİĞİ</h1>
          <p className="text-xs uppercase tracking-widest text-amber-700 font-sans font-bold">Resmi Klinik Protez & İmplant Garanti Sertifikası</p>
        </div>

        {/* Certificate Body Text */}
        <div className="text-center space-y-6 font-sans">
          <p className="text-sm text-slate-600">İşbu belge ile kliniğimizde gerçekleştirilen tedaviye ilişkin olarak;</p>

          <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-6 space-y-4 text-left">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="font-bold text-slate-500 text-xs uppercase">Sertifika Sahibi Hasta:</span>
              <span className="col-span-2 font-black text-slate-900 text-base">{patientName}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="font-bold text-slate-500 text-xs uppercase">Uygulanan Tedavi:</span>
              <span className="col-span-2 font-bold text-slate-800">{treatment}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="font-bold text-slate-500 text-xs uppercase">Tedavi Edilen Diş No:</span>
              <span className="col-span-2 font-semibold text-slate-800">{teeth}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="font-bold text-slate-500 text-xs uppercase">Garanti Süresi:</span>
              <span className="col-span-2 font-black text-amber-700 text-base">{years} Yıl Koşulsuz Üretici & Klinik Garantisi</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t border-amber-200">
              <span className="font-bold text-slate-500 text-xs uppercase">Sertifika / Seri No:</span>
              <span className="col-span-2 font-mono font-bold text-slate-900">{certNo}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed px-4">
            Bu sertifika, yukarıda belirtilen protez ve materyalin üretim, laboratuvar ve klinik uygulama hatalarına karşı verilen resmi taahhüttür.
          </p>
        </div>

        {/* Footer Signature */}
        <div className="pt-8 flex items-center justify-between border-t border-slate-200 font-sans text-xs">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <ShieldCheck className="h-5 w-5" />
            <span>Onaylı Resmi Garanti Belgesi</span>
          </div>

          <div className="text-center space-y-8">
            <div>
              <p className="font-bold text-slate-900">Mesul Müdür Hekim İmzası & Kaşe</p>
              <p className="text-[11px] text-slate-500">Dentali Ağız ve Diş Sağlığı Polikliniği</p>
            </div>
            <div className="h-10 border-b border-slate-400 w-44 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
