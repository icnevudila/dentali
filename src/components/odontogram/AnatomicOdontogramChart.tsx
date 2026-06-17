"use client"

import * as React from "react"
import type { ToothFinding } from "@/lib/types/dental"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import {
  filterFindingsForVariant,
  ODONTOGRAM_SVG_PATHS,
  odontogramSvgId,
  type OdontogramSvgVariant,
} from "@/lib/odontogram/svg-assets"
import { useOdontogramSvg } from "@/hooks/use-odontogram-svg"

interface AnatomicOdontogramChartProps {
  findings: ToothFinding[]
  selectedTooth: number | null
  onToothClick: (toothNumber: number) => void
  showAnatomy?: boolean
  variant?: Exclude<OdontogramSvgVariant, "compact">
  interactive?: boolean
}

export function AnatomicOdontogramChart({
  findings,
  selectedTooth,
  onToothClick,
  showAnatomy = false,
  variant = "permanent",
  interactive = true,
}: AnatomicOdontogramChartProps) {
  const scopedFindings = React.useMemo(
    () => filterFindingsForVariant(findings, variant),
    [findings, variant]
  )
  const svgId = odontogramSvgId(variant)
  const svgPath = ODONTOGRAM_SVG_PATHS[variant]

  const { containerRef, loadState } = useOdontogramSvg({
    svgPath,
    svgId,
    findings: scopedFindings,
    selectedTooth,
    onToothClick,
    showAnatomy: variant === "permanent" ? showAnatomy : false,
    interactive,
  })

  const ariaLabel =
    variant === "primary" ? "FDI primary teeth odontogram" : "FDI permanent teeth odontogram"

  return (
    <div className="anatomic-odontogram-chart w-full overflow-x-auto">
      {loadState === "loading" && (
        <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-neutral-200">
          <PageLoadingSkeleton variant="block" className="absolute inset-0 h-full rounded-xl" />
          <div className="relative flex min-h-[420px] items-center justify-center">
            <p className="text-sm text-neutral-500">Loading dental chart…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          Dental chart SVG could not be loaded. Please refresh the page.
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full min-w-0 [&_svg]:h-auto [&_svg]:max-h-[720px] [&_svg]:w-full [&_svg]:rounded-xl ${loadState !== "ready" ? "hidden" : ""}`}
        role="application"
        aria-label={ariaLabel}
      />
      <style jsx global>{`
        .anatomic-odontogram-chart svg {
          font-family: var(--font-sans, Inter, "Segoe UI", Arial, sans-serif);
          background: #f8fafc;
        }

        .anatomic-odontogram-chart .jaw-bg {
          fill: #ecfdf5;
          stroke: #99f6e4;
          stroke-width: 2;
        }

        .anatomic-odontogram-chart .palate {
          fill: #5eead4;
          opacity: 0.28;
        }

        .anatomic-odontogram-chart .midline {
          stroke: #0d9488;
          stroke-width: 1.6;
          opacity: 0.4;
          stroke-dasharray: 5 7;
        }

        .anatomic-odontogram-chart .panel-bg {
          fill: #ffffff;
          stroke: #cbd5e1;
          stroke-width: 1;
        }

        .anatomic-odontogram-chart .panel-title {
          font-size: 14px;
          font-weight: 700;
          text-anchor: middle;
          fill: #1e293b;
          letter-spacing: 0.08em;
        }

        .anatomic-odontogram-chart .tooth {
          cursor: pointer;
          outline: none;
        }

        .anatomic-odontogram-chart .tooth .crown {
          fill: #fffbeb;
          stroke: #a8a29e;
          stroke-width: 2.2;
          transition: fill 0.16s ease, stroke 0.16s ease;
        }

        .anatomic-odontogram-chart .tooth .detail {
          fill: none;
          stroke: #92400e;
          stroke-width: 1.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0.7;
        }

        .anatomic-odontogram-chart .tooth .num circle {
          fill: #e2e8f0;
          stroke: #fff;
          stroke-width: 2;
          transition: transform 0.15s ease, fill 0.15s ease;
        }

        .anatomic-odontogram-chart .tooth .num text {
          font-size: 10px;
          font-weight: 800;
          fill: #0f172a;
          text-anchor: middle;
          pointer-events: none;
        }

        .anatomic-odontogram-chart .tooth.incisor .num circle { fill: #0d9488; }
        .anatomic-odontogram-chart .tooth.canine .num circle { fill: #0891b2; }
        .anatomic-odontogram-chart .tooth.premolar .num circle { fill: #0284c7; }
        .anatomic-odontogram-chart .tooth.molar .num circle { fill: #0369a1; }
        .anatomic-odontogram-chart .tooth.incisor .num text,
        .anatomic-odontogram-chart .tooth.canine .num text,
        .anatomic-odontogram-chart .tooth.premolar .num text,
        .anatomic-odontogram-chart .tooth.molar .num text {
          fill: #fff;
        }

        .anatomic-odontogram-chart .tooth:hover .crown,
        .anatomic-odontogram-chart .tooth:focus .crown {
          fill: #ccfbf1;
          stroke: #0d9488;
        }

        .anatomic-odontogram-chart .tooth:hover .num circle,
        .anatomic-odontogram-chart .tooth:focus .num circle {
          transform: scale(1.1);
        }

        .anatomic-odontogram-chart .tooth.selected .crown {
          fill: #99f6e4;
          stroke: #0f766e;
          stroke-width: 3;
        }

        .anatomic-odontogram-chart .tooth.selected .num circle {
          fill: #0f766e;
        }

        .anatomic-odontogram-chart .tooth.state-decayed .crown {
          fill: #fecaca;
          stroke: #dc2626;
          stroke-width: 2.5;
        }

        .anatomic-odontogram-chart .tooth.state-restored .crown {
          fill: #bfdbfe;
          stroke: #2563eb;
          stroke-width: 2.5;
        }

        .anatomic-odontogram-chart .tooth.state-missing .crown {
          fill: #fef3c7;
          stroke: #d97706;
          stroke-width: 2;
          opacity: 0.45;
        }

        .anatomic-odontogram-chart .tooth.state-missing .detail {
          opacity: 0.25;
        }

        .anatomic-odontogram-chart .tooth.state-impacted .crown {
          fill: #e9d5ff;
          stroke: #7c3aed;
          stroke-width: 2.5;
        }

        .anatomic-odontogram-chart .tooth.state-other .crown {
          fill: #f1f5f9;
          stroke: #64748b;
          stroke-width: 2.5;
        }

        .anatomic-odontogram-chart .missing-mark {
          stroke: #b45309;
          stroke-width: 3.5;
          stroke-linecap: round;
          pointer-events: none;
        }

        .anatomic-odontogram-chart .label,
        .anatomic-odontogram-chart .arch-label {
          fill: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .anatomic-odontogram-chart .arch-label {
          font-size: 13px;
          text-anchor: middle;
          fill: #0f766e;
        }
      `}</style>
    </div>
  )
}
