"use client"

import { use, useState } from "react"
import { BeforeAfterSlider } from "@/components/clinical/BeforeAfterSlider"
import { useBranch } from "@/hooks/use-branch"
import { Sparkles, Camera, Plus, Award } from "lucide-react"

interface AestheticCase {
  id: string
  title: string
  procedureType: string
  date: string
  beforeUrl: string
  afterUrl: string
  shadeBefore?: string
  shadeAfter?: string
  notes?: string
}

const SAMPLE_AESTHETIC_CASES: AestheticCase[] = [
  {
    id: "case_1",
    title: "Üst Ön 6 Diş E-Max Lamine Gülüş Tasarımı",
    procedureType: "Porcelain Veneers (E-Max)",
    date: "2026-05-10",
    beforeUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=800&q=80",
    shadeBefore: "A3.5",
    shadeAfter: "BL2 (Bleach)",
    notes: "Hasta gülüş hattı ve estetik görünüm beklentisi karşılandı.",
  },
  {
    id: "case_2",
    title: "Klinik Tipi Ofis Diş Beyazlatma (Bleaching)",
    procedureType: "In-Office Teeth Whitening",
    date: "2026-06-18",
    beforeUrl: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1571772996211-2f02c9727629?auto=format&fit=crop&w=800&q=80",
    shadeBefore: "A3",
    shadeAfter: "B1",
    notes: "2 seans 15 dk lazer destekli beyazlatma uygulandı.",
  },
]

export default function AestheticGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const { activeBranch } = useBranch()
  const [cases] = useState<AestheticCase[]>(SAMPLE_AESTHETIC_CASES)
  const [selectedCase, setSelectedCase] = useState<AestheticCase>(SAMPLE_AESTHETIC_CASES[0])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl border border-purple-800/40">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300 border border-purple-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Estetik Diş Hekimliği & Gülüş Tasarımı</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Öncesi / Sonrası Karşılaştırma Galerisi</h1>
          <p className="text-xs text-slate-300">
            Hastanın estetik tedavilerini, VITA renk değişimini ve öncesi/sonrası fotoğraflarını interaktif olarak inceleyin.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-purple-400 transition-colors shrink-0">
          <Plus className="h-4 w-4" />
          <span>Yeni Vaka Fotoğrafı Ekle</span>
        </button>
      </div>

      {/* Main Interactive Slider */}
      {selectedCase && (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedCase.title}</h2>
              <p className="text-xs text-slate-500">{selectedCase.procedureType} · {selectedCase.date}</p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {selectedCase.shadeBefore && (
                <span className="rounded-lg bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60">
                  İlk Rengi: {selectedCase.shadeBefore}
                </span>
              )}
              {selectedCase.shadeAfter && (
                <span className="rounded-lg bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60">
                  Hedef Rengi: {selectedCase.shadeAfter}
                </span>
              )}
            </div>
          </div>

          <BeforeAfterSlider
            beforeImage={selectedCase.beforeUrl}
            afterImage={selectedCase.afterUrl}
            beforeLabel="Tedavi Öncesi"
            afterLabel="Tedavi Sonrası (Estetik Bitim)"
          />

          {selectedCase.notes && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
              <Award className="h-4 w-4 text-purple-500 shrink-0" />
              <span>Hekim Notu: &quot;{selectedCase.notes}&quot;</span>
            </div>
          )}
        </div>
      )}

      {/* Case Selector Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Kayıtlı Estetik Vakalar</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCase(c)}
              className={`flex items-center gap-4 rounded-2xl p-4 text-left transition-all border ${
                selectedCase.id === c.id
                  ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 shadow-md"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="h-14 w-14 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Camera className="h-6 w-6" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{c.title}</h4>
                <p className="text-xs text-slate-500">{c.procedureType}</p>
                <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  {c.shadeBefore} → {c.shadeAfter}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
