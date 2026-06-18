import type { PrescriptionItem, PrescriptionRecord } from "@/lib/clinical/prescription-service"
import { formatBulletLines } from "@/lib/text/bullet-text"
import { openPrintableHtml } from "@/lib/utils/print"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function buildPrescriptionPrintHtml(params: {
  prescription: PrescriptionRecord
  items: PrescriptionItem[]
  patientName: string
  patientAge?: string | null
  patientSex?: string | null
  clinicName: string
  clinicAddress?: string | null
  clinicPhone?: string | null
  branchName?: string | null
  prescriberLicenseNumber?: string | null
  allergies?: string[]
  medications?: string[]
}): string {
  const {
    prescription,
    items,
    patientName,
    patientAge,
    patientSex,
    clinicName,
    clinicAddress,
    clinicPhone,
    branchName,
    prescriberLicenseNumber,
    allergies = [],
    medications = [],
  } = params

  const medRows = items
    .map(
      (item, i) => `
    <tr class="${i % 2 === 1 ? "alt" : ""}">
      <td class="num">${i + 1}</td>
      <td>
        <strong>${escapeHtml(item.drug_name)}</strong>
        ${item.strength ? `<div class="muted">${escapeHtml(item.strength)}</div>` : ""}
      </td>
      <td>${escapeHtml([item.dosage, item.frequency].filter(Boolean).join(" · ") || "—")}</td>
      <td>${escapeHtml(item.duration ?? "—")}</td>
      <td>${escapeHtml(item.quantity ?? "—")}</td>
      <td class="sig">${escapeHtml(item.instructions ?? "—")}</td>
    </tr>`
    )
    .join("")

  const instructionLines = prescription.general_instructions
    ? formatBulletLines(prescription.general_instructions)
    : []

  const alertBlock =
    allergies.length > 0 || medications.length > 0
      ? `<div class="alert-box">
      ${allergies.length ? `<p><strong>Allergies:</strong> ${escapeHtml(allergies.join(", "))}</p>` : ""}
      ${medications.length ? `<p><strong>Current meds:</strong> ${escapeHtml(medications.join(", "))}</p>` : ""}
    </div>`
      : ""

  const voidOverlay =
    prescription.status === "voided"
      ? `<div class="void-stamp">VOID</div>`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prescription — ${escapeHtml(patientName)}</title>
  <style>
    :root { --primary: #0f172a; --muted: #64748b; --border: #e2e8f0; --accent: #0d9488; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: var(--primary); margin: 0; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .brand h1 { margin: 0; font-size: 20px; }
    .brand-meta { font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.5; }
    .rx-badge {
      text-align: right; font-size: 28px; font-weight: 800; letter-spacing: 0.08em; color: var(--accent);
    }
    .rx-date { text-align: right; font-size: 12px; color: var(--muted); margin-top: 4px; }
    .divider { height: 2px; background: linear-gradient(90deg, var(--accent), transparent); margin: 20px 0 28px; }
    .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .field label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 2px; }
    .field span { font-size: 14px; font-weight: 600; }
    .alert-box {
      border: 1px solid #fecaca; background: #fef2f2; color: #991b1b;
      border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 20px;
    }
    .alert-box p { margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); text-align: left; padding: 8px; border-bottom: 2px solid var(--border); }
    td { padding: 10px 8px; font-size: 13px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr.alt td { background: #f8fafc; }
    td.num { width: 32px; text-align: center; color: var(--muted); }
    td.sig { max-width: 180px; }
    .muted { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .instructions { margin-bottom: 32px; }
    .instructions h3 { font-size: 11px; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
    .instructions ul { margin: 0; padding-left: 1.25rem; font-size: 13px; }
  .signature {
      margin-top: 48px; display: flex; justify-content: flex-end;
    }
    .sig-line { width: 240px; border-top: 1px solid var(--primary); padding-top: 8px; text-align: center; font-size: 12px; }
    .sig-sub { margin-top: 3px; font-size: 10px; color: var(--muted); }
    .footer { margin-top: 40px; font-size: 10px; color: var(--muted); text-align: center; }
    .void-stamp {
      position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-18deg);
      font-size: 72px; font-weight: 900; color: rgba(220, 38, 38, 0.18); letter-spacing: 0.2em;
      pointer-events: none; z-index: 0;
    }
    body { position: relative; }
    @media print { .no-print { display: none !important; } body { padding: 20px 24px; } }
  </style>
</head>
<body>
  ${voidOverlay}
  <div class="no-print" style="margin-bottom:16px">
    <button onclick="window.print()" style="padding:8px 20px;background:#0f172a;color:#fff;border:none;border-radius:6px;cursor:pointer">Print prescription</button>
  </div>
  <div class="header">
    <div class="brand">
      <h1>${escapeHtml(clinicName)}</h1>
      <div class="brand-meta">
        ${branchName ? `${escapeHtml(branchName)}<br/>` : ""}
        ${clinicAddress ? `${escapeHtml(clinicAddress)}<br/>` : ""}
        ${clinicPhone ? escapeHtml(clinicPhone) : ""}
      </div>
    </div>
    <div>
      <div class="rx-badge">℞</div>
      <div class="rx-date">${formatDate(prescription.signed_at ?? prescription.created_at)}</div>
      <div class="rx-date">Rx #${escapeHtml(prescription.id.slice(0, 8).toUpperCase())}</div>
    </div>
  </div>
  <div class="divider"></div>
  <div class="patient-grid">
    <div class="field"><label>Patient</label><span>${escapeHtml(patientName)}</span></div>
    <div class="field"><label>Age / Sex</label><span>${escapeHtml([patientAge, patientSex].filter(Boolean).join(" · ") || "—")}</span></div>
    <div class="field" style="grid-column:1/-1"><label>Diagnosis / Indication</label><span>${escapeHtml(prescription.diagnosis ?? "—")}</span></div>
  </div>
  ${alertBlock}
  <table>
    <thead>
      <tr>
        <th>#</th><th>Medication</th><th>Dose / Frequency</th><th>Duration</th><th>Qty</th><th>Sig / Notes</th>
      </tr>
    </thead>
    <tbody>${medRows}</tbody>
  </table>
  ${
    instructionLines.length
      ? `<div class="instructions"><h3>Patient instructions</h3><ul>${instructionLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul></div>`
      : ""
  }
  <div class="signature">
    <div class="sig-line">
      ${escapeHtml(prescription.prescriber_name ?? "Prescribing dentist")}<br/>
      <span class="sig-sub">${prescriberLicenseNumber ? `PRC Lic. No. ${escapeHtml(prescriberLicenseNumber)}` : "License / Signature"}</span>
    </div>
  </div>
  <div class="footer">This prescription is valid for dispensing at a licensed pharmacy. Keep out of reach of children.</div>
</body>
</html>`
}

export function printPrescription(html: string): void {
  openPrintableHtml(html, { autoPrint: true })
}
