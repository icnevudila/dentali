"use client"

import * as React from "react"
import type { ToothFinding, ToothSurface } from "@/lib/types/dental"
import {
  CONDITION_OPTIONS,
  RESTORATION_OPTIONS,
  SURGERY_OPTIONS,
  SURFACE_LABELS,
} from "@/lib/odontogram/chart-catalog"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Check, MousePointerClick } from "lucide-react"
import { ToothSurfaceMap } from "./ToothSurfaceMap"
import { ToothSurfaceAtlas } from "./ToothSurfaceAtlas"
import { isPrimaryToothNumber } from "@/lib/odontogram/svg-assets"
import { cn } from "@/lib/utils"

interface ToothDetailDrawerProps {
  selectedTooth: number | null
  currentFinding?: ToothFinding
  onClose: () => void
  onSaveFinding: (finding: Partial<ToothFinding>) => void
  "data-testid"?: string
}

const MISSING_CONDITIONS = new Set(["missing_other", "missing_caries", "indicated_extraction"])

export function ToothDetailDrawer({
  selectedTooth,
  currentFinding,
  onClose,
  onSaveFinding,
  "data-testid": testId = "tooth-drawer",
}: ToothDetailDrawerProps) {
  const [draft, setDraft] = React.useState<Partial<ToothFinding>>({})

  React.useEffect(() => {
    if (currentFinding) {
      setDraft(currentFinding)
    } else {
      setDraft({
        condition: null,
        surfaces: [],
        restoration_type: null,
        surgery_type: null,
        notes: "",
        dentition_type: selectedTooth && isPrimaryToothNumber(selectedTooth) ? "primary" : "permanent",
      })
    }
  }, [selectedTooth, currentFinding])

  if (!selectedTooth) return null

  const surfacesDisabled =
    draft.condition != null && MISSING_CONDITIONS.has(draft.condition)

  const saveDraft = React.useCallback((updatedDraft: Partial<ToothFinding>) => {
    onSaveFinding({
      ...updatedDraft,
      tooth_number: selectedTooth.toString(),
      dentition_type:
        updatedDraft.dentition_type ??
        (isPrimaryToothNumber(selectedTooth) ? "primary" : "permanent"),
      status: "active",
    })
  }, [selectedTooth, onSaveFinding])

  const handleSurfaceClick = (surface: ToothSurface) => {
    if (surfacesDisabled) return
    const prevSurfaces = draft.surfaces || []
    const nextSurfaces = prevSurfaces.includes(surface)
      ? prevSurfaces.filter((s) => s !== surface)
      : [...prevSurfaces, surface]

    const updated = { ...draft, surfaces: nextSurfaces }
    setDraft(updated)
    saveDraft(updated)
  }

  const setCondition = (condition: ToothFinding["condition"]) => {
    let updated: Partial<ToothFinding> = {}
    if (condition && MISSING_CONDITIONS.has(condition)) {
      updated = {
        ...draft,
        condition,
        surfaces: [],
        restoration_type: null,
      }
    } else {
      updated = { ...draft, condition }
    }
    setDraft(updated)
    saveDraft(updated)
  }

  const toggleRestoration = (value: ToothFinding["restoration_type"]) => {
    const updated = {
      ...draft,
      restoration_type: draft.restoration_type === value ? null : value,
    }
    setDraft(updated)
    saveDraft(updated)
  }

  const toggleSurgery = (value: ToothFinding["surgery_type"]) => {
    const updated = {
      ...draft,
      surgery_type: draft.surgery_type === value ? null : value,
    }
    setDraft(updated)
    saveDraft(updated)
  }

  const clearFinding = () => {
    const updated = {
      condition: null,
      surfaces: [],
      restoration_type: null,
      surgery_type: null,
      notes: "",
      dentition_type: (isPrimaryToothNumber(selectedTooth) ? "primary" : "permanent") as any,
    }
    setDraft(updated)
    saveDraft(updated)
  }

  return (
    <Card
      data-testid={testId}
      className="flex h-full flex-col border-neutral-200 shadow-lg sticky top-4"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-neutral-200 bg-neutral-50 pb-4">
        <div>
          <CardTitle className="text-xl">Tooth {selectedTooth}</CardTitle>
          <CardDescription>FDI · condition, surfaces, restoration, notes</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close tooth panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="relative flex flex-col items-center rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
          <div className="absolute left-3 top-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            <MousePointerClick className="h-3 w-3" /> Surfaces
          </div>
          <ToothSurfaceMap
            toothNumber={selectedTooth}
            finding={draft}
            size={132}
            isInteractive={!surfacesDisabled}
            onSurfaceClick={handleSurfaceClick}
          />
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {(Object.keys(SURFACE_LABELS) as ToothSurface[]).map((key) => {
              const active = draft.surfaces?.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={surfacesDisabled}
                  onClick={() => handleSurfaceClick(key)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    active
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-primary-300",
                    surfacesDisabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {SURFACE_LABELS[key].split(" / ")[0]}
                </button>
              )
            })}
          </div>
        </div>

        <section className="space-y-2">
          <SectionLabel>Condition</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {CONDITION_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                active={draft.condition === opt.value}
                label={opt.label}
                tone={opt.color === "red" ? "red" : opt.color === "amber" ? "amber" : "default"}
                onClick={() => setCondition(opt.value)}
                testId={`condition-${opt.value}`}
              />
            ))}
            <OptionButton
              active={draft.condition === null && !draft.restoration_type && !draft.surgery_type}
              label="Healthy / clear"
              tone="neutral"
              onClick={clearFinding}
            />
          </div>
        </section>

        <section className="space-y-2">
          <SectionLabel>Restoration</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {RESTORATION_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                active={draft.restoration_type === opt.value}
                label={opt.label}
                tone="blue"
                onClick={() => toggleRestoration(opt.value)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionLabel>Surgery / extraction</SectionLabel>
          <div className="grid grid-cols-1 gap-1.5">
            {SURGERY_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                active={draft.surgery_type === opt.value}
                label={opt.label}
                tone="amber"
                onClick={() => toggleSurgery(opt.value)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionLabel>Clinical notes</SectionLabel>
          <textarea
            value={draft.notes ?? ""}
            onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            onBlur={() => saveDraft(draft)}
            placeholder="Optional notes for this tooth…"
            rows={3}
            className="flex w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </section>
      </CardContent>

      <CardFooter className="border-t border-neutral-200 bg-neutral-50 p-4">
        <Button variant="outline" className="w-full gap-2" onClick={onClose}>
          <Check className="h-4 w-4" />
          Done / Close Panel
        </Button>
      </CardFooter>
    </Card>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{children}</p>
  )
}

function OptionButton({
  active,
  label,
  tone,
  onClick,
  testId,
}: {
  active: boolean
  label: string
  tone: "default" | "red" | "amber" | "blue" | "neutral"
  onClick: () => void
  testId?: string
}) {
  const activeStyles = {
    default: "border-primary-200 bg-primary-50 text-primary-700 ring-1 ring-primary-500/20 font-semibold shadow-sm",
    red: "border-red-200 bg-red-50 text-red-700 ring-1 ring-red-500/20 font-semibold shadow-sm",
    amber: "border-amber-200 bg-amber-50 text-amber-700 ring-1 ring-amber-500/20 font-semibold shadow-sm",
    blue: "border-blue-200 bg-blue-50 text-blue-700 ring-1 ring-blue-500/20 font-semibold shadow-sm",
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-800 ring-1 ring-neutral-500/10 font-semibold shadow-sm",
  }
  const idle = "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-all shadow-sm"

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-lg border px-2.5 py-2.5 text-left text-[11px] font-medium leading-tight transition-all active:scale-[0.98]",
        active ? activeStyles[tone] : idle
      )}
    >
      {label}
    </button>
  )
}
