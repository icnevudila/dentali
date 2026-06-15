"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadScannedConsent } from "@/lib/patients/consent-service"
import { toast } from "sonner"

export function ConsentScanUploadButton({
  organizationId,
  patientId,
  consentId,
  templateSlug,
  onUploaded,
  disabled,
}: {
  organizationId: string
  patientId: string
  consentId: string
  templateSlug: string
  onUploaded?: () => void
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const handleFile = async (file: File | null) => {
    if (!file) return
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|webp)$/i)) {
      toast.error("Upload a PDF or photo (JPG, PNG, WebP)")
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File must be under 15 MB")
      return
    }
    setUploading(true)
    const { error } = await uploadScannedConsent({
      organizationId,
      patientId,
      consentId,
      templateSlug,
      file,
    })
    setUploading(false)
    if (error) toast.error(error)
    else {
      toast.success("Signed form uploaded")
      onUploaded?.()
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? null)
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : "Upload signed PDF/photo"}
      </Button>
    </>
  )
}
