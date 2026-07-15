"use client"

import * as React from "react"
import { Camera, FileImage, Loader2, ScanLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  MEDICAL_HISTORY_IMPORT_ACCEPT,
  runMedicalHistoryOcr,
  uploadMedicalHistoryImport,
  type MedicalHistoryOcrDraft,
} from "@/lib/patients/medical-history-ocr-service"
import { useLocale } from "@/hooks/use-locale"

type Props = {
  open: boolean
  onClose: () => void
  organizationId: string
  branchId: string
  patientId: string
  onApplyDraft: (draft: MedicalHistoryOcrDraft) => void
}

export function MedicalHistoryOcrImportDialog({
  open,
  onClose,
  organizationId,
  branchId,
  patientId,
  onApplyDraft,
}: Props) {
  const { t } = useLocale()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [phase, setPhase] = React.useState<"pick" | "reading" | "review">("pick")
  const [error, setError] = React.useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<MedicalHistoryOcrDraft | null>(null)
  const [allergies, setAllergies] = React.useState("")
  const [medications, setMedications] = React.useState("")
  const [conditions, setConditions] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const reset = React.useCallback(() => {
    setBusy(false)
    setPhase("pick")
    setError(null)
    setDraft(null)
    setAllergies("")
    setMedications("")
    setConditions("")
    setNotes("")
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  React.useEffect(() => {
    if (!open) {
      reset()
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, busy, reset])

  const processFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    setPhase("reading")
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })

    const { storagePath, error: uploadError } = await uploadMedicalHistoryImport({
      organizationId,
      branchId,
      patientId,
      file,
    })

    if (uploadError || !storagePath) {
      setError(uploadError ?? t("medicalHistory.ocrUploadFail", "Could not upload that photo."))
      setBusy(false)
      setPhase("pick")
      return
    }

    const { data, error: ocrError } = await runMedicalHistoryOcr({
      organizationId,
      branchId,
      patientId,
      storagePath,
    })

    setBusy(false)

    if (ocrError || !data) {
      setError(ocrError ?? t("medicalHistory.ocrReadFail", "Could not read that form."))
      setPhase("pick")
      return
    }

    setDraft(data)
    setAllergies(data.allergies.join(", "))
    setMedications(data.medications.join(", "))
    setConditions(data.conditions.join(", "))
    setNotes(data.notes ?? "")
    setPhase("review")
  }

  const handleApply = () => {
    if (!draft) return
    const parseList = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)

    onApplyDraft({
      ...draft,
      allergies: parseList(allergies),
      medications: parseList(medications),
      conditions: parseList(conditions),
      notes: notes.trim() ? notes.trim() : null,
    })
    onClose()
  }

  if (!open) return null

  const lowConfidence = (draft?.confidence.overall ?? 1) < 0.6

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("common.close", "Close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-neutral-900">
              {t("medicalHistory.ocrTitle", "Import from paper")}
            </h2>
          </div>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-neutral-600">
            {t(
              "medicalHistory.ocrHint",
              "Photograph your clinic’s printed medical history form. Review the draft, then apply it to the editor and save a new version."
            )}
          </p>

          {error ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          ) : null}

          {phase === "pick" || phase === "reading" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => cameraRef.current?.click()}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {t("medicalHistory.ocrTakePhoto", "Take photo")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="gap-2"
                >
                  <FileImage className="h-4 w-4" />
                  {t("medicalHistory.ocrUpload", "Upload image")}
                </Button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept={MEDICAL_HISTORY_IMPORT_ACCEPT}
                capture="environment"
                className="hidden"
                onChange={(e) => void processFile(e.target.files?.[0])}
              />
              <input
                ref={fileRef}
                type="file"
                accept={MEDICAL_HISTORY_IMPORT_ACCEPT}
                className="hidden"
                onChange={(e) => void processFile(e.target.files?.[0])}
              />
              {phase === "reading" ? (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                  {t("medicalHistory.ocrReading", "Reading form…")}
                </div>
              ) : null}
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img
                  src={previewUrl}
                  alt={t("medicalHistory.ocrPreviewAlt", "Uploaded form preview")}
                  className="max-h-56 w-full rounded-lg border border-neutral-200 object-contain bg-neutral-50"
                />
              ) : null}
            </div>
          ) : null}

          {phase === "review" && draft ? (
            <div className="space-y-4">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={t("medicalHistory.ocrPreviewAlt", "Uploaded form preview")}
                  className="max-h-40 w-full rounded-lg border border-neutral-200 object-contain bg-neutral-50"
                />
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={lowConfidence ? "warning" : "success"}>
                  {t("medicalHistory.ocrConfidence", "Confidence")}{" "}
                  {Math.round(draft.confidence.overall * 100)}%
                </Badge>
                {lowConfidence ? (
                  <span className="text-xs text-amber-700">
                    {t(
                      "medicalHistory.ocrLowConfidence",
                      "Low confidence — review carefully before saving."
                    )}
                  </span>
                ) : null}
              </div>

              {draft.warnings.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
                  {draft.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-600">
                    {t("medicalHistory.allergies", "Allergies")}
                  </label>
                  <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-600">
                    {t("medicalHistory.medications", "Medications")}
                  </label>
                  <Input value={medications} onChange={(e) => setMedications(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-600">
                    {t("medicalHistory.conditions", "Chronic conditions")}
                  </label>
                  <Input value={conditions} onChange={(e) => setConditions(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-600">
                    {t("medicalHistory.notes", "Notes")}
                  </label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 px-4 py-3">
          <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          {phase === "review" ? (
            <Button size="sm" onClick={handleApply}>
              {t("medicalHistory.ocrApply", "Apply to editor")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
