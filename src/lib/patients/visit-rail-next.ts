import type {
  ClinicalVisitJourney,
  ClinicalVisitStep,
} from "@/lib/clinical/clinical-visit-journey"

export type VisitRailAction =
  | { kind: "checkout" }
  | { kind: "next"; step: ClinicalVisitStep }
  | { kind: "none" }

function stripQuery(href: string) {
  const q = href.indexOf("?")
  return q >= 0 ? href.slice(0, q) : href
}

function pathMatchesStep(pathname: string, step: ClinicalVisitStep): boolean {
  if (!step.href) return false
  const target = stripQuery(step.href)
  if (pathname === target || pathname.startsWith(`${target}/`)) return true

  // Profile tabs live on /patients/:id — match by tab / intent
  if (step.href.includes("tab=medical-history") && pathname.includes("/medical-history")) {
    return true
  }
  if (step.href.includes("tab=consents") && pathname.includes("/consent")) return true
  if (step.href.includes("tab=clinical-notes") && pathname.includes("/clinical-notes")) {
    return true
  }
  if (step.href.includes("tab=dental-chart") && pathname.includes("/chart")) return true
  if (step.id === "treatment-plan" && pathname.includes("/treatment-plan")) return true
  if ((step.id === "invoice" || step.id === "payment") && pathname.startsWith("/billing")) {
    return true
  }
  if (step.id === "discharge" && pathname.includes("/patients/") && !pathname.includes("/")) {
    return true
  }
  return false
}

/**
 * Pick what the sticky rail “Next” button should do.
 * If the clinician is already on the current journey step, advance to the following incomplete step.
 */
export function resolveVisitRailAction(
  journey: Pick<ClinicalVisitJourney, "steps" | "nextStep" | "readyToClose">,
  pathname: string
): VisitRailAction {
  if (journey.readyToClose) return { kind: "checkout" }

  const ordered = journey.steps.filter((s) => s.status !== "done")
  if (ordered.length === 0) return { kind: "none" }

  let candidate = journey.nextStep ?? ordered[0] ?? null
  if (!candidate) return { kind: "none" }

  if (pathMatchesStep(pathname, candidate)) {
    const idx = journey.steps.findIndex((s) => s.id === candidate!.id)
    const after = journey.steps
      .slice(idx + 1)
      .find((s) => s.status === "current" || s.status === "pending")
    candidate = after ?? null
  }

  if (!candidate) {
    return journey.readyToClose || journey.steps.some((s) => s.id === "discharge" && s.status !== "done")
      ? { kind: "checkout" }
      : { kind: "none" }
  }

  if (candidate.id === "discharge") return { kind: "checkout" }
  return { kind: "next", step: candidate }
}
