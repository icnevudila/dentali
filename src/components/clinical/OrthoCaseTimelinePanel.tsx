"use client"

import * as React from "react"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import {
  buildOrthoBalanceTimeline,
  buildOrthoPaymentTimeline,
  buildOrthoVisitTimeline,
} from "@/lib/clinical/ortho-timeline"
import type { OrthoAdjustment } from "@/lib/clinical/ortho-service"
import { useLocale } from "@/hooks/use-locale"

type OrthoCaseTimelinePanelProps = {
  contractAmount: number
  adjustments: OrthoAdjustment[]
  compact?: boolean
}

export function OrthoCaseTimelinePanel({
  contractAmount,
  adjustments,
  compact = false,
}: OrthoCaseTimelinePanelProps) {
  const { t } = useLocale()

  const balanceTimeline = React.useMemo(
    () => buildOrthoBalanceTimeline(contractAmount, adjustments),
    [contractAmount, adjustments]
  )
  const visitTimeline = React.useMemo(
    () => buildOrthoVisitTimeline(adjustments),
    [adjustments]
  )
  const paymentTimeline = React.useMemo(
    () => buildOrthoPaymentTimeline(adjustments),
    [adjustments]
  )

  if (adjustments.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {t("ortho.timelineEmpty", "Log visits to see balance and adjustment charts.")}
      </p>
    )
  }

  const peso = (v: number) => `₱${v.toLocaleString()}`

  if (compact) {
    return (
      <ModuleAnalyticsPanel
        title={t("ortho.balanceTimeline", "Balance over visits")}
        variant="area"
        data={balanceTimeline}
        height={140}
        valueFormatter={peso}
        emptyLabel={t("ortho.timelineEmpty", "No visits yet")}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <ModuleAnalyticsPanel
            title={t("ortho.balanceTimeline", "Balance over visits")}
            subtitle={t("ortho.balanceTimelineHint", "Remaining contract balance after each visit")}
            variant="area"
            data={balanceTimeline}
            height={180}
            valueFormatter={peso}
          />
          <ModuleAnalyticsPanel
            title={t("ortho.adjustmentTimeline", "Adjustment timeline")}
            subtitle={t("ortho.visitTimelineHint", "Visits and payments per session")}
            variant="bar"
            data={paymentTimeline.some((p) => p.value > 0) ? paymentTimeline : visitTimeline}
            height={180}
            valueFormatter={
              paymentTimeline.some((p) => p.value > 0)
                ? peso
                : undefined
            }
          />
        </div>
      </div>

      {/* Premium Archwire Progression Visualizer */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-semibold text-neutral-800">Archwire Progression Track</h4>
          <p className="text-xs text-neutral-500 mt-1">Timeline of orthodontic wire changes across visits.</p>
        </div>

        <div className="my-4 h-32 flex items-end justify-between px-2 relative border-b border-neutral-100">
          {/* SVG line and points */}
          {(() => {
            const parsedWires = adjustments
              .map((adj, i) => {
                const text = adj.procedure.toLowerCase()
                const sizeMatch = text.match(/(0\.\d{3}|\d{2}x\d{2})/i)
                if (!sizeMatch) return null
                
                const sizeStr = sizeMatch[1]
                let numVal = parseFloat(sizeStr)
                if (isNaN(numVal)) {
                  const parts = sizeStr.split("x")
                  numVal = ((parseFloat(parts[0]) || 16) + (parseFloat(parts[1]) || 22)) / 1000
                }
                
                let material = "NiTi"
                if (text.includes("ss") || text.includes("steel")) material = "SS"
                else if (text.includes("tma")) material = "TMA"
                
                return {
                  label: `V${adjustments.length - i}`,
                  size: sizeStr,
                  value: numVal || 0.012,
                  material,
                }
              })
              .filter(Boolean)
              .reverse()

            if (parsedWires.length === 0) {
              return (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                  No archwire sizes found in procedures log (e.g. 0.016 NiTi)
                </div>
              )
            }

            const maxVal = Math.max(...parsedWires.map((w) => w!.value))
            const minVal = Math.min(...parsedWires.map((w) => w!.value))
            const valDiff = maxVal - minVal || 1

            return (
              <>
                <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#f5f5f5" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#f5f5f5" strokeWidth="1" strokeDasharray="3" />
                  
                  {/* SVG Path connecting the points */}
                  {parsedWires.length > 1 && (
                    <path
                      d={parsedWires
                        .map((w, index) => {
                          const x = (index / (parsedWires.length - 1)) * 100
                          const y = 80 - ((w!.value - minVal) / valDiff) * 60
                          return `${index === 0 ? "M" : "L"} ${x}% ${y}%`
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="2"
                      className="transition-all duration-500"
                    />
                  )}
                </svg>

                {/* DOM elements for tooltips / circles */}
                {parsedWires.map((w, index) => {
                  const leftPos = parsedWires.length > 1 ? (index / (parsedWires.length - 1)) * 90 : 45
                  const bottomPos = 10 + ((w!.value - minVal) / valDiff) * 60
                  
                  return (
                    <div
                      key={index}
                      className="absolute flex flex-col items-center group cursor-help transition-all duration-300"
                      style={{
                        left: `${leftPos + 5}%`,
                        bottom: `${bottomPos}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 bg-teal-950 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap shadow-md pointer-events-none transition-opacity duration-200">
                        {w!.size} {w!.material}
                      </div>
                      
                      {/* Interactive dot */}
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-600 border-2 border-white shadow-sm ring-1 ring-teal-600/30 group-hover:scale-125 transition-transform" />
                      <span className="text-[10px] font-bold text-teal-800 mt-1">{w!.label}</span>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>

        <div className="flex justify-between items-center text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
          <span>Active Ortho Case Progression</span>
          <span className="flex items-center gap-1 font-medium text-teal-600">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" /> Live Tracker
          </span>
        </div>
      </div>
    </div>
  )
}
