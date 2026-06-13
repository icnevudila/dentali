"use client"

import * as React from "react"
import { FileType, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  downloadConsentDocx,
  printConsentDocument,
  type ConsentExportPayload,
} from "@/lib/consent/consent-export"

export function ConsentExportActions({
  payload,
  printElementId = "consent-print-document",
}: {
  payload: ConsentExportPayload
  printElementId?: string
}) {
  const [exporting, setExporting] = React.useState<"docx" | null>(null)
  const [exportError, setExportError] = React.useState<string | null>(null)

  const handleWord = async () => {
    setExporting("docx")
    setExportError(null)
    try {
      await downloadConsentDocx(payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Word export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => printConsentDocument(printElementId)}
        >
          <Printer className="h-4 w-4" />
          Print / PDF
        </Button>
        <Button
          size="sm"
          className="gap-2"
          disabled={exporting === "docx"}
          onClick={() => void handleWord()}
        >
          <FileType className="h-4 w-4" />
          {exporting === "docx" ? "Exporting…" : "Download Word"}
        </Button>
      </div>
      {exportError ? <p className="text-xs text-red-600">{exportError}</p> : null}
      <p className="text-[11px] text-neutral-500 max-w-xs text-right">
        PDF: use Print → Save as PDF. Word: downloads a .docx file.
      </p>
    </div>
  )
}
