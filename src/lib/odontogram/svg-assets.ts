export type OdontogramSvgVariant = "permanent" | "primary" | "compact"

export const ODONTOGRAM_SVG_PATHS: Record<Exclude<OdontogramSvgVariant, "compact">, string> = {
  permanent: "/odontogram/interactive-odontogram.svg",
  primary: "/odontogram/interactive-primary-odontogram.svg",
}

export const COMPACT_ODONTOGRAM_SVG = "/odontogram/compact-odontogram.svg"
export const TOOTH_SURFACE_ATLAS_SVG = "/odontogram/tooth-surface-atlas.svg"
export const PERIODONTAL_SCREENING_SVG = "/odontogram/periodontal-screening.svg"

export function odontogramSvgId(variant: Exclude<OdontogramSvgVariant, "compact">): string {
  return variant === "primary" ? "interactive-primary-odontogram" : "interactive-odontogram"
}

export function isPrimaryToothNumber(toothNumber: number): boolean {
  const quadrant = Math.floor(toothNumber / 10)
  return quadrant >= 5 && quadrant <= 8
}

export function filterFindingsForVariant<T extends { tooth_number: string; dentition_type?: string }>(
  findings: T[],
  variant: Exclude<OdontogramSvgVariant, "compact">
): T[] {
  return findings.filter((f) => {
    const num = parseInt(f.tooth_number, 10)
    if (Number.isNaN(num)) return false
    const primary = isPrimaryToothNumber(num)
    return variant === "primary" ? primary : !primary
  })
}
