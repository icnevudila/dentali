import type { PrescriptionItem, PrescriptionRecord } from "@/lib/clinical/prescription-service"
import {
  DEFAULT_PRESCRIPTION_BRANDING,
  type PrescriptionBrandingSettings,
} from "@/lib/branding/prescription-branding"
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
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function renderImage(src: string | null | undefined, className: string, alt: string): string {
  if (!src) return ""
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="${className}" />`
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
  branding?: PrescriptionBrandingSettings | null
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
    branding: rawBranding,
  } = params

  const branding = rawBranding ?? DEFAULT_PRESCRIPTION_BRANDING
  const instructionLines = prescription.general_instructions
    ? formatBulletLines(prescription.general_instructions)
    : []

  const medRows = items
    .map(
      (item, i) => `
        <div class="rx-line">
          <div class="rx-line-index">${i + 1}</div>
          <div class="rx-line-body">
            <div class="rx-line-drug">
              ${escapeHtml(item.drug_name)}
              ${item.strength ? `<span class="rx-line-strength">${escapeHtml(item.strength)}</span>` : ""}
            </div>
            <div class="rx-line-meta">
              ${[item.dosage, item.frequency, item.duration, item.quantity]
                .filter(Boolean)
                .map((part) => `<span>${escapeHtml(part ?? "")}</span>`)
                .join("")}
            </div>
            ${
              item.instructions
                ? `<div class="rx-line-instructions">${escapeHtml(item.instructions)}</div>`
                : `<div class="rx-line-instructions muted-line">Follow as directed.</div>`
            }
          </div>
        </div>`
    )
    .join("")

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

  const patientMeta = [patientAge ? `${escapeHtml(patientAge)} y/o` : null, patientSex].filter(Boolean).join(" · ")
  const signatureLabel = branding.licenseLabel ?? DEFAULT_PRESCRIPTION_BRANDING.licenseLabel
  const ptrLabel = branding.ptrLabel ?? DEFAULT_PRESCRIPTION_BRANDING.ptrLabel
  const footerNote = branding.footerNote ?? DEFAULT_PRESCRIPTION_BRANDING.footerNote

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prescription - ${escapeHtml(patientName)}</title>
  <style>
    :root {
      --ink: #10333c;
      --muted: #5f7680;
      --line: #d8e7ea;
      --accent: #5ecdd8;
      --accent-dark: #1597a4;
      --paper: #ffffff;
      --alert-bg: #fff7ed;
      --alert-border: #fed7aa;
      --alert-text: #9a3412;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef4f5;
      color: var(--ink);
      font-family: "Aptos", "Segoe UI", Arial, sans-serif;
      padding: 24px;
    }
    .page {
      position: relative;
      width: min(100%, 820px);
      margin: 0 auto;
      background: var(--paper);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.10);
    }
    .print-actions {
      margin: 0 auto 16px;
      width: min(100%, 820px);
    }
    .print-actions button {
      padding: 10px 18px;
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 700;
    }
    .sheet {
      position: relative;
      min-height: 1120px;
      padding: 28px 34px 120px;
      overflow: hidden;
    }
    .banner-shell {
      margin: -28px -34px 22px;
    }
    .banner-image {
      display: block;
      width: 100%;
      height: auto;
      max-height: 190px;
      object-fit: contain;
      object-position: top center;
      background: #fff;
    }
    .banner-fallback {
      padding: 26px 34px 20px;
      background: linear-gradient(135deg, #c8f0f4 0%, #effafc 55%, #d6f3f6 100%);
      border-bottom: 5px solid var(--accent);
    }
    .banner-fallback h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1;
      letter-spacing: 0.04em;
      color: var(--accent-dark);
    }
    .banner-fallback p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .top-meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .patient-block {
      flex: 1;
    }
    .line-row {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 10px;
    }
    .line-label {
      width: 82px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .line-value {
      flex: 1;
      min-height: 24px;
      border-bottom: 1px solid var(--line);
      padding: 0 0 4px;
      font-size: 14px;
    }
    .line-split {
      display: flex;
      gap: 12px;
    }
    .line-split .line-value {
      min-width: 0;
    }
    .meta-stack {
      min-width: 170px;
      text-align: right;
    }
    .meta-chip {
      border: 1px solid #d6edf0;
      border-radius: 16px;
      padding: 10px 12px;
      background: #f8fcfd;
    }
    .meta-chip .kicker {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .meta-chip strong {
      display: block;
      font-size: 13px;
    }
    .rx-id {
      margin-top: 8px;
      font-size: 11px;
      color: var(--muted);
    }
    .diagnosis-card {
      margin: 18px 0 16px;
      padding: 12px 14px;
      border: 1px solid #dff1f4;
      background: #f7fcfc;
      border-radius: 16px;
    }
    .diagnosis-card strong {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .alert-box {
      border: 1px solid var(--alert-border);
      background: var(--alert-bg);
      color: var(--alert-text);
      border-radius: 16px;
      padding: 12px 14px;
      font-size: 12px;
      margin-bottom: 18px;
    }
    .alert-box p { margin: 0 0 4px; }
    .rx-zone {
      position: relative;
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 18px;
      min-height: 460px;
    }
    .rx-mark {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 88px;
      line-height: 0.95;
      color: var(--accent-dark);
      font-weight: 700;
      padding-top: 8px;
    }
    .watermark {
      position: absolute;
      inset: 58px 80px 120px 130px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0.12;
    }
    .watermark img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .rx-list {
      position: relative;
      z-index: 1;
      padding-top: 10px;
    }
    .rx-line {
      display: flex;
      gap: 12px;
      margin-bottom: 18px;
    }
    .rx-line-index {
      width: 28px;
      padding-top: 4px;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
    }
    .rx-line-body {
      flex: 1;
      padding-bottom: 10px;
      border-bottom: 1px dashed #d7e6e8;
    }
    .rx-line-drug {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .rx-line-strength {
      margin-left: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
    }
    .rx-line-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-top: 6px;
      font-size: 12px;
      color: #244852;
    }
    .rx-line-meta span {
      padding: 4px 9px;
      border-radius: 999px;
      background: #f1fbfc;
      border: 1px solid #def2f5;
    }
    .rx-line-instructions {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.5;
      min-height: 24px;
    }
    .muted-line {
      color: var(--muted);
    }
    .instructions {
      position: relative;
      z-index: 1;
      margin-top: 10px;
      padding: 14px 16px;
      border: 1px solid #dff1f4;
      background: #fcffff;
      border-radius: 18px;
    }
    .instructions h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--muted);
      letter-spacing: 0.12em;
      margin: 0 0 8px;
    }
    .instructions ul {
      margin: 0;
      padding-left: 1.25rem;
      font-size: 13px;
      line-height: 1.6;
    }
    .signature-area {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: flex-end;
      margin-top: 56px;
    }
    .signature-card {
      width: 270px;
      text-align: right;
    }
    .signature-image {
      display: block;
      width: 160px;
      max-height: 70px;
      object-fit: contain;
      margin: 0 0 4px auto;
    }
    .signature-name {
      font-weight: 700;
      font-size: 16px;
      color: #23424b;
    }
    .signature-title {
      margin-top: 4px;
      font-size: 12px;
      color: var(--muted);
    }
    .signature-meta {
      margin-top: 12px;
      font-size: 11px;
      color: #31515b;
      line-height: 1.7;
    }
    .footer-note {
      position: absolute;
      left: 34px;
      right: 34px;
      bottom: 86px;
      text-align: left;
      font-size: 10px;
      color: var(--muted);
    }
    .footer-strip-image {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: auto;
      max-height: 116px;
      object-fit: contain;
      object-position: bottom center;
    }
    .footer-strip-fallback {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 78px;
      background: linear-gradient(180deg, #6fd7df 0%, #54c7d2 100%);
    }
    .void-stamp {
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-18deg);
      font-size: 72px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.18);
      letter-spacing: 0.2em;
      pointer-events: none;
      z-index: 0;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; background: #fff; }
      .page {
        width: 100%;
        max-width: none;
        border-radius: 0;
        box-shadow: none;
      }
      .sheet {
        min-height: auto;
      }
    }
  </style>
</head>
<body>
  ${voidOverlay}
  <div class="no-print print-actions">
    <button onclick="window.print()">Print prescription</button>
  </div>
  <div class="page">
    <div class="sheet">
      <div class="banner-shell">
        ${
          branding.headerImageDataUrl
            ? renderImage(branding.headerImageDataUrl, "banner-image", "Clinic banner")
            : `<div class="banner-fallback">
                <h1>${escapeHtml(clinicName)}</h1>
                <p>
                  ${branchName ? `${escapeHtml(branchName)} · ` : ""}
                  ${clinicAddress ? `${escapeHtml(clinicAddress)} · ` : ""}
                  ${clinicPhone ? escapeHtml(clinicPhone) : "Prescription pad"}
                </p>
              </div>`
        }
      </div>

      <div class="top-meta">
        <div class="patient-block">
          <div class="line-row">
            <div class="line-label">Patient:</div>
            <div class="line-value">${escapeHtml(patientName)}</div>
          </div>
          <div class="line-split">
            <div class="line-row" style="flex:1;">
              <div class="line-label">Age / Sex:</div>
              <div class="line-value">${escapeHtml(patientMeta || "-")}</div>
            </div>
            <div class="line-row" style="flex:1;">
              <div class="line-label">Date:</div>
              <div class="line-value">${formatDate(prescription.signed_at ?? prescription.created_at)}</div>
            </div>
          </div>
        </div>
        <div class="meta-stack">
          <div class="meta-chip">
            <span class="kicker">Prescription</span>
            <strong>Rx #${escapeHtml(prescription.id.slice(0, 8).toUpperCase())}</strong>
          </div>
          <div class="rx-id">${escapeHtml(branchName ?? clinicName)}</div>
        </div>
      </div>

      <div class="diagnosis-card">
        <strong>Diagnosis / Indication</strong>
        <div>${escapeHtml(prescription.diagnosis ?? "-")}</div>
      </div>

      ${alertBlock}

      <div class="rx-zone">
        ${
          branding.showWatermark && branding.watermarkImageDataUrl
            ? `<div class="watermark">${renderImage(branding.watermarkImageDataUrl, "", "Clinic watermark")}</div>`
            : ""
        }
        <div class="rx-mark">Rx</div>
        <div class="rx-list">${medRows}</div>
      </div>

      ${
        instructionLines.length
          ? `<div class="instructions"><h3>Patient instructions</h3><ul>${instructionLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></div>`
          : ""
      }

      <div class="signature-area">
        <div class="signature-card">
          ${renderImage(branding.signatureImageDataUrl, "signature-image", "Signature")}
          <div class="signature-name">${escapeHtml(prescription.prescriber_name ?? "Prescribing dentist")}</div>
          <div class="signature-title">${escapeHtml(branding.doctorTitle ?? "Dentist")}</div>
          <div class="signature-meta">
            ${prescriberLicenseNumber ? `${escapeHtml(signatureLabel ?? "PRC Lic. No.")}: ${escapeHtml(prescriberLicenseNumber)}<br/>` : ""}
            ${branding.ptrNumber ? `${escapeHtml(ptrLabel ?? "PTR No.")}: ${escapeHtml(branding.ptrNumber)}` : ""}
          </div>
        </div>
      </div>

      <div class="footer-note">${escapeHtml(footerNote ?? "")}</div>
      ${
        branding.footerImageDataUrl
          ? renderImage(branding.footerImageDataUrl, "footer-strip-image", "Footer strip")
          : `<div class="footer-strip-fallback"></div>`
      }
    </div>
  </div>
</body>
</html>`
}

export function printPrescription(html: string): void {
  openPrintableHtml(html, { autoPrint: true })
}
