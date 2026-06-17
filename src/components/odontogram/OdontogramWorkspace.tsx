"use client"

import * as React from "react"
import { AnatomicOdontogramChart } from "./AnatomicOdontogramChart"
import { OdontogramQuickBar } from "./OdontogramQuickBar"
import { ToothFinding } from "@/lib/types/dental"
import { isPrimaryToothNumber } from "@/lib/odontogram/svg-assets"
import { Button } from "@/components/ui/button"
import { ToothDetailDrawer } from "./ToothDetailDrawer"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { MousePointerClick, ShieldAlert } from "lucide-react"

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
    const id = window.setTimeout(() => {
      setSelectedTooth(initialSelectedTooth)
      setShowPrimary(isPrimaryToothNumber(initialSelectedTooth))
    }, 0)
    return () => window.clearTimeout(id)
  }, [initialSelectedTooth])

  React.useEffect(() => {
    onSelectedToothChange?.(selectedTooth)
  }, [selectedTooth, onSelectedToothChange])

  React.useEffect(() => {
    if (!selectedTooth || readOnly || typeof window === "undefined") return
    if (window.innerWidth >= 1280) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedTooth, readOnly])

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

        <div className={cn(
          "w-full shrink-0 xl:w-[380px] print:hidden",
          selectedTooth && !readOnly
            ? "fixed inset-0 z-50 flex items-end justify-center xl:relative xl:inset-auto xl:z-0 xl:flex xl:items-start xl:justify-start"
            : "hidden xl:block"
        )}>
          {selectedTooth && !readOnly ? (
            <>
              <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-sm xl:hidden"
                aria-label="Close tooth detail"
                onClick={() => setSelectedTooth(null)}
              />
              <div className="relative z-[1] w-full xl:max-w-none">
                <div className="max-h-[88dvh] overflow-hidden rounded-t-[1.75rem] xl:max-h-none xl:rounded-none">
                  <ToothDetailDrawer
                    selectedTooth={selectedTooth}
                    currentFinding={selectedFinding}
                    onClose={() => setSelectedTooth(null)}
                    onSaveFinding={(f) => {
                      onSaveFinding(f)
                    }}
                    data-testid="tooth-drawer"
                  />
                </div>
              </div>
            </>
          ) : (
            <Card className="flex min-h-[420px] xl:min-h-[560px] flex-col border-neutral-200 shadow-sm bg-neutral-50/50 justify-center items-center text-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 mb-4 ring-8 ring-primary-50/50 animate-pulse">
                {readOnly ? (
                  <ShieldAlert className="h-6 w-6" />
                ) : (
                  <MousePointerClick className="h-6 w-6" />
                )}
              </div>
              <h4 className="font-semibold text-neutral-800 text-base mb-1">
                {readOnly ? "Read-Only Mode" : "Select a Tooth"}
              </h4>
              <p className="text-xs text-neutral-500 max-w-[240px] leading-relaxed">
                {readOnly
                  ? "This chart is in read-only mode. Changes cannot be applied."
                  : "Click any tooth on the odontogram chart to record diagnoses, surfaces, restorations, or custom clinical notes."}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
