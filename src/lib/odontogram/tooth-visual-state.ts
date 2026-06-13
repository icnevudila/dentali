import type { ToothFinding } from "@/lib/types/dental"

export type ToothVisualState =
  | "healthy"
  | "decayed"
  | "missing"
  | "restored"
  | "impacted"
  | "other"

const VISUAL_STATE_CLASSES = [
  "state-healthy",
  "state-decayed",
  "state-missing",
  "state-restored",
  "state-impacted",
  "state-other",
] as const

export function getToothVisualState(finding?: ToothFinding): ToothVisualState {
  if (!finding || finding.status === "voided") return "healthy"

  if (
    finding.condition === "missing_other" ||
    finding.condition === "missing_caries" ||
    finding.condition === "indicated_extraction"
  ) {
    return "missing"
  }

  if (finding.condition === "decayed") return "decayed"
  if (finding.condition === "impacted") return "impacted"
  if (finding.restoration_type) return "restored"
  if (finding.condition) return "other"

  return "healthy"
}

export function getToothVisualClass(finding?: ToothFinding): string {
  return `state-${getToothVisualState(finding)}`
}

export function applyVisualStateClasses(element: Element, finding?: ToothFinding) {
  VISUAL_STATE_CLASSES.forEach((cls) => element.classList.remove(cls))
  element.classList.add(getToothVisualClass(finding))
}

export function buildFindingsByTooth(findings: ToothFinding[]): Map<string, ToothFinding> {
  const map = new Map<string, ToothFinding>()
  for (const finding of findings) {
    if (finding.status !== "active") continue
    map.set(finding.tooth_number, finding)
  }
  return map
}
