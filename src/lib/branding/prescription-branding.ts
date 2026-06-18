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

export const PRESCRIPTION_BRANDING_ASSET_PATHS = {
  header: "/branding/prescription/header.jpg",
  footer: "/branding/prescription/footer.jpg",
  watermark: "/branding/prescription/watermark.jpg",
} as const

export const DEFAULT_PRESCRIPTION_BRANDING: PrescriptionBrandingSettings = {
  headerImageDataUrl: PRESCRIPTION_BRANDING_ASSET_PATHS.header,
  watermarkImageDataUrl: PRESCRIPTION_BRANDING_ASSET_PATHS.watermark,
  footerImageDataUrl: PRESCRIPTION_BRANDING_ASSET_PATHS.footer,
  signatureImageDataUrl: null,
  doctorTitle: "General Dentistry and Orthodontics",
  licenseLabel: "License No.",
  ptrLabel: "PTR No.",
  ptrNumber: null,
  footerNote: "This prescription is valid for dispensing at a licensed pharmacy. Keep out of reach of children.",
  showWatermark: true,
}

export function resolvePrescriptionBranding(
  branding: PrescriptionBrandingSettings | null | undefined
): PrescriptionBrandingSettings {
  const base = branding ?? DEFAULT_PRESCRIPTION_BRANDING
  return {
    ...DEFAULT_PRESCRIPTION_BRANDING,
    ...base,
    headerImageDataUrl:
      base.headerImageDataUrl ?? DEFAULT_PRESCRIPTION_BRANDING.headerImageDataUrl,
    watermarkImageDataUrl:
      base.watermarkImageDataUrl ?? DEFAULT_PRESCRIPTION_BRANDING.watermarkImageDataUrl,
    footerImageDataUrl:
      base.footerImageDataUrl ?? DEFAULT_PRESCRIPTION_BRANDING.footerImageDataUrl,
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function normalizePrescriptionBranding(raw: unknown): PrescriptionBrandingSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PRESCRIPTION_BRANDING }
  }

  const data = raw as Record<string, unknown>

  return resolvePrescriptionBranding({
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
  })
}
