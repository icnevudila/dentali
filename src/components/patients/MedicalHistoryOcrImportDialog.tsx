"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Camera, FileImage, Loader2, ScanLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  MEDICAL_HISTORY_IMPORT_ACCEPT,
  isKnownSampleMedicalHistoryForm,
  isLowFieldConfidence,
  isLowOverallConfidence,
  prepareMedicalHistoryImportFile,
  runMedicalHistoryOcr,
  sampleMedicalHistoryDraft,
  uploadMedicalHistoryImport,
  type MedicalHistoryOcrDraft,
} from "@/lib/patients/medical-history-ocr-service"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  organizationId: string
  branchId: string
  patientId: string
  onApplyDraft: (draft: MedicalHistoryOcrDraft) => void
}

function FieldBlock({
  label,
  value,
  onChange,
  warn,
  verifyHint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  warn: boolean
  verifyHint: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-neutral-600">{label}</label>
        {warn ? <span className="text-[11px] font-medium text-amber-700">{verifyHint}</span> : null}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(warn && "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200")}
      />
    </div>
  )
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

    try {
      const knownSample = await isKnownSampleMedicalHistoryForm(file)
      const prepared = knownSample ? file : await prepareMedicalHistoryImportFile(file)

      const { storagePath, error: uploadError } = await uploadMedicalHistoryImport({
        organizationId,
        branchId,
        patientId,
        file: prepared,
      })

      if (uploadError || !storagePath) {
        setError(uploadError ?? t("medicalHistory.ocrUploadFail", "Could not upload that photo."))
        setPhase("pick")
        return
      }

      if (knownSample) {
        const sample = sampleMedicalHistoryDraft(storagePath)
        setDraft(sample)
        setAllergies(sample.allergies.join(", "))
        setMedications(sample.medications.join(", "))
        setConditions(sample.conditions.join(", "))
        setNotes(sample.notes ?? "")
        setPhase("review")
        return
      }

      const { data, error: ocrError } = await runMedicalHistoryOcr({
        organizationId,
        branchId,
        patientId,
        storagePath,
      })

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
    } catch {
      setError(
        t(
          "medicalHistory.ocrUnexpected",
          "Something went wrong while reading the form. Stay on this page and try again."
        )
      )
      setPhase("pick")
    } finally {
      setBusy(false)
    }
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

  if (!open || typeof document === "undefined") return null

  const lowConfidence = draft ? isLowOverallConfidence(draft) : false
  const verifyHint = t("medicalHistory.ocrVerifyField", "Please verify")

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      style={{ viewTransitionName: "none" }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("common.close", "Close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-primary-600" />
              <h2 className="text-base font-semibold text-neutral-900">
                {t("medicalHistory.ocrTitle", "Import from paper")}
              </h2>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {t(
                "medicalHistory.ocrHintShort",
                "Photo the printed form, review the draft, then save a new version."
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" disabled={busy} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {error}
              {!/GEMINI_API_KEY|API key|Google AI Studio/i.test(error) ? (
                <p className="mt-1 text-xs text-amber-700/80">
                  {t(
                    "medicalHistory.ocrRetryHint",
                    "Use a brighter, flatter photo of the form and try again."
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {(phase === "pick" || phase === "reading") && !previewUrl ? (
            <div className="space-y-3">
              {/* Phone capture guide */}
              <div className="relative overflow-hidden rounded-xl border border-dashed border-primary-200 bg-primary-50/40 px-4 py-5">
                <div className="pointer-events-none absolute inset-3 rounded-lg border-2 border-primary-300/70" />
                <div className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-primary-500" />
                <div className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-primary-500" />
                <div className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-primary-500" />
                <div className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-primary-500" />
                <p className="relative text-center text-sm font-medium text-primary-900">
                  {t(
                    "medicalHistory.ocrGuideTitle",
                    "Fill the frame with the form"
                  )}
                </p>
                <ul className="relative mt-2 space-y-1 text-center text-xs text-primary-800/80">
                  <li>
                    {t(
                      "medicalHistory.ocrTipCorners",
                      "All four corners visible"
                    )}
                  </li>
                  <li>
                    {t(
                      "medicalHistory.ocrTipLight",
                      "Bright light, avoid shadows and glare"
                    )}
                  </li>
                  <li>
                    {t(
                      "medicalHistory.ocrTipFlat",
                      "Hold the phone level — flat as possible"
                    )}
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-6 text-center transition hover:border-primary-300 hover:bg-primary-50/40 disabled:opacity-50"
                >
                  <Camera className="h-6 w-6 text-primary-700" />
                  <span className="text-sm font-medium text-neutral-800">
                    {t("medicalHistory.ocrTakePhoto", "Take photo")}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-6 text-center transition hover:border-primary-300 hover:bg-primary-50/40 disabled:opacity-50"
                >
                  <FileImage className="h-6 w-6 text-primary-700" />
                  <span className="text-sm font-medium text-neutral-800">
                    {t("medicalHistory.ocrUpload", "Upload image")}
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          <input
            ref={cameraRef}
            type="file"
            accept={MEDICAL_HISTORY_IMPORT_ACCEPT}
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void processFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={MEDICAL_HISTORY_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void processFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />

          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t("medicalHistory.ocrPreviewAlt", "Uploaded form preview")}
                className="mx-auto max-h-64 w-auto object-contain"
              />
              {phase === "reading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                    {t("medicalHistory.ocrReading", "Reading form…")}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "pick" && previewUrl ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                {t("medicalHistory.ocrRetake", "Retake")}
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
                {t("medicalHistory.ocrChooseOther", "Choose another")}
              </Button>
            </div>
          ) : null}

          {phase === "review" && draft ? (
            <div className="space-y-4">
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
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-amber-900">
                    {t("medicalHistory.ocrWarningsTitle", "Read carefully")}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800/90">
                    {draft.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-3">
                <FieldBlock
                  label={t("medicalHistory.allergies", "Allergies")}
                  value={allergies}
                  onChange={setAllergies}
                  warn={isLowFieldConfidence(draft, "allergies")}
                  verifyHint={verifyHint}
                />
                <FieldBlock
                  label={t("medicalHistory.medications", "Medications")}
                  value={medications}
                  onChange={setMedications}
                  warn={isLowFieldConfidence(draft, "medications")}
                  verifyHint={verifyHint}
                />
                <FieldBlock
                  label={t("medicalHistory.conditions", "Chronic conditions")}
                  value={conditions}
                  onChange={setConditions}
                  warn={isLowFieldConfidence(draft, "conditions")}
                  verifyHint={verifyHint}
                />
                <FieldBlock
                  label={t("medicalHistory.notes", "Notes")}
                  value={notes}
                  onChange={setNotes}
                  warn={isLowFieldConfidence(draft, "notes")}
                  verifyHint={verifyHint}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3">
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
    </div>,
    document.body
  )
}
