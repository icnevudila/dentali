import type { RestorationType, SurgeryType, ToothCondition } from "@/lib/types/dental"

export type CatalogOption<T extends string> = {
  value: T
  label: string
  shortLabel?: string
  color?: string
}

export const CONDITION_OPTIONS: CatalogOption<ToothCondition>[] = [
  { value: "decayed", label: "Caries / Decayed", color: "red" },
  { value: "missing_other", label: "Missing (other)", color: "amber" },
  { value: "missing_caries", label: "Missing (caries)", color: "amber" },
  { value: "indicated_extraction", label: "Indicated for extraction", color: "orange" },
  { value: "impacted", label: "Impacted", color: "violet" },
  { value: "root_fragment", label: "Root fragment", color: "slate" },
  { value: "unerupted", label: "Unerupted", color: "slate" },
  { value: "supernumerary", label: "Supernumerary", color: "slate" },
  { value: "present", label: "Present (no pathology)", color: "neutral" },
]

export const RESTORATION_OPTIONS: CatalogOption<RestorationType>[] = [
  { value: "composite", label: "Composite filling" },
  { value: "amalgam", label: "Amalgam filling" },
  { value: "jacket_crown", label: "Jacket crown" },
  { value: "inlay", label: "Inlay / onlay" },
  { value: "implant", label: "Implant" },
  { value: "pontic", label: "Pontic (bridge)" },
  { value: "abutment", label: "Abutment" },
  { value: "sealant", label: "Sealant" },
  { value: "removable_denture", label: "Removable denture" },
]

export const SURGERY_OPTIONS: CatalogOption<SurgeryType>[] = [
  { value: "extraction_caries", label: "Extraction (caries)" },
  { value: "extraction_other", label: "Extraction (other)" },
]

export const SURFACE_LABELS: Record<string, string> = {
  top: "Facial / Buccal",
  bottom: "Lingual / Palatal",
  left: "Mesial",
  right: "Distal",
  center: "Occlusal / Incisal",
}
