export type PortalVisitReasonId =
  | "general_checkup"
  | "toothache"
  | "cleaning"
  | "filling"
  | "root_canal"
  | "extraction"
  | "ortho"
  | "other"

export const PORTAL_VISIT_REASONS: {
  id: PortalVisitReasonId
  labelKey: string
  labelFallback: string
}[] = [
  { id: "general_checkup", labelKey: "portal.reasonGeneral", labelFallback: "General checkup" },
  { id: "toothache", labelKey: "portal.reasonToothache", labelFallback: "Toothache" },
  { id: "cleaning", labelKey: "portal.reasonCleaning", labelFallback: "Dental cleaning" },
  { id: "filling", labelKey: "portal.reasonFilling", labelFallback: "Tooth filling" },
  { id: "root_canal", labelKey: "portal.reasonRootCanal", labelFallback: "Root canal" },
  { id: "extraction", labelKey: "portal.reasonExtraction", labelFallback: "Tooth extraction" },
  { id: "ortho", labelKey: "portal.reasonOrtho", labelFallback: "Orthodontic consultation" },
  { id: "other", labelKey: "portal.reasonOther", labelFallback: "Other" },
]
