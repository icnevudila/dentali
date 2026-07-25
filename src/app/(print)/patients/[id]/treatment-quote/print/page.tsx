"use client"

import { use } from "react"
import { Printer, Calculator, FileCheck, ShieldCheck } from "lucide-react"

export default function TreatmentQuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    patientName?: string
    totalAmount?: string
    discountAmount?: string
    netAmount?: string
    installment?: string
  }>
}) {
  const { id: patientId } = use(params)
  const {
    patientName = "Hasta Adı Soyadı",
    totalAmount = "45.000 ₺",
    discountAmount = "5.000 ₺ (Klinik İndirimi)",
    netAmount = "40.000 ₺",
    installment = "4 Taksit (10.000 ₺ / Ay)",
  } = use(searchParams)

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Action Bar */}
      <div className="no-print mb-6 flex items-center justify-between max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Tedavi Planı Fiyat Teklifi Formu Önizleme</h2>
          <p className="text-xs text-slate-500">Hastaya sunulacak onaylı tedavi maliyet ve taksit planını yazdırın.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Fiyat Teklifini Yazdır / PDF</span>
        </button>
      </div>

      {/* Printable Quote Sheet */}
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 shadow-2xl border-2 border-slate-300 print:shadow-none print:border-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-700 font-black text-lg">
              <Calculator className="h-6 w-6" />
              <span>DENTALI AĞIZ VE DİŞ SAĞLIĞI POLİKLİNİĞİ</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Resmi Tedavi Planı Maliyet Teklifi & Ödeme Çizelgesi
            </p>
          </div>
          <p className="text-xs font-bold text-slate-500">Teklif Tarihi: {new Date().toLocaleDateString("tr-TR")}</p>
        </div>

        {/* Patient Details */}
        <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-4 flex justify-between items-center text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px]">Sayın Hasta</span>
            <p className="font-black text-base text-slate-900">{patientName}</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Teklif Geçerlilik Süresi</span>
            <p className="font-bold text-blue-800">30 Gün Geçerli</p>
          </div>
        </div>

        {/* Treatment Items Breakdown */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            Planlanan Tedavi Prosedürleri Listesi
          </h3>

          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                <th className="p-2.5 font-bold">Prosedür / Tedavi Açıklaması</th>
                <th className="p-2.5 font-bold text-center">Diş No</th>
                <th className="p-2.5 font-bold text-right">Birim Fiyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2.5 font-medium text-slate-900">Zirkonyum Porselen Kaplama Kron (E-Max Destekli)</td>
                <td className="p-2.5 text-center font-bold text-slate-600">#11, #12, #21, #22</td>
                <td className="p-2.5 text-right font-bold text-slate-900">24.000 ₺</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-900">Titanyum İmplant Uygulaması (Geniş Çap)</td>
                <td className="p-2.5 text-center font-bold text-slate-600">#36, #46</td>
                <td className="p-2.5 text-right font-bold text-slate-900">16.000 ₺</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-900">Kanal Tedavisi (Endodonti 2 Kök) & Estetik Kompozit Dolgu</td>
                <td className="p-2.5 text-center font-bold text-slate-600">#15</td>
                <td className="p-2.5 text-right font-bold text-slate-900">5.000 ₺</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="rounded-xl border border-slate-300 p-4 bg-slate-50 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>Toplam Brüt Liste Fiyatı:</span>
            <span className="font-bold text-slate-900">{totalAmount}</span>
          </div>

          <div className="flex justify-between items-center text-emerald-700 font-semibold">
            <span>Uygulanan Klinik İndirimi:</span>
            <span>- {discountAmount}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-300 text-sm font-black text-slate-900">
            <span>NET ÖDENECEK TUTAR:</span>
            <span className="text-blue-700 text-base">{netAmount}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 text-slate-600 flex justify-between items-center">
            <span>Ödeme / Taksit Seçeneği:</span>
            <span className="font-bold text-slate-900">{installment}</span>
          </div>
        </div>

        {/* Patient Approval & Signatures */}
        <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs">
          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">Hasta Onay İmzası</p>
              <p className="text-[10px] text-slate-500">Tedavi ve fiyat teklifini kabul ediyorum.</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>

          <div className="text-center space-y-6">
            <div>
              <p className="font-bold text-slate-900">Hekim / Klinik Yetkilisi İmza</p>
              <p className="text-[10px] text-slate-500">Dentali Polikliniği</p>
            </div>
            <div className="h-8 border-b border-slate-400 w-36 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
