"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, PenTool, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  buildConsentSignaturePayload,
  ensurePatientConsent,
  fetchConsentTemplate,
  fetchPatientConsentDetail,
  signPatientConsent,
  uploadSignedConsentExport,
  createConsentSigningToken,
  type SignerRole,
} from "@/lib/patients/consent-service"
import { buildSignedConsentHtml } from "@/lib/patients/consent-pdf"
import { getPatient } from "@/lib/patients/patient-service"
import { ConsentSignaturePad, isSignatureMeaningful } from "@/components/patients/ConsentSignaturePad"
import { ConsentDocumentContent } from "@/components/consent/ConsentDocumentContent"
import { StatusPipeline, consentPipelineSteps } from "@/components/visual/StatusPipeline"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import {
  parseConsentFields,
  validateConsentResponses,
  countConsentFieldProgress,
  type ConsentFieldResponses,
} from "@/lib/consent/consent-field-types"
import {
  buildConsentBodySnapshot,
  buildConsentVariables,
  interpolateConsentBody,
} from "@/lib/consent/consent-template-render"
import { ConsentScrollGate } from "@/components/consent/ConsentScrollGate"
import { ConsentScrollProgress } from "@/components/consent/ConsentScrollProgress"
import { ConsentSigningSteps } from "@/components/consent/ConsentSigningSteps"
import { ConsentFieldProgress } from "@/components/consent/ConsentFieldProgress"
import { useConsentScrollGate } from "@/hooks/use-consent-scroll-gate"
import { MERGED_CONSENT_SLUG_ALIASES } from "@/lib/patients/checkin-consent"
import { queueResumeHref, loadPendingQueueCheckIn } from "@/lib/queue/queue-check-in-return"
import { broadcastQueueConsentSigned } from "@/lib/queue/queue-consent-channel"

export default function ConsentFormPage() {
  return (
    <React.Suspense fallback={<PageLoadingSkeleton variant="consent" className="max-w-3xl px-4 py-8" />}>
      <ConsentFormPageContent />
    </React.Suspense>
  )
}

function ConsentFormPageContent() {
  const { id: patientId, formId } = useRouteParams<{ id: string; formId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")
  const isQueuePopup = returnTo === "queue" && searchParams.get("popup") === "1"
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { t } = useLocale()

  const [templateName, setTemplateName] = React.useState("")
  const [templateBody, setTemplateBody] = React.useState("")
  const [templateFields, setTemplateFields] = React.useState<unknown>([])
  const [templateVersion, setTemplateVersion] = React.useState("1.0")
  const [orgName, setOrgName] = React.useState("")
  const [patientName, setPatientName] = React.useState("")
  const [consentId, setConsentId] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [isSigned, setIsSigned] = React.useState(false)
  const [signing, setSigning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [signatureData, setSignatureData] = React.useState("")
  const [strokeCount, setStrokeCount] = React.useState(0)
  const [signerName, setSignerName] = React.useState("")
  const [signerRole, setSignerRole] = React.useState<SignerRole>("patient")
  const [fieldResponses, setFieldResponses] = React.useState<ConsentFieldResponses>({})
  const [patientDob, setPatientDob] = React.useState("")
  const [linkCopied, setLinkCopied] = React.useState(false)
  const [loadKey, setLoadKey] = React.useState(0)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setLoadKey((k) => k + 1)
  }, [])

  React.useEffect(() => {
    const aliasTarget = MERGED_CONSENT_SLUG_ALIASES[formId]
    if (aliasTarget) {
      const qs = searchParams.toString()
      router.replace(
        `/patients/${patientId}/consents/${aliasTarget}${qs ? `?${qs}` : ""}`
      )
      return
    }

    const slug = formId
    Promise.all([
      fetchConsentTemplate(slug),
      fetchOrganization(),
      fetchPatientConsentDetail(patientId, slug),
      getPatient(patientId),
    ]).then(async ([templateResult, org, existingConsent, patientResult]) => {
      if (templateResult.error || !templateResult.data) {
        setError(templateResult.error ?? t("consent.formNotFound", "Form not found"))
        setLoading(false)
        return
      }

      if (existingConsent.data?.status === "signed") {
        router.replace(`/patients/${patientId}/consents/${slug}/view`)
        return
      }

      setTemplateName(templateResult.data.name)
      setTemplateBody(templateResult.data.body)
      setTemplateFields(templateResult.data.fields ?? [])
      setTemplateVersion(templateResult.data.version)
      if (org) setOrgName(org.name)
      if (patientResult.data) {
        const fullName = `${patientResult.data.first_name} ${patientResult.data.last_name}`
        setPatientName(fullName)
        setSignerName(fullName)
        setPatientDob(patientResult.data.date_of_birth ?? "")
      }

      if (org && user) {
        const ensured = await ensurePatientConsent({
          patientId,
          organizationId: org.id,
          branchId: activeBranch?.id ?? null,
          template: templateResult.data,
        })
        if (ensured.error) setError(ensured.error)
        else setConsentId(ensured.consentId)
      }
      setLoading(false)
    })
  }, [patientId, formId, user, activeBranch?.id, router, searchParams, t, loadKey])

  const fields = parseConsentFields(templateFields)
  const variables = buildConsentVariables({
    patientName,
    patientDob,
    orgName: orgName,
    clinicName: activeBranch?.name?.trim() || orgName,
    branchName: activeBranch?.name ?? "",
  })
  const displayBody = interpolateConsentBody(templateBody, variables)

  const scrollResetKey = `${loadKey}:${templateBody.length}:${String(templateFields).length}`
  const { scrollRef, hasReachedEnd, needsScroll, scrollProgress, handleScroll, acknowledgeRead } =
    useConsentScrollGate(scrollResetKey)

  const fieldProgress = countConsentFieldProgress(fields, fieldResponses)
  const signingStep = !hasReachedEnd
    ? "read"
    : fieldProgress.required > 0 && fieldProgress.completed < fieldProgress.required
      ? "complete"
      : "sign"

  const signatureValid = isSignatureMeaningful(signatureData, strokeCount)

  const copyPatientLink = async () => {
    if (!consentId) return
    const { token, error: linkErr } = await createConsentSigningToken({ consentId, channel: "qr" })
    if (linkErr || !token) {
      setError(linkErr ?? "Could not create link")
      return
    }
    await navigator.clipboard.writeText(`${window.location.origin}/sign/${token}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !consentId || !signatureData || !signerName.trim() || !signatureValid) return

    const validationError = validateConsentResponses(fields, fieldResponses)
    if (validationError) {
      setError(validationError)
      return
    }

    setSigning(true)
    setError(null)

    const bodySnapshot = buildConsentBodySnapshot({
      body: templateBody,
      variables,
      fields,
      responses: fieldResponses,
    })

    const payload = buildConsentSignaturePayload({
      name: signerName.trim(),
      image: signatureData,
      signerRole,
      strokeCount,
    })
    const { error: signError } = await signPatientConsent({
      consentId,
      userId: user.id,
      signatureData: payload,
      fieldResponses,
      bodySnapshot,
    })

    if (signError) {
      setSigning(false)
      setError(signError)
      return
    }

    const org = await fetchOrganization()
    if (org) {
      const html = buildSignedConsentHtml({
        orgName: orgName || org.name,
        patientName: patientName || "Patient",
        patientId,
        templateName,
        templateBody: bodySnapshot || displayBody,
        templateVersion,
        signatureData: payload,
        signedAt: new Date().toISOString(),
        signerRole,
        fields,
        fieldResponses,
      })
      const { error: storeError } = await uploadSignedConsentExport({
        organizationId: org.id,
        patientId,
        consentId,
        templateSlug: formId,
        html,
      })
      if (storeError) {
        console.warn("Consent signed but export storage failed:", storeError)
      }
    }

    setSigning(false)
    setIsSigned(true)
    setTimeout(() => {
      if (returnTo === "queue") {
        broadcastQueueConsentSigned(patientId, formId)
        if (isQueuePopup) {
          window.setTimeout(() => {
            window.close()
          }, 2800)
          return
        }
        const pending = loadPendingQueueCheckIn()
        window.location.assign(queueResumeHref(pending))
        return
      }
      if (returnTo === "ortho") {
        router.push(`/patients/${patientId}/ortho`)
        return
      }
      if (returnTo === "patient") {
        router.push(`/patients/${patientId}`)
        return
      }
      router.push(`/patients/${patientId}/consents/${formId}/view`)
    }, isQueuePopup ? 2200 : 1200)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="consent" className="max-w-3xl px-4 py-8" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.CONSENTS_MANAGE}>
      <PatientPageShell
        patientId={patientId}
        section="Consent"
        title={templateName || t("consent.form", "Consent form")}
        description={patientName ? `${patientName} · v${templateVersion}` : undefined}
        maxWidth="max-w-3xl"
        panel={false}
        error={error}
        onRetry={reload}
        retryLabel={t("common.retry", "Retry")}
        badges={<StatusPipeline steps={consentPipelineSteps("pending")} className="max-w-xs" />}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => void copyPatientLink()}
            disabled={!consentId}
          >
            <Link2 className="h-3.5 w-3.5" />
            {linkCopied ? t("consent.linkCopied", "Link copied") : t("consent.patientLink", "Patient link")}
          </Button>
        }
      >
        <Card className="flex flex-col">
          <CardHeader className="shrink-0 border-b border-neutral-100 bg-neutral-50 rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-600" />
              {templateName}
            </CardTitle>
            <CardDescription>{t("consent.readBeforeSign", "Please read carefully before signing.")}</CardDescription>
            <ConsentSigningSteps active={signingStep} className="pt-3" />
          </CardHeader>

          <CardContent
            ref={scrollRef}
            className="relative overflow-y-auto p-6 space-y-4 text-sm text-neutral-700 leading-relaxed consent-document-scroll h-[50vh] min-h-[350px]"
            onScroll={handleScroll}
          >
            <ConsentScrollProgress progress={scrollProgress} visible={needsScroll && !hasReachedEnd} />
            <ConsentDocumentContent
              body={displayBody}
              fields={fields}
              values={fieldResponses}
              onChange={setFieldResponses}
              disabled={signing || isSigned}
              title={templateName}
              orgName={orgName}
              branchName={activeBranch?.name}
              patientName={patientName}
              patientDob={patientDob}
              version={templateVersion}
            />
            <p className="text-center italic text-neutral-400 pt-8">
              — {t("consent.endOfDocument", "End of Document")} —
            </p>
          </CardContent>

          <CardFooter className="flex shrink-0 flex-col items-stretch border-t border-neutral-200 bg-neutral-50 rounded-b-xl p-6 gap-4">
            {isSigned ? (
              <div className="space-y-3">
                <div className="bg-success-50 border border-success-200 text-success-800 p-4 rounded-md text-center font-medium">
                  {isQueuePopup
                    ? t("consent.signedQueuePopupTitle", "Consent signed — return to the queue screen.")
                    : t("consent.signedRedirecting", "Document signed successfully! Redirecting…")}
                </div>
                {isQueuePopup ? (
                  <p className="text-center text-sm text-success-800/90">
                    {t(
                      "consent.signedQueuePopupHint",
                      "Return to the queue tab — the patient will be checked in to Waiting automatically."
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <ConsentScrollGate
                hasReachedEnd={hasReachedEnd}
                needsScroll={needsScroll}
                onAcknowledge={acknowledgeRead}
              >
                <form onSubmit={handleSign} className="space-y-4">
                {fieldProgress.required > 0 ? (
                  <ConsentFieldProgress
                    completed={fieldProgress.completed}
                    required={fieldProgress.required}
                  />
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm font-medium text-neutral-700">
                    {t("consent.signerRole", "Signer role")}
                    <select
                      value={signerRole}
                      onChange={(e) => setSignerRole(e.target.value as SignerRole)}
                      className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                      disabled={signing}
                    >
                      <option value="patient">{t("consent.rolePatient", "Patient")}</option>
                      <option value="guardian">{t("consent.roleGuardian", "Parent / guardian")}</option>
                    </select>
                  </label>
                </div>

                <ConsentSignaturePad
                  value={signatureData}
                  onChange={setSignatureData}
                  onStrokeCountChange={setStrokeCount}
                  disabled={signing}
                />

                <div className="p-4 border border-neutral-300 rounded-md bg-white">
                  <p className="text-sm font-medium mb-2">{t("consent.printedName", "Printed name")}</p>
                  <div className="flex items-center gap-2 border border-dashed border-neutral-300 rounded p-3 bg-neutral-50">
                    <PenTool className="h-5 w-5 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder={t("consent.printedNamePlaceholder", "Patient or guardian full name")}
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="consent-check" required className="rounded text-primary-600" />
                  <label htmlFor="consent-check" className="text-sm text-neutral-700">
                    {t("consent.acknowledge", "I have read and understood this document and consent to the terms.")}
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button type="submit" disabled={signing || !signatureData || !signatureValid}>
                    {signing ? t("consent.signing", "Signing…") : t("consent.signAndSave", "Sign & Save")}
                  </Button>
                </div>
              </form>
              </ConsentScrollGate>
            )}
          </CardFooter>
        </Card>
      </PatientPageShell>
    </PermissionGate>
  )
}
