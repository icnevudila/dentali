"use client"

import * as React from "react"
import Link from "next/link"
import { Link2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RecordRow } from "@/components/layout/RecordRow"
import {
  createConsentSigningToken,
  type PatientConsent,
} from "@/lib/patients/consent-service"
import { isCheckInRequiredConsentSlug, sortPatientConsentsForDisplay } from "@/lib/patients/checkin-consent"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"

export function ConsentRecordList({
  consents,
  patientId,
}: {
  consents: PatientConsent[]
  patientId: string
}) {
  const [linkLoading, setLinkLoading] = React.useState<string | null>(null)
  const [linkCopied, setLinkCopied] = React.useState<string | null>(null)
  const [linkError, setLinkError] = React.useState<string | null>(null)

  const copyPatientLink = async (consent: PatientConsent) => {
    setLinkLoading(consent.id)
    setLinkError(null)
    const { token, error } = await createConsentSigningToken({ consentId: consent.id, channel: "qr" })
    setLinkLoading(null)
    if (error || !token) {
      setLinkError(error ?? "Could not create link")
      return
    }
    const url = `${window.location.origin}/sign/${token}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(consent.id)
    setTimeout(() => setLinkCopied(null), 2500)
  }

  const sortedConsents = React.useMemo(
    () => sortPatientConsentsForDisplay(consents),
    [consents]
  )

  if (consents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center text-sm text-neutral-500">
        No consent records yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {linkError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{linkError}</p>
      ) : null}
      {sortedConsents.map((c) => (
        <RecordRow
          key={c.id}
          href={c.status === "signed" ? `/patients/${patientId}/consents/${c.template_slug}/view` : undefined}
          leading={<ShieldCheck className="h-5 w-5" />}
          avatarClassName="bg-primary-50"
          primary={
            <span className="inline-flex flex-wrap items-center gap-2">
              {c.template_name}
              {isCheckInRequiredConsentSlug(c.template_slug) && c.status === "pending" ? (
                <Badge variant="warning" className="text-[10px]">
                  Required
                </Badge>
              ) : null}
            </span>
          }
          secondary={
            c.signed_at
              ? `Signed ${new Date(c.signed_at).toLocaleDateString("en-PH")}`
              : "Awaiting patient or staff signature"
          }
          meta={
            <Badge variant={c.status === "signed" ? "success" : c.status === "pending" ? "warning" : "default"}>
              {c.status}
            </Badge>
          }
          trailing={
            c.status === "pending" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={linkLoading === c.id}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void copyPatientLink(c)
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {linkCopied === c.id ? "Copied!" : "Patient link"}
                </Button>
                <Button size="sm" asChild onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/patients/${patientId}/consents/${c.template_slug}`}
                    transitionTypes={NAV_FORWARD_TRANSITION}
                  >
                    Sign
                  </Link>
                </Button>
              </div>
            ) : null
          }
        />
      ))}
    </div>
  )
}
