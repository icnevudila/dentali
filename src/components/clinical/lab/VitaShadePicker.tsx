"use client"

import { useState } from "react"
import { Check } from "lucide-react"

export interface VitaShade {
  code: string
  name: string
  group: "A" | "B" | "C" | "D" | "Bleach"
  hexColor: string
}

export const VITA_SHADES: VitaShade[] = [
  // Group A (Reddish-brownish)
  { code: "A1", name: "A1 (Açık Beyaz)", group: "A", hexColor: "#f6f1e7" },
  { code: "A2", name: "A2 (Doğal Standart)", group: "A", hexColor: "#eee3d0" },
  { code: "A3", name: "A3 (Orta Sarı)", group: "A", hexColor: "#e6d5bd" },
  { code: "A3.5", name: "A3.5 (Koyu Sarı)", group: "A", hexColor: "#dbc5aa" },
  { code: "A4", name: "A4 (Kahve-Sarı)", group: "A", hexColor: "#cbb496" },

  // Group B (Reddish-yellowish)
  { code: "B1", name: "B1 (Çok Açık)", group: "B", hexColor: "#f9f5ec" },
  { code: "B2", name: "B2 (Açık Sarı)", group: "B", hexColor: "#f0e7d5" },
  { code: "B3", name: "B3 (Canlı Sarı)", group: "B", hexColor: "#e3d4bb" },
  { code: "B4", name: "B4 (Koyu Sarı-Kahve)", group: "B", hexColor: "#d8c3a5" },

  // Group C (Greyish)
  { code: "C1", name: "C1 (Açık Gri)", group: "C", hexColor: "#ede7dd" },
  { code: "C2", name: "C2 (Gri-Kahve)", group: "C", hexColor: "#e2d7c7" },
  { code: "C3", name: "C3 (Koyu Gri)", group: "C", hexColor: "#d3c5b2" },
  { code: "C4", name: "C4 (Derin Gri)", group: "C", hexColor: "#c2b29e" },

  // Group D (Reddish-grey)
  { code: "D2", name: "D2 (Gri-Kırmızı)", group: "D", hexColor: "#ebdccb" },
  { code: "D3", name: "D3 (Orta Gri-Kırmızı)", group: "D", hexColor: "#dfceb8" },
  { code: "D4", name: "D4 (Koyu Gri-Kırmızı)", group: "D", hexColor: "#d2be9f" },

  // Bleach Shades (Ultra-White Aesthetic)
  { code: "BL1", name: "BL1 (Ultra Bleach)", group: "Bleach", hexColor: "#ffffff" },
  { code: "BL2", name: "BL2 (Extra Bleach)", group: "Bleach", hexColor: "#fcfbfa" },
  { code: "BL3", name: "BL3 (Soft Bleach)", group: "Bleach", hexColor: "#f8f6f0" },
  { code: "BL4", name: "BL4 (Natural Bleach)", group: "Bleach", hexColor: "#f3efe6" },
]

interface VitaShadePickerProps {
  selectedShade?: string
  onSelectShade: (shade: string) => void
  label?: string
}

export function VitaShadePicker({
  selectedShade = "A2",
  onSelectShade,
  label = "VITA Diş Renk Tonu Seçici",
}: VitaShadePickerProps) {
  const [activeGroup, setActiveGroup] = useState<"ALL" | "A" | "B" | "C" | "D" | "Bleach">("ALL")

  const filteredShades = VITA_SHADES.filter(
    (s) => activeGroup === "ALL" || s.group === activeGroup
  )

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          {label}
        </label>
        <div className="flex flex-wrap gap-1">
          {(["ALL", "A", "B", "C", "D", "Bleach"] as const).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setActiveGroup(group)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activeGroup === group
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {group === "ALL" ? "Tümü" : group}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {filteredShades.map((shade) => {
          const isSelected = selectedShade === shade.code
          return (
            <button
              key={shade.code}
              type="button"
              onClick={() => onSelectShade(shade.code)}
              className={`relative flex flex-col items-center justify-between rounded-xl p-2.5 text-center transition-all border ${
                isSelected
                  ? "border-teal-500 bg-white ring-2 ring-teal-500/20 shadow-md dark:bg-slate-950"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
              }`}
            >
              {/* Swatch Circle */}
              <div
                className="h-7 w-7 rounded-full border border-slate-300 dark:border-slate-700 shadow-inner flex items-center justify-center"
                style={{ backgroundColor: shade.hexColor }}
              >
                {isSelected && <Check className="h-4 w-4 text-teal-700 font-extrabold" />}
              </div>

              <span className="mt-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                {shade.code}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
