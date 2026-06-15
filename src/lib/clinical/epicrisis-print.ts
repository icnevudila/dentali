import type { InvoiceRecord } from "@/lib/billing/invoice-service"
import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import type { PrescriptionRecord } from "@/lib/clinical/prescription-service"
import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { PatientWithLabCase } from "@/lib/clinical/lab-service"
import type { PatientQueueVisit } from "@/lib/queue/queue-service"
import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import type { PatientWithContacts } from "@/lib/patients/patient-service"
import type { PatientConsent } from "@/lib/patients/consent-service"
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
    month: "short",
    day: "numeric",
  })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-PH")
}

function listOrDash(items: string[] | null | undefined): string {
  if (!items?.length) return "—"
  return items.map(escapeHtml).join(", ")
}

function tableRows(
  rows: string,
  colSpan: number,
  emptyMessage: string
): string {
  return rows || `<tr><td colspan="${colSpan}" class="empty">${emptyMessage}</td></tr>`
}

export type EpicrisisData = {
  patient: PatientWithContacts
  medicalHistory: MedicalHistoryRecord | null
  timeline: TimelineEvent[]
  queueVisits: PatientQueueVisit[]
  labCases: PatientWithLabCase[]
  consents: PatientConsent[]
  treatmentItems: TreatmentTimelineEntry[]
  prescriptions: PrescriptionRecord[]
  invoices: InvoiceRecord[]
  balance: { open_balance: number; total_billed: number; total_paid: number } | null
  clinicName: string
  clinicAddress?: string | null
  clinicPhone?: string | null
  branchName?: string | null
  generatedBy?: string | null
}

export function buildEpicrisisPrintHtml(data: EpicrisisData): string {
  const {
    patient,
    medicalHistory,
    timeline,
    queueVisits,
    labCases,
    consents,
    treatmentItems,
    prescriptions,
    invoices,
    balance,
    clinicName,
    clinicAddress,
    clinicPhone,
    branchName,
    generatedBy,
  } = data

  const age = patient.date_of_birth
    ? String(new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear())
    : "—"

  const clinicalRows = timeline
    .map(
      (e) => `
    <tr>
      <td>${fmtDateTime(e.occurred_at)}</td>
      <td>${escapeHtml(e.event_type.replace(/_/g, " "))}</td>
      <td><strong>${escapeHtml(e.title)}</strong></td>
      <td>${escapeHtml(e.subtitle ?? "—")}</td>
      <td>${escapeHtml(e.status)}</td>
    </tr>`
    )
    .join("")

  const queueRows = queueVisits
    .map(
      (q) => `
    <tr>
      <td>${fmtDateTime(q.checked_in_at)}</td>
      <td>${escapeHtml(q.display_code)}</td>
      <td>${q.appointment_id ? "Scheduled" : "Walk-in"}</td>
      <td>${escapeHtml(q.status)}</td>
      <td>${q.chair_label ? escapeHtml(q.chair_label) : "—"}</td>
      <td>${q.completed_at ? fmtDateTime(q.completed_at) : "—"}</td>
    </tr>`
    )
    .join("")

  const treatmentRows = treatmentItems
    .map(
      (item) => `
    <tr>
      <td>${fmtDate(item.item_created_at)}</td>
      <td>${escapeHtml(item.plan_title)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${item.tooth_number ? escapeHtml(item.tooth_number) : "—"}</td>
      <td>${escapeHtml(item.item_status)}</td>
      <td class="num">₱${Number(item.estimated_price).toLocaleString()}</td>
    </tr>`
    )
    .join("")

  const labRows = labCases
    .map(
      (lab) => `
    <tr>
      <td>${fmtDate(lab.sent_date)}</td>
      <td>${escapeHtml(lab.case_type)}</td>
      <td>${escapeHtml(lab.lab_name)}</td>
      <td>${escapeHtml(lab.status)}</td>
      <td>${lab.expected_date ? fmtDate(lab.expected_date) : "—"}</td>
      <td class="num">${lab.cost != null ? `₱${Number(lab.cost).toLocaleString()}` : "—"}</td>
    </tr>`
    )
    .join("")

  const rxRows = prescriptions
    .map((rx) => {
      const meds =
        rx.items?.map((i) => `${i.drug_name}${i.strength ? ` ${i.strength}` : ""}`).join("; ") ??
        "—"
      return `
    <tr>
      <td>${fmtDateTime(rx.signed_at ?? rx.created_at)}</td>
      <td>${escapeHtml(rx.diagnosis ?? "—")}</td>
      <td>${escapeHtml(meds)}</td>
      <td>${escapeHtml(rx.status)}</td>
      <td>${rx.prescriber_name ? escapeHtml(rx.prescriber_name) : "—"}</td>
    </tr>`
    })
    .join("")

  const consentRows = consents
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.template_name ?? c.template_slug)}</td>
      <td>${escapeHtml(c.status)}</td>
      <td>${c.signed_at ? fmtDateTime(c.signed_at) : "—"}</td>
      <td>${fmtDateTime(c.created_at)}</td>
    </tr>`
    )
    .join("")

  const invoiceRows = invoices
    .map((inv) => {
      const bal = Number(inv.total_amount) - Number(inv.paid_amount)
      return `
    <tr>
      <td>${escapeHtml(inv.invoice_number ?? inv.id.slice(0, 8))}</td>
      <td>${fmtDate(inv.created_at)}</td>
      <td class="num">₱${Number(inv.total_amount).toLocaleString()}</td>
      <td class="num">₱${Number(inv.paid_amount).toLocaleString()}</td>
      <td class="num">₱${bal.toLocaleString()}</td>
      <td>${escapeHtml(inv.status)}</td>
    </tr>`
    })
    .join("")

  const openBalance = balance?.open_balance ?? 0
  const totalBilled = balance?.total_billed ?? invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPaid = balance?.total_paid ?? invoices.reduce((s, i) => s + Number(i.paid_amount), 0)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Epicrisis — ${escapeHtml(patient.first_name)} ${escapeHtml(patient.last_name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; padding: 32px 40px; line-height: 1.5; font-size: 12px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #64748b; font-size: 13px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; }
    .meta { text-align: right; font-size: 11px; color: #475569; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0d9488; border-left: 4px solid #0d9488; padding-left: 8px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
    .grid-item strong { display: block; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 2px; font-family: system-ui, sans-serif; }
    .alert-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
    .alert-box strong { color: #c2410c; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 7px 8px; border-bottom: 2px solid #cbd5e1; font-family: system-ui, sans-serif; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    td.num, th.num { text-align: right; }
    tr:nth-child(even) td { background: #fafafa; }
    .empty { text-align: center; color: #94a3b8; font-style: italic; padding: 14px; }
    .summary-strip { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .summary-pill { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 12px; min-width: 120px; }
    .summary-pill.warn { background: #fffbeb; border-color: #fde68a; }
    .summary-pill strong { display: block; font-size: 9px; text-transform: uppercase; color: #64748b; }
    .summary-pill span { font-size: 16px; font-weight: 700; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; gap: 24px; font-size: 10px; color: #64748b; }
    .sig { width: 220px; border-top: 1px solid #0f172a; text-align: center; padding-top: 6px; margin-top: 32px; color: #0f172a; }
    .notes { white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 11px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 12px 16px; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; font-family: system-ui, sans-serif;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0d9488; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1>Clinical Epicrisis &amp; Discharge Summary</h1>
      <div class="subtitle">${escapeHtml(clinicName)}${branchName ? ` · ${escapeHtml(branchName)}` : ""}</div>
      ${clinicAddress ? `<div class="subtitle">${escapeHtml(clinicAddress)}</div>` : ""}
      ${clinicPhone ? `<div class="subtitle">${escapeHtml(clinicPhone)}</div>` : ""}
    </div>
    <div class="meta">
      <div><strong>Generated:</strong> ${fmtDateTime(new Date().toISOString())}</div>
      <div><strong>Record ref:</strong> #${escapeHtml(patient.id.slice(0, 8).toUpperCase())}</div>
      ${generatedBy ? `<div><strong>Prepared by:</strong> ${escapeHtml(generatedBy)}</div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Patient demographics &amp; contacts</div>
    <div class="grid">
      <div class="grid-item"><strong>Full name</strong>${escapeHtml(patient.first_name)} ${escapeHtml(patient.last_name)}</div>
      <div class="grid-item"><strong>Age / sex</strong>${age} / ${escapeHtml(patient.gender ?? "—")}</div>
      <div class="grid-item"><strong>Date of birth</strong>${fmtDate(patient.date_of_birth)}</div>
      <div class="grid-item"><strong>Phone</strong>${escapeHtml(patient.phone ?? "—")}</div>
      <div class="grid-item"><strong>Email</strong>${escapeHtml(patient.email ?? "—")}</div>
      <div class="grid-item"><strong>Status</strong>${escapeHtml(patient.status)}</div>
      <div class="grid-item" style="grid-column: span 2;"><strong>Address</strong>${escapeHtml(patient.address ?? "—")}</div>
      <div class="grid-item"><strong>Last visit</strong>${fmtDate(patient.last_visit_at)}</div>
      <div class="grid-item"><strong>Emergency contact</strong>${patient.emergency_contact ? `${escapeHtml(patient.emergency_contact.name)}${patient.emergency_contact.phone ? ` · ${escapeHtml(patient.emergency_contact.phone)}` : ""}` : "—"}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Medical history &amp; alerts</div>
    ${
      medicalHistory
        ? `<div class="alert-box"><strong>Allergies:</strong> ${listOrDash(medicalHistory.allergies)}</div>
    <div class="grid" style="grid-template-columns: 1fr 1fr;">
      <div class="grid-item"><strong>Current medications</strong>${listOrDash(medicalHistory.medications)}</div>
      <div class="grid-item"><strong>Medical conditions</strong>${listOrDash(medicalHistory.conditions)}</div>
    </div>
    ${medicalHistory.notes ? `<p class="notes" style="margin-top:8px;"><strong>Clinical notes:</strong> ${escapeHtml(medicalHistory.notes)}</p>` : ""}
    <p style="font-size:10px;color:#64748b;margin-top:6px;">History version ${medicalHistory.version} · updated ${fmtDateTime(medicalHistory.created_at)}</p>`
        : `<p class="empty">No medical history on file.</p>`
    }
  </div>

  <div class="section">
    <div class="section-title">3. Informed consent status</div>
    <table>
      <thead><tr><th>Form</th><th>Status</th><th>Signed</th><th>Created</th></tr></thead>
      <tbody>${tableRows(consentRows, 4, "No consent forms on file.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">4. Visit &amp; encounter log</div>
    <table>
      <thead><tr><th>Date / time</th><th>Queue</th><th>Type</th><th>Status</th><th>Chair</th><th>Completed</th></tr></thead>
      <tbody>${tableRows(queueRows, 6, "No queue visits recorded.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">5. Appointments &amp; clinical notes timeline</div>
    <table>
      <thead><tr><th>Date / time</th><th>Type</th><th>Summary</th><th>Details</th><th>Status</th></tr></thead>
      <tbody>${tableRows(clinicalRows, 5, "No appointments or clinical notes.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">6. Treatment plan procedures</div>
    <table>
      <thead><tr><th>Date</th><th>Plan</th><th>Procedure</th><th>Tooth</th><th>Status</th><th class="num">Est. fee</th></tr></thead>
      <tbody>${tableRows(treatmentRows, 6, "No treatment plan items.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">7. Laboratory cases</div>
    <table>
      <thead><tr><th>Sent</th><th>Case type</th><th>Laboratory</th><th>Status</th><th>Expected</th><th class="num">Cost</th></tr></thead>
      <tbody>${tableRows(labRows, 6, "No lab cases.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">8. Prescriptions issued</div>
    <table>
      <thead><tr><th>Date</th><th>Diagnosis</th><th>Medications</th><th>Status</th><th>Prescriber</th></tr></thead>
      <tbody>${tableRows(rxRows, 5, "No prescriptions on file.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">9. Financial summary &amp; invoices</div>
    <div class="summary-strip">
      <div class="summary-pill"><strong>Total billed</strong><span>₱${totalBilled.toLocaleString()}</span></div>
      <div class="summary-pill"><strong>Total paid</strong><span>₱${totalPaid.toLocaleString()}</span></div>
      <div class="summary-pill${openBalance > 0 ? " warn" : ""}"><strong>Outstanding</strong><span>₱${openBalance.toLocaleString()}</span></div>
    </div>
    <table>
      <thead><tr><th>Invoice</th><th>Issued</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead>
      <tbody>${tableRows(invoiceRows, 6, "No invoices on file.")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">10. Discharge statement</div>
    <p class="notes">This epicrisis summarizes the patient's dental care at ${escapeHtml(clinicName)} from first registration through the report date. It consolidates demographics, medical alerts, consents, visits, planned and completed procedures, prescriptions, laboratory work, and billing. For continuity of care, attach relevant imaging and signed consent scans from the patient chart.</p>
  </div>

  <div class="footer">
    <div>
      <p>Document generated electronically from the clinic management system.</p>
      <p>Valid for referral, insurance, and discharge handover when signed by the attending dentist.</p>
    </div>
    <div>
      <div class="sig">Attending dentist signature &amp; license no.</div>
      <div class="sig" style="margin-top:24px;">Date</div>
    </div>
  </div>
</body>
</html>`
}

export function printEpicrisis(html: string): void {
  openPrintableHtml(html, { autoPrint: true })
}
