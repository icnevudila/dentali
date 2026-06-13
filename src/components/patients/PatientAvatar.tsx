"use client"

import * as React from "react"
import Image from "next/image"
import { Camera, Loader2 } from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  fetchPatientProfilePhotoUrl,
  uploadPatientProfilePhoto,
} from "@/lib/patients/patient-documents-service"
import { cn } from "@/lib/utils"

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp"

export function PatientAvatar({
  patientId,
  initials,
  size = "lg",
  editable = false,
  className,
}: {
  patientId: string
  initials: string
  size?: "md" | "lg"
  editable?: boolean
  className?: string
}) {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const dim = size === "lg" ? "h-16 w-16 text-2xl" : "h-12 w-12 text-lg"

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPatientProfilePhotoUrl(patientId).then(({ url, error: err }) => {
      if (cancelled) return
      setPhotoUrl(url)
      if (err) setError(err)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const handleFile = async (file: File | undefined) => {
    if (!file || !user || !activeBranch) return
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG, or WebP image.")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Image must be 2MB or smaller.")
      return
    }
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      return
    }

    setUploading(true)
    setError(null)
    const { url, error: uploadError } = await uploadPatientProfilePhoto({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      file,
    })
    setUploading(false)
    if (uploadError) setError(uploadError)
    else setPhotoUrl(url)
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        disabled={!editable || uploading}
        onClick={() => editable && inputRef.current?.click()}
        className={cn(
          "relative flex items-center justify-center rounded-full overflow-hidden font-bold",
          "bg-primary-100 text-primary-700",
          editable && "group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
          !editable && "cursor-default",
          dim
        )}
        aria-label={editable ? "Upload patient photo" : "Patient photo"}
      >
        {loading || uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        ) : photoUrl ? (
          <Image src={photoUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
        ) : (
          initials
        )}
        {editable && !loading && !uploading ? (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        ) : null}
      </button>
      {editable ? (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      ) : null}
      {error ? <p className="absolute -bottom-6 left-0 text-[10px] text-red-600 whitespace-nowrap">{error}</p> : null}
    </div>
  )
}
