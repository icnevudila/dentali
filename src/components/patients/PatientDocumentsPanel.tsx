"use client"

import * as React from "react"
import { Upload, Download, Trash2, FileText, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  deletePatientDocument,
  fetchPatientDocuments,
  formatFileSize,
  getPatientDocumentUrl,
  MAX_PATIENT_DOCUMENT_BYTES,
  PATIENT_DOCUMENT_CATEGORIES,
  uploadPatientDocument,
  type PatientDocument,
  type PatientDocumentCategory,
} from "@/lib/patients/patient-documents-service"

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-neutral-400 shrink-0" />
  return <FileText className="h-5 w-5 text-neutral-400 shrink-0" />
}

export function PatientDocumentsPanel({ patientId }: { patientId: string }) {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [documents, setDocuments] = React.useState<PatientDocument[]>([])
  const [notes, setNotes] = React.useState("")
  const [category, setCategory] = React.useState<PatientDocumentCategory>("other")
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const dateLocale = locale === "tr" ? "tr-PH" : locale === "fil" ? "fil-PH" : "en-PH"

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await fetchPatientDocuments(patientId)
    setDocuments(data)
    setError(err)
    setLoading(false)
  }, [patientId])

  React.useEffect(() => {
    load()
  }, [load])

  const processFile = async (file: File) => {
    if (!activeBranch) return
    if (file.size > MAX_PATIENT_DOCUMENT_BYTES) {
      setError(
        t("patients.docTooLarge", "File exceeds {max} limit").replace(
          "{max}",
          formatFileSize(MAX_PATIENT_DOCUMENT_BYTES)
        )
      )
      return
    }

    setUploading(true)
    setError(null)

    const org = await fetchOrganization()
    if (!org) {
      setError(t("patients.orgNotFound", "Organization not found"))
      setUploading(false)
      return
    }

    const { error: err } = await uploadPatientDocument({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      file,
      notes: notes || undefined,
      category,
    })

    setUploading(false)
    if (err) setError(err)
    else {
      setNotes("")
      await load()
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await processFile(file)
  }

  const handleDownload = async (doc: PatientDocument) => {
    const { url, error: err } = await getPatientDocumentUrl(doc.storage_path)
    if (err || !url) {
      setError(err ?? t("patients.docDownloadError", "Could not generate download link"))
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleDelete = async (doc: PatientDocument) => {
    if (!confirm(t("patients.docDeleteConfirm", "Delete {name}?").replace("{name}", doc.file_name))) return
    const { error: err } = await deletePatientDocument({
      documentId: doc.id,
      storagePath: doc.storage_path,
    })
    if (err) setError(err)
    else await load()
  }

  const categoryLabel = (value: PatientDocumentCategory) => {
    const item = PATIENT_DOCUMENT_CATEGORIES.find((c) => c.value === value)
    return item ? t(item.labelKey, item.fallback) : value
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{t("patients.documentsTitle", "Patient Documents")}</CardTitle>
          <CardDescription>
            {t("patients.documentsSubtitle", "X-rays, IDs, referrals, and other files (private storage).")}
          </CardDescription>
        </div>
        <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
          <Button
            size="sm"
            className="gap-2"
            disabled={uploading || !activeBranch}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? t("patients.docUploading", "Uploading…") : t("patients.docUpload", "Upload file")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={handleUpload}
            disabled={uploading || !activeBranch}
          />
        </PermissionGate>
      </CardHeader>
      <CardContent className="space-y-4">
        <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
          <div
            className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-secondary)]"
                : "border-[var(--color-border-primary)]"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("patients.docDropHint", "Drag a file here or use Upload — max {max}").replace(
                "{max}",
                formatFileSize(MAX_PATIENT_DOCUMENT_BYTES)
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PatientDocumentCategory)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            >
              {PATIENT_DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.labelKey, c.fallback)}
                </option>
              ))}
            </select>
            <Input
              placeholder={t("patients.docNotesPlaceholder", "Optional note for next upload")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </PermissionGate>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</p>
        )}

        {loading ? (
          <PageLoadingSkeleton variant="listRows" />
        ) : documents.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">
            {t("patients.documentsEmpty", "No documents uploaded yet.")}
          </p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-4 text-sm">
                <FileIcon mime={doc.file_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {categoryLabel(doc.category)}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleString(dateLocale)}
                    {doc.uploader_name ? ` · ${doc.uploader_name}` : ""}
                    {doc.notes ? ` · ${doc.notes}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} aria-label={t("patients.docDownload", "Download")}>
                  <Download className="h-4 w-4" />
                </Button>
                <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)} aria-label={t("patients.docDelete", "Delete")}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </PermissionGate>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
