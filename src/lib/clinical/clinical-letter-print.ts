import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import type { PatientWithContacts } from "@/lib/patients/patient-service"
import { openPrintableHtml } from "@/lib/utils/print"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function listOrDash(items: string[] | null | undefined): string {
  if (!items?.length) return "None recorded"
  return items.map(escapeHtml).join(", ")
}

function patientAge(dob: string | null | undefined): string {
  if (!dob) return "—"
  const years = new Date().getFullYear() - new Date(dob).getFullYear()
  return String(years)
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; padding: 32px 40px; line-height: 1.6; font-size: 12px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; text-align: center; letter-spacing: 0.04em; text-transform: uppercase; }
  .clinic { text-align: center; color: #475569; font-size: 12px; margin-bottom: 20px; }
  .clinic strong { display: block; font-size: 15px; color: #0f172a; margin-bottom: 2px; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; }
  .salutation { font-weight: 700; margin: 18px 0 12px; }
  p { margin: 0 0 12px; text-align: justify; }
  .block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin: 12px 0; }
  .block strong { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px; font-family: system-ui, sans-serif; }
  ul { margin: 8px 0 12px 20px; padding: 0; }
  li { margin-bottom: 4px; }
  .sig-row { display: flex; justify-content: flex-end; margin-top: 48px; }
  .sig { width: 240px; text-align: center; }
  .sig-line { border-top: 1px solid #0f172a; padding-top: 6px; margin-top: 40px; font-size: 11px; }
  .sig-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .footer { margin-top: 28px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { .no-print { display: none !important; } body { padding: 16px 20px; } }
`

function letterShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; font-family: system-ui, sans-serif;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0d9488; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Print / Save as PDF</button>
  </div>
  ${body}
</body>
</html>`
}

export type ClinicalLetterClinicInfo = {
  clinicName: string
  clinicAddress?: string | null
  clinicPhone?: string | null
  branchName?: string | null
}

export type MedicalAbstractData = ClinicalLetterClinicInfo & {
  patient: PatientWithContacts
  medicalHistory: MedicalHistoryRecord | null
  timeline: TimelineEvent[]
  treatmentItems: TreatmentTimelineEntry[]
  purpose: string
  clinicalSummary: string
  treatmentSummary: string
  additionalNotes: string
  attendingDentist: string
  licenseNumber: string
  generatedBy?: string | null
}

export type MedicalCertificateType = "fit_to_work" | "rest" | "school" | "procedure" | "custom"

export type MedicalCertificateData = ClinicalLetterClinicInfo & {
  patient: PatientWithContacts
  certificateType: MedicalCertificateType
  purpose: string
  diagnosis: string
  recommendation: string
  restDays: number | null
  examinationDate: string
  validFrom: string
  validUntil: string
  remarks: string
  attendingDentist: string
  licenseNumber: string
  generatedBy?: string | null
}

const CERTIFICATE_TYPE_LABEL: Record<MedicalCertificateType, string> = {
  fit_to_work: "Fit to Work / Fit to Travel",
  rest: "Medical Rest / Excuse",
  school: "School / Work Excuse",
  procedure: "Post-Procedure Certificate",
  custom: "General Medical Certificate",
}

export function buildMedicalAbstractPrintHtml(data: MedicalAbstractData): string {
  const { patient, medicalHistory, timeline, treatmentItems, clinicName, clinicAddress, clinicPhone, branchName } =
    data
  const name = `${patient.first_name} ${patient.last_name}`
  const age = patientAge(patient.date_of_birth)

  const recentVisits = timeline.slice(0, 8)
  const visitList = recentVisits
    .map(
      (e) =>
        `<li>${fmtDateTime(e.occurred_at)} — ${escapeHtml(e.title)}${e.subtitle ? ` (${escapeHtml(e.subtitle)})` : ""}</li>`
    )
    .join("")

  const procedureList = treatmentItems
    .slice(0, 10)
    .map(
      (item) =>
        `<li>${fmtDate(item.item_created_at)} — ${escapeHtml(item.description)}${item.tooth_number ? ` (Tooth ${escapeHtml(item.tooth_number)})` : ""} — ${escapeHtml(item.item_status)}</li>`
    )
    .join("")

  const body = `
  <div class="clinic">
    <strong>${escapeHtml(clinicName)}</strong>
    ${branchName ? `${escapeHtml(branchName)}<br />` : ""}
    ${clinicAddress ? `${escapeHtml(clinicAddress)}<br />` : ""}
    ${clinicPhone ? `Tel: ${escapeHtml(clinicPhone)}` : ""}
  </div>
  <h1>Medical Abstract</h1>
  <div class="meta">
    <span><strong>Patient:</strong> ${escapeHtml(name)}</span>
    <span><strong>Date:</strong> ${fmtDate(new Date().toISOString())}</span>
  </div>

  <div class="block">
    <strong>Patient identification</strong>
    Name: ${escapeHtml(name)} · Age: ${age} · Sex: ${escapeHtml(patient.gender ?? "—")}<br />
    Date of birth: ${fmtDate(patient.date_of_birth)} · Phone: ${escapeHtml(patient.phone ?? "—")}<br />
    Address: ${escapeHtml(patient.address ?? "—")}
  </div>

  ${data.purpose ? `<p><strong>Purpose of abstract:</strong> ${escapeHtml(data.purpose)}</p>` : ""}

  <p class="salutation">CLINICAL SUMMARY</p>
  <p>${escapeHtml(data.clinicalSummary || "No clinical summary provided.")}</p>

  <div class="block">
    <strong>Medical history on file</strong>
    <p><strong>Allergies:</strong> ${listOrDash(medicalHistory?.allergies)}</p>
    <p><strong>Current medications:</strong> ${listOrDash(medicalHistory?.medications)}</p>
    <p><strong>Medical conditions:</strong> ${listOrDash(medicalHistory?.conditions)}</p>
    ${medicalHistory?.notes ? `<p><strong>Notes:</strong> ${escapeHtml(medicalHistory.notes)}</p>` : ""}
  </div>

  <p class="salutation">DENTAL TREATMENT SUMMARY</p>
  <p>${escapeHtml(data.treatmentSummary || "No treatment summary provided.")}</p>
  ${procedureList ? `<ul>${procedureList}</ul>` : "<p>No treatment procedures recorded.</p>"}

  <p class="salutation">RECENT VISITS &amp; ENCOUNTERS</p>
  ${visitList ? `<ul>${visitList}</ul>` : "<p>No recent visits recorded.</p>"}

  ${data.additionalNotes ? `<div class="block"><strong>Additional remarks</strong><p>${escapeHtml(data.additionalNotes)}</p></div>` : ""}

  <p>This medical abstract is issued upon the request of the patient for documentation, referral, insurance, or continuity-of-care purposes. It summarizes information available in the clinic record as of the date above.</p>

  <div class="sig-row">
    <div class="sig">
      <div class="sig-line">${escapeHtml(data.attendingDentist || "Attending Dentist")}</div>
      <div class="sig-sub">Attending Dentist${data.licenseNumber ? ` · Lic. ${escapeHtml(data.licenseNumber)}` : ""}</div>
      <div class="sig-sub">${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>
  <div class="footer">Generated electronically${data.generatedBy ? ` · ${escapeHtml(data.generatedBy)}` : ""}</div>`

  return letterShell(`Medical Abstract — ${name}`, body)
}

export function buildMedicalCertificatePrintHtml(data: MedicalCertificateData): string {
  const { patient, clinicName, clinicAddress, clinicPhone, branchName } = data
  const name = `${patient.first_name} ${patient.last_name}`
  const age = patientAge(patient.date_of_birth)
  const typeLabel = CERTIFICATE_TYPE_LABEL[data.certificateType]

  const restLine =
    data.restDays && data.restDays > 0
      ? ` The patient is advised to rest for <strong>${data.restDays}</strong> day(s)${data.validFrom && data.validUntil ? ` from ${fmtDate(data.validFrom)} to ${fmtDate(data.validUntil)}` : ""}.`
      : ""

  const body = `
  <div class="clinic">
    <strong>${escapeHtml(clinicName)}</strong>
    ${branchName ? `${escapeHtml(branchName)}<br />` : ""}
    ${clinicAddress ? `${escapeHtml(clinicAddress)}<br />` : ""}
    ${clinicPhone ? `Tel: ${escapeHtml(clinicPhone)}` : ""}
  </div>
  <h1>Medical Certificate</h1>
  <div class="meta">
    <span><strong>Type:</strong> ${escapeHtml(typeLabel)}</span>
    <span><strong>Examination date:</strong> ${fmtDate(data.examinationDate)}</span>
  </div>

  <p class="salutation">TO WHOM IT MAY CONCERN:</p>

  <p>This is to certify that <strong>${escapeHtml(name)}</strong>, ${age} years old, ${escapeHtml(patient.gender ?? "—")}, was examined at this clinic on <strong>${fmtDate(data.examinationDate)}</strong>${data.purpose ? ` for the purpose of <strong>${escapeHtml(data.purpose)}</strong>` : ""}.</p>

  <div class="block">
    <strong>Clinical findings / diagnosis</strong>
    <p>${escapeHtml(data.diagnosis || "Dental examination completed. No acute contraindication noted.")}</p>
  </div>

  <div class="block">
    <strong>Recommendation</strong>
    <p>${escapeHtml(data.recommendation || "Patient may resume normal activities as tolerated.")}${restLine}</p>
  </div>

  ${data.remarks ? `<div class="block"><strong>Remarks</strong><p>${escapeHtml(data.remarks)}</p></div>` : ""}

  <p>This certificate is issued upon the request of the patient for whatever legal purpose it may serve.</p>

  <div class="sig-row">
    <div class="sig">
      <div class="sig-line">${escapeHtml(data.attendingDentist || "Attending Dentist")}</div>
      <div class="sig-sub">Attending Dentist${data.licenseNumber ? ` · PRC Lic. No. ${escapeHtml(data.licenseNumber)}` : ""}</div>
      <div class="sig-sub">Date issued: ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>
  <div class="footer">Generated electronically${data.generatedBy ? ` · ${escapeHtml(data.generatedBy)}` : ""}</div>`

  return letterShell(`Medical Certificate — ${name}`, body)
}

export function printClinicalLetter(html: string): void {
  openPrintableHtml(html, { autoPrint: true })
}

export function buildDefaultAbstractSummary(
  medicalHistory: MedicalHistoryRecord | null,
  treatmentItems: TreatmentTimelineEntry[]
): { clinicalSummary: string; treatmentSummary: string } {
  const allergyPart = medicalHistory?.allergies?.length
    ? `Known allergies: ${medicalHistory.allergies.join(", ")}. `
    : "No known drug allergies on file. "
  const conditionPart = medicalHistory?.conditions?.length
    ? `Relevant conditions: ${medicalHistory.conditions.join(", ")}. `
    : ""
  const medicationPart = medicalHistory?.medications?.length
    ? `Current medications: ${medicalHistory.medications.join(", ")}.`
    : "No maintenance medications recorded."

  const completed = treatmentItems.filter((i) => i.item_status === "completed")
  const planned = treatmentItems.filter((i) => i.item_status !== "completed" && i.item_status !== "cancelled")

  let treatmentSummary = ""
  if (completed.length) {
    treatmentSummary += `Completed procedures include ${completed
      .slice(0, 5)
      .map((i) => i.description)
      .join(", ")}. `
  }
  if (planned.length) {
    treatmentSummary += `Planned or in-progress care includes ${planned
      .slice(0, 5)
      .map((i) => i.description)
      .join(", ")}.`
  }
  if (!treatmentSummary) {
    treatmentSummary = "Dental treatment history is being documented in the patient chart."
  }

  return {
    clinicalSummary: `${allergyPart}${conditionPart}${medicationPart}`.trim(),
    treatmentSummary: treatmentSummary.trim(),
  }
}
