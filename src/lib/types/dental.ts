export type DentitionType = "permanent" | "primary"

// FDI Tooth Numbering Constants
export const PERMANENT_TEETH = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41]
}

export const PRIMARY_TEETH = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerLeft: [71, 72, 73, 74, 75],
  lowerRight: [85, 84, 83, 82, 81]
}

export type ToothNumber = number

export type ToothCondition = 
  | "present" 
  | "decayed" 
  | "missing_caries" 
  | "missing_other" 
  | "indicated_extraction" 
  | "root_fragment" 
  | "impacted" 
  | "supernumerary" 
  | "unerupted"

export type RestorationType = 
  | "amalgam" 
  | "composite" 
  | "jacket_crown" 
  | "abutment" 
  | "pontic" 
  | "inlay" 
  | "implant" 
  | "sealant" 
  | "removable_denture"

export type SurgeryType = 
  | "extraction_caries" 
  | "extraction_other"

export type ToothSurface = "top" | "bottom" | "left" | "right" | "center"

export interface ToothFinding {
  id?: string
  tooth_number: string
  dentition_type: DentitionType
  condition?: ToothCondition | null
  surfaces: ToothSurface[]
  restoration_type?: RestorationType | null
  surgery_type?: SurgeryType | null
  notes?: string
  status: "active" | "voided"
  created_at?: string
  updated_at?: string
}

export interface DentalChart {
  id: string
  organization_id: string
  branch_id: string
  patient_id: string
  status: "active" | "locked"
  created_at: string
  updated_at: string
  findings: ToothFinding[]
}

export interface DentalChartChange {
  tooth_number: string
  before: Partial<ToothFinding>
  after: Partial<ToothFinding>
}

export interface OdontogramPermission {
  canRead: boolean
  canWrite: boolean
}
