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
  { code: "A1", name: "A1 (Light White)", group: "A", hexColor: "#f6f1e7" },
  { code: "A2", name: "A2 (Natural Standard)", group: "A", hexColor: "#eee3d0" },
  { code: "A3", name: "A3 (Medium Yellow)", group: "A", hexColor: "#e6d5bd" },
  { code: "A3.5", name: "A3.5 (Dark Yellow)", group: "A", hexColor: "#dbc5aa" },
  { code: "A4", name: "A4 (Brownish Yellow)", group: "A", hexColor: "#cbb496" },

  // Group B (Reddish-yellowish)
  { code: "B1", name: "B1 (Extra Light)", group: "B", hexColor: "#f9f5ec" },
  { code: "B2", name: "B2 (Light Yellow)", group: "B", hexColor: "#f0e7d5" },
  { code: "B3", name: "B3 (Vivid Yellow)", group: "B", hexColor: "#e3d4bb" },
  { code: "B4", name: "B4 (Dark Yellow Brown)", group: "B", hexColor: "#d8c3a5" },

  // Group C (Greyish)
  { code: "C1", name: "C1 (Light Grey)", group: "C", hexColor: "#ede7dd" },
  { code: "C2", name: "C2 (Greyish Brown)", group: "C", hexColor: "#e2d7c7" },
  { code: "C3", name: "C3 (Dark Grey)", group: "C", hexColor: "#d3c5b2" },
  { code: "C4", name: "C4 (Deep Grey)", group: "C", hexColor: "#c2b29e" },

  // Group D (Reddish-grey)
  { code: "D2", name: "D2 (Reddish Grey)", group: "D", hexColor: "#ebdccb" },
  { code: "D3", name: "D3 (Medium Reddish Grey)", group: "D", hexColor: "#dfceb8" },
  { code: "D4", name: "D4 (Dark Reddish Grey)", group: "D", hexColor: "#d2be9f" },

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
  label = "VITA Tooth Shade Picker",
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
              {group === "ALL" ? "All" : group}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
        {filteredShades.map((shade) => {
          const isSelected = selectedShade === shade.code
          return (
            <button
              key={shade.code}
              type="button"
              onClick={() => onSelectShade(shade.code)}
              className={`relative flex flex-col items-center justify-between rounded-xl p-2 text-center transition-all ${
                isSelected
                  ? "ring-2 ring-teal-600 ring-offset-2 dark:ring-offset-slate-900 scale-105 shadow-md bg-white dark:bg-slate-800"
                  : "bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 hover:scale-100 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <div
                className="h-6 w-full rounded-lg border border-slate-300 dark:border-slate-600 shadow-inner mb-1"
                style={{ backgroundColor: shade.hexColor }}
              />
              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">{shade.code}</span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full">{shade.name.split(" ")[1] || ""}</span>

              {isSelected && (
                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white">
                  <Check className="h-2.5 w-2.5" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
