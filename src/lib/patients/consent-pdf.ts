import { parseSignatureDisplay } from "@/lib/patients/consent-service"
import type { ConsentField, ConsentFieldResponses } from "@/lib/consent/consent-field-types"
import { formatFieldResponseForDisplay } from "@/lib/consent/consent-template-render"

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function renderFieldResponsesHtml(
  fields: ConsentField[] | undefined,
  responses: ConsentFieldResponses | undefined
): string {
  if (!fields?.length || !responses) return ""
  const filled = fields.filter((f) => f.type !== "paragraph" && responses[f.id] !== undefined)
  if (filled.length === 0) return ""

  const rows = filled
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${escapeHtml(f.label)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(formatFieldResponseForDisplay(f, responses[f.id]))}</td></tr>`
    )
    .join("")

  return `<h2 style="font-size:1rem;margin:24px 0 12px;font-family:system-ui,sans-serif">Completed responses</h2>
<table style="width:100%;border-collapse:collapse;font-size:0.875rem;font-family:system-ui,sans-serif">${rows}</table>`
}

export function buildSignedConsentHtml(params: {
  orgName: string
  patientName: string
  patientId: string
  templateName: string
  templateBody: string
  templateVersion: string
  signatureData: string
  signedAt: string
  signerRole?: string | null
  fields?: ConsentField[]
  fieldResponses?: ConsentFieldResponses
}): string {
  const signedDateLabel = new Date(params.signedAt).toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  })
  const { name: signerName, imageDataUrl, signerRole: roleFromPayload } = parseSignatureDisplay(
    params.signatureData
  )
  const signerRole = params.signerRole ?? roleFromPayload
  const signatureImg = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="Signature" style="max-height:96px;margin-top:12px;border:1px solid #e5e5e5;border-radius:4px" />`
    : ""
  const roleLine = signerRole
    ? `<p style="font-size:0.8125rem;color:#666;margin-top:4px">Signer: ${signerRole === "guardian" ? "Parent / guardian" : "Patient"}</p>`
    : ""
  const responsesHtml = renderFieldResponsesHtml(params.fields, params.fieldResponses)

  return `<!DOCTYPE html>
<html lang="en-PH">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.templateName)} — Signed</title>
  <style>
    body { font-family: Georgia, serif; color: #111; margin: 40px; max-width: 720px; line-height: 1.6; }
    h1 { font-size: 1.25rem; margin: 0 0 4px; font-family: system-ui, sans-serif; }
    .meta { color: #666; font-size: 0.875rem; font-family: system-ui, sans-serif; margin-bottom: 24px; }
    .body { white-space: pre-wrap; font-size: 0.9375rem; margin: 24px 0; }
    .sig { border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 32px; font-family: system-ui, sans-serif; }
    .sig-name { font-size: 1.5rem; font-style: italic; border-bottom: 1px solid #ccc; display: inline-block; min-width: 200px; padding-bottom: 4px; }
    .badge { display: inline-block; background: #ecfdf5; color: #166534; border: 1px solid #86efac; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-family: system-ui, sans-serif; }
    .footer { margin-top: 48px; font-size: 0.75rem; color: #888; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <p class="meta">${escapeHtml(params.orgName)}</p>
  <h1>${escapeHtml(params.templateName)} <span class="badge">Signed</span></h1>
  <p class="meta">Patient: ${escapeHtml(params.patientName)} · Ref ${escapeHtml(params.patientId.slice(0, 8))} · v${escapeHtml(params.templateVersion)}</p>
  <div class="body">${escapeHtml(params.templateBody)}</div>
  ${responsesHtml}
  <div class="sig">
    <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;margin-bottom:8px">Electronic Signature</p>
    <p class="sig-name">${escapeHtml(signerName)}</p>
    ${roleLine}
    ${signatureImg}
    <p style="font-size:0.875rem;color:#666;margin-top:12px">Signed on ${escapeHtml(signedDateLabel)}</p>
  </div>
  <p class="footer">Signed consent record · Generated ${escapeHtml(new Date().toLocaleString("en-PH"))} · Use Print → Save as PDF to archive.</p>
</body>
</html>`
}

export function signedConsentHtmlToBlob(html: string): Blob {
  return new Blob([html], { type: "text/html;charset=utf-8" })
}
