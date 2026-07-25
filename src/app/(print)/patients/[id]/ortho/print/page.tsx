"use client"

import { use, useEffect, useState } from "react"
import { fetchOrthoPrintData, OrthoPrintData } from "@/lib/clinical/ortho-print"
import { Printer, Calendar, User, Activity } from "lucide-react"

export default function OrthoPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const [orthoData, setOrthoData] = useState<OrthoPrintData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrthoPrintData(patientId).then((res) => {
      setOrthoData(res.data)
      setLoading(false)
    })
  }, [patientId])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Ortodonti takip formu hazırlanıyor...</p>
      </div>
    )
  }

  if (!orthoData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-rose-600">Ortodonti vaka kaydı bulunamadı.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      <div className="no-print mb-6 flex items-center justify-between max-w-4xl mx-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Ortodonti Vaka Muayene Formu Önizleme</h2>
          <p className="text-xs text-slate-500">Fiziki dosyaya eklemek veya hastaya vermek için &quot;Yazdır&quot; butonuna basınız.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-md"
        >
          <Printer className="h-4 w-4" />
          <span>Yazdır / Form Çıktısı Al</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto rounded-none bg-white p-8 shadow-lg border border-slate-200 print:shadow-none print:border-none print:p-4 space-y-6 font-sans">
        {/* Letterhead Header */}
        <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-md">
              O
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">DENTALI ORTODONTİ KLİNİK FORMU</h1>
              <p className="text-xs font-semibold text-indigo-600">Ortodontik Tedavi & Vaka Takip Kartı</p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 space-y-0.5">
            <p className="font-bold text-slate-800">Tarih: {new Date().toLocaleDateString("tr-TR")}</p>
            <p>Vaka ID: {orthoData.case_id}</p>
          </div>
        </div>

        {/* Patient & Case Summary Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <User className="h-4 w-4 text-indigo-600" />
              <span>Hasta: {orthoData.patient_name}</span>
            </div>
            <p className="text-slate-600">Doğum Tarihi: {orthoData.birth_date || "Belirtilmemiş"}</p>
            <p className="text-slate-600">Telefon: {orthoData.phone || "Belirtilmemiş"}</p>
          </div>

          <div className="space-y-2 border-l border-slate-200 pl-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span>Teşhis: {orthoData.malocclusion_type}</span>
            </div>
            <p className="text-slate-600">Aparey / Braket: {orthoData.appliance_type}</p>
            <div className="flex items-center gap-4 text-slate-700 font-semibold pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Başlangıç: {orthoData.start_date}
              </span>
              <span>Tahmini Süre: {orthoData.estimated_months} Ay</span>
            </div>
          </div>
        </div>

        {/* Prescription details: Archwires & Elastics */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 p-3 space-y-1">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] text-indigo-700">Ark Teli Takip Notları</h4>
            <p className="text-slate-700">{orthoData.archwires_upper || "Üst Çene: 0.014 NiTi"}</p>
            <p className="text-slate-700">{orthoData.archwires_lower || "Alt Çene: 0.014 NiTi"}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-1">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] text-indigo-700">Elastik & İntermaksiller Ayarlar</h4>
            <p className="text-slate-700">{orthoData.elastics_config || "Gerekli görüldüğünde sınıf II elastik"}</p>
            {orthoData.notes && <p className="text-slate-500 italic text-[11px]">&quot;{orthoData.notes}&quot;</p>}
          </div>
        </div>

        {/* Visit Log Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Seans ve Ziyaret Geçmişi</h3>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-28">Tarih</th>
                <th className="p-2.5">Yapılan İşlem</th>
                <th className="p-2.5">Sonraki Randevu Planı</th>
                <th className="p-2.5 w-36">Hekim İmzası</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orthoData.visits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">
                    Henüz kayıtlı ziyaret bulunmamaktadır.
                  </td>
                </tr>
              ) : (
                orthoData.visits.map((visit, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-semibold text-slate-800">{visit.visit_date}</td>
                    <td className="p-2.5 text-slate-900 font-medium">{visit.procedure || "-"}</td>
                    <td className="p-2.5 text-slate-600">{visit.next_procedure || "-"}</td>
                    <td className="p-2.5 border-l border-slate-200"></td>
                  </tr>
                ))
              )}
              {/* Additional blank rows for paper fill */}
              {Array.from({ length: Math.max(0, 5 - orthoData.visits.length) }).map((_, i) => (
                <tr key={`blank_${i}`} className="h-10">
                  <td className="p-2.5 border-b border-slate-100"></td>
                  <td className="p-2.5 border-b border-slate-100"></td>
                  <td className="p-2.5 border-b border-slate-100"></td>
                  <td className="p-2.5 border-b border-slate-100 border-l border-slate-200"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Signature */}
        <div className="pt-6 flex items-center justify-between border-t border-slate-200 text-xs">
          <p className="text-slate-400">Dentali Ortodonti Bilgi Sistemi - Muayene Formu Çıktısı</p>
          <div className="text-right space-y-6">
            <p className="font-bold text-slate-800">Ortodonti Uzmanı Hekim İmza / Kaşe</p>
            <div className="h-10 border-b border-slate-300 w-44 ml-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
