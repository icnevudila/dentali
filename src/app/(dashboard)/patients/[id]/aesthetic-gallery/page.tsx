"use client"

import { useState } from "react"
import { BeforeAfterSlider } from "@/components/clinical/BeforeAfterSlider"
import { Sparkles, Camera, Award } from "lucide-react"

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
    title: "Upper Anterior 6 Teeth E-Max Porcelain Veneers",
    procedureType: "Porcelain Veneers (E-Max)",
    date: "2026-05-10",
    beforeUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=800&q=80",
    shadeBefore: "A3.5",
    shadeAfter: "BL2 (Bleach)",
    notes: "Smile line and aesthetic harmony fully restored.",
  },
  {
    id: "case_2",
    title: "In-Office Teeth Whitening Protocol (Laser Bleaching)",
    procedureType: "In-Office Teeth Whitening",
    date: "2026-06-18",
    beforeUrl: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80",
    afterUrl: "https://images.unsplash.com/photo-1571772996211-2f02c9727629?auto=format&fit=crop&w=800&q=80",
    shadeBefore: "A3",
    shadeAfter: "B1",
    notes: "Two 15-minute sessions of laser-assisted bleaching performed.",
  },
]

export default function AestheticGalleryPage() {
  const [selectedCase] = useState<AestheticCase>(SAMPLE_AESTHETIC_CASES[0])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl border border-purple-800/40">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300 border border-purple-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Aesthetic Dentistry & Smile Design</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Before / After Interactive Comparison Gallery</h1>
          <p className="text-xs text-purple-200/80">
            Compare intraoral photos before and after treatment using the interactive slider.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-md border border-purple-400/30">
          <Camera className="h-4 w-4" />
          <span>Upload Clinical Photo</span>
        </button>
      </div>

      {/* Main Interactive Slider Display */}
      {selectedCase && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedCase.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Procedure: {selectedCase.procedureType} • {selectedCase.date}</p>
              </div>
            </div>

            {/* Slider */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
              <BeforeAfterSlider
                beforeImage={selectedCase.beforeUrl}
                afterImage={selectedCase.afterUrl}
                beforeLabel="Before Treatment"
                afterLabel="After Treatment (Aesthetic Finish)"
              />
            </div>
          </div>

          {/* Case Clinical Specs Sidebar */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Award className="h-4 w-4 text-purple-600" />
              <span>Case Clinical Specifications</span>
            </h3>

            {selectedCase.shadeBefore && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Initial Tooth Shade (VITA)</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedCase.shadeBefore}</p>
              </div>
            )}

            {selectedCase.shadeAfter && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Final Tooth Shade (VITA)</span>
                <p className="text-sm font-bold text-emerald-600">{selectedCase.shadeAfter}</p>
              </div>
            )}

            {selectedCase.notes && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Doctor Notes & Aesthetic Plan</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed">
                  {selectedCase.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
