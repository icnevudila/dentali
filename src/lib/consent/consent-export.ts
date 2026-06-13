import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
} from "docx"
import type { ConsentField, ConsentFieldResponses } from "@/lib/consent/consent-field-types"
import { formatFieldResponseForDisplay } from "@/lib/consent/consent-template-render"

export type ConsentExportPayload = {
  orgName: string
  patientName: string
  templateName: string
  templateVersion: string
  bodyText: string
  signedAt: string
  signerName: string
  signerRole?: string | null
  signatureImageDataUrl?: string | null
  fields?: ConsentField[]
  fieldResponses?: ConsentFieldResponses
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function slugifyFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Opens browser print dialog — user chooses Save as PDF. */
export function printConsentDocument(elementId = "consent-print-document") {
  const el = document.getElementById(elementId)
  if (!el) {
    window.print()
    return
  }
  window.print()
}

export async function downloadConsentDocx(
  payload: ConsentExportPayload,
  filename?: string
): Promise<void> {
  const signedLabel = new Date(payload.signedAt).toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  })

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: payload.orgName, size: 20, color: "666666" })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: payload.templateName, bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Patient: ${payload.patientName} · v${payload.templateVersion}`,
          size: 22,
          color: "444444",
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    ...payload.bodyText.split("\n").map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line || " ", size: 24 })],
          spacing: { after: 120 },
        })
    ),
  ]

  if (payload.fields?.length && payload.fieldResponses) {
    const filled = payload.fields.filter(
      (f) => f.type !== "paragraph" && payload.fieldResponses![f.id] !== undefined
    )
    if (filled.length > 0) {
      children.push(
        new Paragraph({ text: "" }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "Completed fields", bold: true })],
        })
      )
      for (const field of filled) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${field.label}: `, bold: true, size: 22 }),
              new TextRun({
                text: formatFieldResponseForDisplay(field, payload.fieldResponses![field.id]),
                size: 22,
              }),
            ],
          })
        )
      }
    }
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Electronic Signature", bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: payload.signerName,
          italics: true,
          size: 32,
        }),
      ],
    })
  )

  if (payload.signerRole) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Signer: ${payload.signerRole === "guardian" ? "Parent / guardian" : "Patient"}`,
            size: 20,
            color: "666666",
          }),
        ],
      })
    )
  }

  if (payload.signatureImageDataUrl?.startsWith("data:image")) {
    try {
      const bytes = dataUrlToUint8Array(payload.signatureImageDataUrl)
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new ImageRun({
              data: bytes,
              transformation: { width: 180, height: 72 },
              type: "png",
            }),
          ],
        })
      )
    } catch {
      /* skip image if decode fails */
    }
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Signed on ${signedLabel}`, size: 22, color: "666666" })],
    })
  )

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const safeName = slugifyFilename(payload.templateName) || "consent"
  triggerBlobDownload(blob, filename ?? `${safeName}-signed.docx`)
}
