"use client"

import * as React from "react"
import { AnatomicOdontogramChart } from "./AnatomicOdontogramChart"
import { OdontogramQuickBar } from "./OdontogramQuickBar"
import { ToothFinding } from "@/lib/types/dental"
import { isPrimaryToothNumber } from "@/lib/odontogram/svg-assets"
import { Button } from "@/components/ui/button"
import { ToothDetailDrawer } from "./ToothDetailDrawer"

interface OdontogramWorkspaceProps {
  findings: ToothFinding[]
  onSaveFinding: (finding: Partial<ToothFinding>) => void
  readOnly?: boolean
  initialSelectedTooth?: number | null
  onSelectedToothChange?: (tooth: number | null) => void
  chartExportRef?: React.RefObject<HTMLDivElement | null>
}

export function OdontogramWorkspace({
  findings,
  onSaveFinding,
  readOnly = false,
  initialSelectedTooth = null,
  onSelectedToothChange,
  chartExportRef,
}: OdontogramWorkspaceProps) {
  const [showPrimary, setShowPrimary] = React.useState(false)
  const [showAnatomy, setShowAnatomy] = React.useState(false)
  const [selectedTooth, setSelectedTooth] = React.useState<number | null>(initialSelectedTooth)

  React.useEffect(() => {
    if (initialSelectedTooth == null) return
    setSelectedTooth(initialSelectedTooth)
    setShowPrimary(isPrimaryToothNumber(initialSelectedTooth))
  }, [initialSelectedTooth])

  React.useEffect(() => {
    onSelectedToothChange?.(selectedTooth)
  }, [selectedTooth, onSelectedToothChange])

  const handleToothClick = (number: number) => {
    if (readOnly) return
    setSelectedTooth(number)
  }

  const selectedFinding = React.useMemo(() => {
    if (!selectedTooth) return undefined
    return findings.find(
      (f) =>
        f.tooth_number === selectedTooth.toString() &&
        f.status === "active" &&
        (showPrimary ? isPrimaryToothNumber(selectedTooth) : !isPrimaryToothNumber(selectedTooth))
    )
  }, [selectedTooth, findings, showPrimary])

  const scopedFindings = React.useMemo(
    () =>
      findings.filter((f) => {
        const num = parseInt(f.tooth_number, 10)
        if (Number.isNaN(num)) return false
        return showPrimary ? isPrimaryToothNumber(num) : !isPrimaryToothNumber(num)
      }),
    [findings, showPrimary]
  )

  return (
    <div className="space-y-4" data-testid="odontogram-workspace">
      <OdontogramQuickBar
        findings={scopedFindings}
        selectedTooth={selectedTooth}
        onSelectTooth={handleToothClick}
        readOnly={readOnly}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div
          ref={chartExportRef}
          id="odontogram-export-root"
          data-testid="odontogram-chart"
          className="relative min-w-0 flex-1 space-y-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div className="relative z-10 mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-neutral-800">
                {showPrimary ? "Primary dentition (FDI)" : "Permanent dentition (FDI)"}
              </h3>
              <p className="text-xs text-neutral-500">
                Click a tooth to edit · unsaved changes commit from the header
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              {!showPrimary ? (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAnatomy(!showAnatomy)}>
                  {showAnatomy ? "Clinical view" : "Anatomy reference"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setShowPrimary(!showPrimary)
                  if (!showPrimary) setShowAnatomy(false)
                }}
              >
                {showPrimary ? "Permanent teeth" : "Primary teeth"}
              </Button>
            </div>
          </div>

          <div className="relative z-10 flex w-full flex-col items-center justify-center pb-4 pt-2">
            <AnatomicOdontogramChart
              findings={scopedFindings}
              selectedTooth={selectedTooth}
              onToothClick={handleToothClick}
              showAnatomy={showAnatomy}
              variant={showPrimary ? "primary" : "permanent"}
            />
          </div>
        </div>

        <div className="w-full shrink-0 xl:w-[380px] print:hidden">
          {selectedTooth && !readOnly ? (
            <ToothDetailDrawer
              selectedTooth={selectedTooth}
              currentFinding={selectedFinding}
              onClose={() => setSelectedTooth(null)}
              onSaveFinding={(f) => {
                onSaveFinding(f)
              }}
              data-testid="tooth-drawer"
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500 xl:min-h-[520px]">
              {readOnly
                ? "Read-only chart view."
                : "Select a tooth on the chart to record condition, surfaces, restoration, or notes."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
