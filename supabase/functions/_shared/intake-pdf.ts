import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1"

function line(value: unknown): string {
  const s = String(value ?? "").trim()
  return s || "—"
}

export async function buildIntakePdf(params: {
  intakeId: string
  status: string
  createdAt: string
  payload: Record<string, unknown>
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])
  let y = 750

  const draw = (text: string, size = 11, isBold = false) => {
    const maxWidth = 512
    const chunks: string[] = []
    let remaining = text
    while (remaining.length > 0) {
      if (font.widthOfTextAtSize(remaining, size) <= maxWidth) {
        chunks.push(remaining)
        break
      }
      let splitAt = Math.min(80, remaining.length)
      while (splitAt > 0 && font.widthOfTextAtSize(remaining.slice(0, splitAt), size) > maxWidth) {
        splitAt -= 1
      }
      if (splitAt === 0) splitAt = 1
      chunks.push(remaining.slice(0, splitAt))
      remaining = remaining.slice(splitAt).trimStart()
    }
    for (const chunk of chunks) {
      page.drawText(chunk, {
        x: 50,
        y,
        size,
        font: isBold ? bold : font,
        color: rgb(0.12, 0.12, 0.12),
      })
      y -= size + 6
    }
  }

  const p = params.payload

  draw("Patient Intake Form", 18, true)
  y -= 6
  draw(`Intake ID: ${params.intakeId}`)
  draw(`Status: ${params.status}`)
  draw(`Submitted: ${new Date(params.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`)
  y -= 10
  draw("Patient Details", 14, true)
  draw(`Name: ${line([p.first_name, p.last_name].filter(Boolean).join(" "))}`)
  draw(`Phone: ${line(p.phone)}`)
  draw(`Email: ${line(p.email)}`)
  draw(`Date of birth: ${line(p.date_of_birth)}`)
  draw(`Gender: ${line(p.gender)}`)

  const address = [p.address_line1, p.city].filter((v) => String(v ?? "").trim()).join(", ")
  if (address) draw(`Address: ${address}`)

  if (line(p.emergency_contact_name) !== "—") {
    y -= 8
    draw("Emergency Contact", 14, true)
    draw(`Name: ${line(p.emergency_contact_name)}`)
    draw(`Phone: ${line(p.emergency_contact_phone)}`)
  }

  if (line(p.medical_alerts) !== "—") {
    y -= 8
    draw("Medical Alerts", 14, true)
    draw(line(p.medical_alerts))
  }

  y -= 16
  draw(`Generated ${new Date().toISOString()}`, 9)
  draw("dentali. Clinic OS", 9)

  return doc.save()
}

export function pdfBytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
