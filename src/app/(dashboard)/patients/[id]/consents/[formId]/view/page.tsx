"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { notify } from "@/lib/ui/notify"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import {
  fetchConsentTemplate,
  fetchPatientConsentDetail,
  getSignedConsentExportUrl,
  parseSignatureDisplay,
  voidPatientConsent,
} from "@/lib/patients/consent-service"
import { useRouter } from "next/navigation"
import { getPatient } from "@/lib/patients/patient-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { ConsentExportActions } from "@/components/consent/ConsentExportActions"
import { ConsentSignedDocument } from "@/components/consent/ConsentSignedDocument"
import { parseConsentFields, type ConsentFieldResponses } from "@/lib/consent/consent-field-types"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { MERGED_CONSENT_SLUG_ALIASES } from "@/lib/patients/checkin-consent"

export default function ConsentViewPage() {
  const { id: patientId, formId: templateSlug } = useRouteParams<{ id: string; formId: string }>()
  const router = useRouter()
  const { activeBranch } = useBranch()
  const [consentId, setConsentId] = React.useState("")
  const [patientName, setPatientName] = React.useState("")
  const [patientDob, setPatientDob] = React.useState("")
  const [orgName, setOrgName] = React.useState("")
  const [templateName, setTemplateName] = React.useState("")
  const [templateBody, setTemplateBody] = React.useState("")
  const [templateVersion, setTemplateVersion] = React.useState("")
  const [signature, setSignature] = React.useState<string | null>(null)
  const [signedAt, setSignedAt] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string>("")
  const [storedExportUrl, setStoredExportUrl] = React.useState<string | null>(null)
  const [fieldResponses, setFieldResponses] = React.useState<ConsentFieldResponses>({})
  const [templateFields, setTemplateFields] = React.useState<unknown>([])
  const [bodySnapshot, setBodySnapshot] = React.useState<string | null>(null)
  const [voidReason, setVoidReason] = React.useState("")
  const [voiding, setVoiding] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [loadKey, setLoadKey] = React.useState(0)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setLoadKey((k) => k + 1)
  }, [])

  React.useEffect(() => {
    Promise.all([
      getPatient(patientId),
      fetchOrganization(),
      fetchConsentTemplate(templateSlug),
      fetchPatientConsentDetail(patientId, templateSlug),
    ]).then(([patientResult, org, templateResult, consentResult]) => {
      if (patientResult.data) {
        setPatientName(`${patientResult.data.first_name} ${patientResult.data.last_name}`)
        setPatientDob(patientResult.data.date_of_birth ?? "")
      }
      if (org) setOrgName(org.name)

      const consent = consentResult.data
      const template = templateResult.data

      if (template) {
        setTemplateName(template.name)
        setTemplateBody(template.body)
        setTemplateVersion(template.version)
        setTemplateFields(template.fields ?? [])
      } else if (consent) {
        setTemplateName(consent.template_name)
      }

      if ((templateResult.error || !template) && !consent?.body_snapshot) {
        setError(templateResult.error ?? "Template not found")
      }

      if (consentResult.error) setError(consentResult.error)
      else if (consent) {
        setConsentId(consent.id)
        setStatus(consent.status)
        setSignature(consent.signature_data)
        setSignedAt(consent.signed_at)
        setBodySnapshot(consent.body_snapshot)
        if (consent.field_responses) {
          setFieldResponses(consent.field_responses as ConsentFieldResponses)
        }
        if (consent.signed_pdf_path) {
          getSignedConsentExportUrl(consent.signed_pdf_path).then(({ url }) => {
            if (url) setStoredExportUrl(url)
          })
        }
        if (consent.status !== "signed") {
          const alias = MERGED_CONSENT_SLUG_ALIASES[templateSlug]
          if (alias) {
            router.replace(`/patients/${patientId}/consents/${alias}`)
            return
          }
          setError("This consent has not been signed yet.")
        }
      } else {
        setError("Consent record not found.")
      }
      setLoading(false)
    })
  }, [patientId, templateSlug, loadKey, router])

  const handleVoid = async () => {
    if (!consentId || !voidReason.trim()) return
    if (!(await notify.confirm("Void this signed consent? Patient will need to sign again."))) return
    setVoiding(true)
    setError(null)
    const { error: err } = await voidPatientConsent({ consentId, reason: voidReason.trim() })
    setVoiding(false)
    if (err) setError(err)
    else router.push(`/patients/${patientId}?tab=record`)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="consent" className="max-w-3xl px-4 py-8" />
  }

  const signedDateLabel = signedAt
    ? new Date(signedAt).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" })
    : "—"

  const { name: signerName, imageDataUrl, signerRole, capturedAt } = parseSignatureDisplay(signature)
  const displayBody = bodySnapshot || templateBody
  const fields = parseConsentFields(templateFields)

  const viewError =
    error ?? (status !== "signed" ? "This consent has not been signed yet." : null)

  return (
    <PermissionGate permission={PERMISSIONS.CONSENTS_MANAGE}>
      <PatientPageShell
        patientId={patientId}
        section="Consent"
        title="Signed consent"
        description={templateName}
        maxWidth="max-w-3xl"
        panel={false}
        error={viewError}
        onRetry={reload}
        badges={
          status === "signed" ? (
            <Badge variant="success">Signed · v{templateVersion}</Badge>
          ) : undefined
        }
        metrics={
          status === "signed" && signedAt
            ? [
                { label: "Signed on", value: signedDateLabel, variant: "success" },
                { label: "Signer", value: signerName || "—" },
                { label: "Patient", value: patientName || "—" },
              ]
            : undefined
        }
        actions={
          status === "signed" ? (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {storedExportUrl && (
                <Button variant="ghost" size="sm" className="gap-2 h-8 text-xs" asChild>
                  <a href={storedExportUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    Archived copy
                  </a>
                </Button>
              )}
              <ConsentExportActions
                payload={{
                  orgName,
                  patientName,
                  templateName,
                  templateVersion,
                  bodyText: displayBody,
                  signedAt: signedAt ?? new Date().toISOString(),
                  signerName,
                  signerRole,
                  signatureImageDataUrl: imageDataUrl,
                  fields: bodySnapshot ? undefined : fields,
                  fieldResponses: bodySnapshot ? undefined : fieldResponses,
                }}
              />
            </div>
          ) : undefined
        }
      >
        {status === "signed" ? (
        <>
        <ConsentSignedDocument
          orgName={orgName}
          branchName={activeBranch?.name}
          patientName={patientName}
          patientDob={patientDob}
          patientId={patientId}
          templateName={templateName}
          templateBody={templateBody}
          templateVersion={templateVersion}
          bodySnapshot={bodySnapshot}
          fields={fields}
          fieldResponses={fieldResponses}
          signerName={signerName}
          signerRole={signerRole}
          imageDataUrl={imageDataUrl}
          signedDateLabel={signedDateLabel}
          capturedAt={capturedAt}
          signedAt={signedAt}
        />

        <Card className="print:hidden border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900">Admin: void consent</CardTitle>
            <CardDescription>
              Org admin only. Voids this record; patient must re-sign to obtain a new agreement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding (required)"
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={voiding || !voidReason.trim()}
              onClick={handleVoid}
            >
              {voiding ? "Voiding…" : "Void consent"}
            </Button>
          </CardContent>
        </Card>
        </>
        ) : null}
      </PatientPageShell>
    </PermissionGate>
  )
}
