import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import { formatBulletLines } from "@/lib/text/bullet-text"
import type { ToothFinding } from "@/lib/types/dental"
import {
  CONDITION_OPTIONS,
  RESTORATION_OPTIONS,
  SURGERY_OPTIONS,
  SURFACE_LABELS,
} from "@/lib/odontogram/chart-catalog"

function catalogLabel<T extends string>(
  options: { value: T; label: string }[],
  value: string | null | undefined
): string | null {
  if (!value) return null
  return options.find((o) => o.value === value)?.label ?? humanizeClinicalSlug(value)
}

function humanizeClinicalSlug(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** Human-readable label for a single tooth finding (condition, restoration, surgery, surfaces). */
export function formatToothFindingLabel(finding: ToothFinding): string {
  const parts: string[] = []

  if (finding.condition && finding.condition !== "present") {
    const label = catalogLabel(CONDITION_OPTIONS, finding.condition)
    if (label) parts.push(label)
  }
  if (finding.restoration_type) {
    const label = catalogLabel(RESTORATION_OPTIONS, finding.restoration_type)
    if (label) parts.push(label)
  }
  if (finding.surgery_type) {
    const label = catalogLabel(SURGERY_OPTIONS, finding.surgery_type)
    if (label) parts.push(label)
  }
  if (finding.surfaces.length > 0) {
    parts.push(finding.surfaces.map((s) => SURFACE_LABELS[s] ?? s).join(", "))
  }
  if (finding.notes?.trim()) {
    parts.push(finding.notes.trim())
  }

  return parts.join(" · ") || "Recorded finding"
}

export function formatToothFindingLine(finding: ToothFinding): string {
  return `Tooth ${finding.tooth_number}: ${formatToothFindingLabel(finding)}`
}

function splitClinicalDescription(text: string): string[] {
  return formatBulletLines(text.replace(/\s*•\s*/g, "\n"))
}

function isPlaceholderLine(line: string): boolean {
  const normalized = line.trim().toLowerCase()
  return /^bullet\s*\d+$/.test(normalized) || normalized === "test"
}

/** Strip redundant tooth suffixes and placeholder bullets from treatment plan text. */
export function formatTreatmentDescriptionPlain(
  description: string,
  toothNumber?: string | null
): string {
  const lines = splitClinicalDescription(description)
    .map((line) => {
      let text = line.trim()
      if (toothNumber) {
        text = text.replace(new RegExp(`\\s*[—\\-]\\s*Tooth\\s*#?${toothNumber}\\s*$`, "i"), "")
        text = text.replace(new RegExp(`^Tooth\\s*#?${toothNumber}\\s*[—\\-]\\s*`, "i"), "")
      }
      return text.trim()
    })
    .filter((line) => line.length > 0 && !isPlaceholderLine(line))

  if (lines.length === 0) return ""
  if (lines.length === 1) return lines[0]
  return lines.join("; ")
}

export function formatTreatmentTimelineLine(row: TreatmentTimelineEntry): string {
  const description = formatTreatmentDescriptionPlain(row.description, row.tooth_number)
  if (!description) return ""
  if (row.tooth_number) return `Tooth ${row.tooth_number}: ${description}`
  return description
}

export function printableTreatmentRows(rows: TreatmentTimelineEntry[]): TreatmentTimelineEntry[] {
  return rows.filter((row) => formatTreatmentDescriptionPlain(row.description, row.tooth_number).length > 0)
}
