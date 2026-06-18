export interface PrescriptionBrandingSettings {
  headerImageDataUrl: string | null
  watermarkImageDataUrl: string | null
  footerImageDataUrl: string | null
  signatureImageDataUrl: string | null
  doctorTitle: string | null
  licenseLabel: string | null
  ptrLabel: string | null
  ptrNumber: string | null
  footerNote: string | null
  showWatermark: boolean
}

export const DEFAULT_PRESCRIPTION_BRANDING: PrescriptionBrandingSettings = {
  headerImageDataUrl: null,
  watermarkImageDataUrl: null,
  footerImageDataUrl: null,
  signatureImageDataUrl: null,
  doctorTitle: "General Dentistry",
  licenseLabel: "PRC Lic. No.",
  ptrLabel: "PTR No.",
  ptrNumber: null,
  footerNote: "This prescription is valid for dispensing at a licensed pharmacy. Keep out of reach of children.",
  showWatermark: true,
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function normalizePrescriptionBranding(raw: unknown): PrescriptionBrandingSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PRESCRIPTION_BRANDING }
  }

  const data = raw as Record<string, unknown>

  return {
    headerImageDataUrl: stringOrNull(data.headerImageDataUrl),
    watermarkImageDataUrl: stringOrNull(data.watermarkImageDataUrl),
    footerImageDataUrl: stringOrNull(data.footerImageDataUrl),
    signatureImageDataUrl: stringOrNull(data.signatureImageDataUrl),
    doctorTitle: stringOrNull(data.doctorTitle) ?? DEFAULT_PRESCRIPTION_BRANDING.doctorTitle,
    licenseLabel: stringOrNull(data.licenseLabel) ?? DEFAULT_PRESCRIPTION_BRANDING.licenseLabel,
    ptrLabel: stringOrNull(data.ptrLabel) ?? DEFAULT_PRESCRIPTION_BRANDING.ptrLabel,
    ptrNumber: stringOrNull(data.ptrNumber),
    footerNote: stringOrNull(data.footerNote) ?? DEFAULT_PRESCRIPTION_BRANDING.footerNote,
    showWatermark:
      typeof data.showWatermark === "boolean" ? data.showWatermark : DEFAULT_PRESCRIPTION_BRANDING.showWatermark,
  }
}
