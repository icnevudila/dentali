"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  Upload,
  Download,
  Trash2,
  ImageIcon,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Contrast as ContrastIcon,
  RefreshCw,
  Eye,
  EyeOff,
  FileText,
  Images,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { notify } from "@/lib/ui/notify"
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
  uploadPatientDocument,
  type PatientDocument,
} from "@/lib/patients/patient-documents-service"

interface RadiologyImage extends PatientDocument {
  url: string | null
}

export function PatientRadiologyPanel({ patientId }: { patientId: string }) {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [images, setImages] = React.useState<RadiologyImage[]>([])
  const [notes, setNotes] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Lightbox State
  const [selectedImage, setSelectedImage] = React.useState<RadiologyImage | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [brightness, setBrightness] = React.useState(100)
  const [contrast, setContrast] = React.useState(100)
  const [invert, setInvert] = React.useState(false)
  const [rotation, setRotation] = React.useState(0)
  const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStart = React.useRef({ x: 0, y: 0 })
  const [viewerMounted, setViewerMounted] = React.useState(false)

  React.useEffect(() => {
    setViewerMounted(true)
  }, [])

  React.useEffect(() => {
    if (!selectedImage) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImage(null)
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [selectedImage])

  const dateLocale = locale === "tr" ? "tr-PH" : locale === "fil" ? "fil-PH" : "en-PH"

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await fetchPatientDocuments(patientId)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }

    // Filter to only xray category
    const xrayDocs = data.filter((doc) => doc.category === "xray")

    // Fetch signed URLs for all X-rays in parallel
    const xrayWithUrls = await Promise.all(
      xrayDocs.map(async (doc) => {
        const isImage = doc.file_type.startsWith("image/")
        let url: string | null = null
        if (isImage) {
          const { url: signedUrl } = await getPatientDocumentUrl(doc.storage_path)
          url = signedUrl
        }
        return { ...doc, url }
      })
    )

    setImages(xrayWithUrls)
    setLoading(false)
  }, [patientId])

  React.useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
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
      category: "xray", // Force xray category
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

  const handleDelete = async (doc: PatientDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!(await notify.confirm(t("patients.docDeleteConfirm", "Delete {name}?").replace("{name}", doc.file_name)))) return
    
    const { error: err } = await deletePatientDocument({
      documentId: doc.id,
      storagePath: doc.storage_path,
    })
    
    if (err) setError(err)
    else {
      if (selectedImage?.id === doc.id) {
        setSelectedImage(null)
      }
      await load()
    }
  }

  const resetFilters = () => {
    setZoom(1)
    setBrightness(100)
    setContrast(100)
    setInvert(false)
    setRotation(0)
    setPanOffset({ x: 0, y: 0 })
  }

  const imageCount = images.filter((image) => image.file_type.startsWith("image/")).length
  const pdfCount = images.filter((image) => image.file_type === "application/pdf").length
  const latestImage = images[0] ?? null

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const viewerOverlay =
    selectedImage && viewerMounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col select-none overflow-hidden bg-neutral-950 text-white animate-in fade-in duration-200">
            {/* Header */}
            <header className="flex shrink-0 flex-col gap-3 border-b border-neutral-800 bg-neutral-900 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Images className="h-4 w-4 shrink-0 text-primary-300" aria-hidden />
                  <h3 className="truncate text-lg font-bold">
                    {selectedImage.notes || selectedImage.file_name}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {t("patients.imagingDate", "Imaged on")}:{" "}
                  {new Date(selectedImage.created_at).toLocaleString(dateLocale)}
                  {selectedImage.uploader_name
                    ? ` · ${t("patients.uploadedBy", "By")}: ${selectedImage.uploader_name}`
                    : ""}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
                  onClick={() => handleDownload(selectedImage)}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {t("patients.docDownload", "Download")}
                </Button>
                <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedImage)}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {t("patients.docDelete", "Delete")}
                  </Button>
                </PermissionGate>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-3 text-lg font-bold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  aria-label={t("common.close", "Close")}
                  onClick={() => setSelectedImage(null)}
                >
                  ×
                </Button>
              </div>
            </header>

            {/* Main workspace — min-h-0 lets the canvas fill remaining viewport height */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div
                className={`relative flex min-h-[55vh] min-w-0 flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-3 md:min-h-0 md:p-6 ${
                  zoom > 1 ? "cursor-grab" : ""
                } ${isDragging ? "cursor-grabbing" : ""}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {selectedImage.url ? (
                  <div
                    className="flex max-h-full max-w-full items-center justify-center transition-transform duration-100 ease-out"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage.url}
                      alt={selectedImage.file_name}
                      className="pointer-events-none max-h-[calc(100dvh-11rem)] max-w-[calc(100vw-1.5rem)] object-contain md:max-h-[calc(100dvh-7rem)] md:max-w-[calc(100vw-22rem)]"
                      style={{
                        filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert ? 100 : 0}%)`,
                      }}
                    />
                  </div>
                ) : null}

                <div className="absolute bottom-4 left-4 rounded-full border border-neutral-800 bg-black/60 px-3 py-1.5 font-mono text-xs text-neutral-300">
                  Zoom: {Math.round(zoom * 100)}%
                </div>
              </div>

              <div className="flex max-h-[min(45vh,28rem)] w-full shrink-0 flex-col justify-between overflow-y-auto border-t border-neutral-800 bg-neutral-900 p-4 md:max-h-none md:w-80 md:border-l md:border-t-0 md:p-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-300">
                      {t("patients.diagnosticTools", "Diagnostic Tools")}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {t(
                        "patients.radiologyToolsDesc",
                        "Adjust sliders to enhance contrast, brightness, or invert colors to inspect root tips and caries."
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-neutral-300">
                        <Sun className="h-4 w-4 text-neutral-400" />
                        {t("patients.brightness", "Brightness")}
                      </span>
                      <span className="font-mono text-xs text-neutral-400">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-primary-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-neutral-300">
                        <ContrastIcon className="h-4 w-4 text-neutral-400" />
                        {t("patients.contrast", "Contrast")}
                      </span>
                      <span className="font-mono text-xs text-neutral-400">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-primary-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-neutral-300">
                        <ZoomIn className="h-4 w-4 text-neutral-400" />
                        {t("patients.zoom", "Zoom")}
                      </span>
                      <span className="font-mono text-xs text-neutral-400">{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.1"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-primary-500"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
                        onClick={() => setZoom(Math.min(4, zoom + 0.25))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="h-9 gap-1.5 border-neutral-700 bg-transparent text-xs text-white hover:bg-neutral-800"
                      onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      {t("patients.rotate", "Rotate 90°")}
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-9 gap-1.5 border-neutral-700 text-xs text-white hover:bg-neutral-800 ${
                        invert ? "border-primary-600 bg-primary-600 hover:bg-primary-700" : "bg-transparent"
                      }`}
                      onClick={() => setInvert((prev) => !prev)}
                    >
                      {invert ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {t("patients.invertColors", "Invert Colors")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 border-t border-neutral-800 pt-6">
                  {zoom > 1 ? (
                    <p className="text-center text-xs italic text-neutral-400">
                      {t("patients.panHint", "Drag the image to pan around")}
                    </p>
                  ) : null}
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
                    onClick={resetFilters}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("patients.resetFilters", "Reset View")}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{t("patients.radiologyTitle", "Radiology & Dental Imaging")}</CardTitle>
            <CardDescription>
              {t("patients.radiologySubtitle", "Panoramic, periapical, bitewing X-rays, and clinical photos.")}
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
              {uploading ? t("patients.docUploading", "Uploading…") : t("patients.uploadXray", "Upload X-Ray")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleUpload}
              disabled={uploading || !activeBranch}
            />
          </PermissionGate>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2">
              <p className="text-xs font-medium text-neutral-500">{t("patients.radiologyImageCount", "Images")}</p>
              <p className="mt-1 text-2xl font-bold text-neutral-950">{loading ? "—" : imageCount}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2">
              <p className="text-xs font-medium text-neutral-500">{t("patients.radiologyPdfCount", "PDF files")}</p>
              <p className="mt-1 text-2xl font-bold text-neutral-950">{loading ? "—" : pdfCount}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2">
              <p className="text-xs font-medium text-neutral-500">{t("patients.radiologyLatest", "Latest")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
                {latestImage
                  ? new Date(latestImage.created_at).toLocaleDateString(dateLocale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : t("patients.radiologyNoLatest", "No imaging yet")}
              </p>
            </div>
          </div>

          <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
            <div
              className={`rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary-500 bg-primary-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-8 w-8 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-700">
                  {t("patients.radiologyDropHint", "Drag X-ray files here or click to browse")}
                </p>
                <p className="text-xs text-neutral-500">
                  {t("patients.radiologySupportedFiles", "Supports JPG, PNG, WEBP, PDF up to {max}").replace(
                    "{max}",
                    formatFileSize(MAX_PATIENT_DOCUMENT_BYTES)
                  )}
                </p>
              </div>
            </div>
            <div className="max-w-md">
              <Input
                placeholder={t("patients.radiologyNotesPlaceholder", "Add a label/note (e.g., Panoramic, Tooth #46 PA)")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </PermissionGate>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</p>
          )}

          {loading ? (
            <PageLoadingSkeleton variant="grid3" />
          ) : images.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-neutral-50">
              <ImageIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-600">
                {t("patients.radiologyEmpty", "No radiology images uploaded yet.")}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {t(
                  "patients.radiologyEmptyHint",
                  "Upload panoramic or periapical X-rays to build the patient's imaging record."
                )}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {images.map((img) => {
                const isPdf = img.file_type === "application/pdf"
                return (
                  <div
                    key={img.id}
                    className="group relative border rounded-lg overflow-hidden bg-white hover:shadow-md transition-all cursor-pointer flex flex-col"
                    onClick={() => {
                      if (!isPdf && img.url) {
                        setSelectedImage(img)
                        resetFilters()
                      } else {
                        handleDownload(img)
                      }
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] bg-neutral-900 flex items-center justify-center relative overflow-hidden border-b">
                      {isPdf ? (
                        <div className="flex flex-col items-center gap-2 text-neutral-400">
                          <FileText className="h-12 w-12" />
                          <span className="text-xs font-semibold uppercase">
                            {t("patients.pdfDocument", "PDF document")}
                          </span>
                        </div>
                      ) : img.url ? (
                        // Private signed clinical images need native controls and exact source rendering.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.url}
                          alt={img.file_name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-neutral-700" />
                      )}

                      {/* Hover Overlay */}
                      {!isPdf && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" className="gap-1">
                            <Maximize2 className="h-3.5 w-3.5" />
                            {t("patients.viewXray", "View / Diagnose")}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Meta Info */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <p className="font-semibold text-neutral-800 text-sm line-clamp-1" title={img.notes || img.file_name}>
                          {img.notes || img.file_name}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {new Date(img.created_at).toLocaleDateString(dateLocale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {img.uploader_name ? ` · ${img.uploader_name}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t text-xs text-neutral-500">
                        <span>{formatFileSize(img.file_size)}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(img)
                            }}
                            title={t("patients.docDownload", "Download")}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-red-50"
                              onClick={(e) => handleDelete(img, e)}
                              title={t("patients.docDelete", "Delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {viewerOverlay}
    </div>
  )
}
