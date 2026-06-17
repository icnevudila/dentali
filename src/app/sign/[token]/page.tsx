"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ShieldCheck, PenTool, CheckCircle2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useRouteParams } from "@/hooks/use-route-params"
import {
  buildConsentSignaturePayload,
  fetchConsentBySigningToken,
  signConsentViaToken,
  type SignerRole,
} from "@/lib/patients/consent-service"
import { ConsentSignaturePad, isSignatureMeaningful } from "@/components/patients/ConsentSignaturePad"
import { ConsentDocumentContent } from "@/components/consent/ConsentDocumentContent"
import { StatusPipeline, consentPipelineSteps } from "@/components/visual/StatusPipeline"
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
import { readPortalSignReturn } from "@/lib/portal/portal-sign-return"
import { readKioskSignReturn } from "@/lib/kiosk/kiosk-sign-return"
import { useLocale } from "@/hooks/use-locale"

export default function PublicConsentSignPage() {
  const { token } = useRouteParams<{ token: string }>()
  const searchParams = useSearchParams()
  const { t } = useLocale()
  const fromChannel = searchParams?.get("from")
  const fromPortal = fromChannel === "portal"
  const fromKiosk = fromChannel === "kiosk"
  const [portalReturn, setPortalReturn] = React.useState<ReturnType<
    typeof readPortalSignReturn
  >>(null)
  const [kioskReturn, setKioskReturn] = React.useState<ReturnType<typeof readKioskSignReturn>>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [ctx, setCtx] = React.useState<Awaited<ReturnType<typeof fetchConsentBySigningToken>>["data"]>(null)
  const [isSigned, setIsSigned] = React.useState(false)
  const [signing, setSigning] = React.useState(false)
  const [signatureData, setSignatureData] = React.useState("")
  const [strokeCount, setStrokeCount] = React.useState(0)
  const [signerName, setSignerName] = React.useState("")
  const [signerRole, setSignerRole] = React.useState<SignerRole>("patient")
  const [fieldResponses, setFieldResponses] = React.useState<ConsentFieldResponses>({})

  React.useEffect(() => {
    if (fromPortal) {
      setPortalReturn(readPortalSignReturn())
    }
    if (fromKiosk) {
      setKioskReturn(readKioskSignReturn())
    }
  }, [fromPortal, fromKiosk])

  React.useEffect(() => {
    if (!token) return
    fetchConsentBySigningToken(token).then(({ data, error: err }) => {
      if (err || !data) {
        setError(err ?? "This signing link is invalid or has expired.")
        setLoading(false)
        return
      }
      setCtx(data)
      setSignerName(`${data.patient_first_name} ${data.patient_last_name}`.trim())
      setLoading(false)
    })
  }, [token])

  const fields = parseConsentFields(ctx?.fields)
  const patientName = ctx ? `${ctx.patient_first_name} ${ctx.patient_last_name}`.trim() : ""
  const variables = buildConsentVariables({
    patientName,
    patientDob: ctx?.patient_dob ?? "",
    orgName: ctx?.org_name,
    clinicName: ctx?.org_name,
  })
  const scrollResetKey = ctx
    ? `${ctx.consent_id}:${ctx.template_body.length}:${fields.length}`
    : token ?? ""
  const { scrollRef, hasReachedEnd, needsScroll, scrollProgress, handleScroll, acknowledgeRead } =
    useConsentScrollGate(scrollResetKey)
  const signatureValid = isSignatureMeaningful(signatureData, strokeCount)
  const fieldProgress = countConsentFieldProgress(fields, fieldResponses)
  const signingStep = !hasReachedEnd
    ? "read"
    : fieldProgress.required > 0 && fieldProgress.completed < fieldProgress.required
      ? "complete"
      : "sign"

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !ctx || !signatureData || !signerName.trim() || !signatureValid) return

    const validationError = validateConsentResponses(fields, fieldResponses)
    if (validationError) {
      setError(validationError)
      return
    }

    setSigning(true)
    setError(null)

    const bodySnapshot = buildConsentBodySnapshot({
      body: ctx.template_body,
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

    const { error: signError } = await signConsentViaToken({
      token,
      signatureData: payload,
      fieldResponses,
      bodySnapshot,
    })

    setSigning(false)
    if (signError) {
      setError(signError)
      return
    }
    setIsSigned(true)
  }

  if (loading) {
    return (
      <div className="px-4 py-8 sm:py-10">
        <PageLoadingSkeleton variant="consent" className="max-w-2xl mx-auto" />
      </div>
    )
  }

  if (error && !ctx) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <Card className="max-w-md w-full border-neutral-200">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-sm text-neutral-700">{error}</p>
            <p className="text-xs text-neutral-500">Ask the front desk for a new signing link.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!ctx) return null

  return (
    <div className="px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-neutral-950">{ctx.template_name}</h1>
          <p className="text-sm text-neutral-500">{ctx.org_name}</p>
          <StatusPipeline steps={consentPipelineSteps("pending")} className="max-w-xs mx-auto pt-2" />
        </div>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</p>
        ) : null}

        {isSigned ? (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="font-medium text-emerald-900">
                {t("consent.signSuccessTitle", "Thank you — your consent has been recorded.")}
              </p>
              {portalReturn ? (
                <>
                  <p className="text-sm text-emerald-800">
                    {t(
                      "consent.signSuccessPortalHint",
                      "You can return to your visit page to see updated status."
                    )}
                  </p>
                  <Button asChild className="mt-1">
                    <Link
                      href={`/portal?token=${encodeURIComponent(portalReturn.portalToken)}&resume=status`}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t("consent.backToMyVisit", "Back to My visit")}
                    </Link>
                  </Button>
                </>
              ) : kioskReturn ? (
                <>
                  <p className="text-sm text-emerald-800">
                    {t(
                      "consent.signSuccessKioskHint",
                      "Return to the kiosk to finish check-in."
                    )}
                  </p>
                  <Button asChild className="mt-1">
                    <Link
                      href={`/kiosk?token=${encodeURIComponent(kioskReturn.kioskToken)}&resume=consents`}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t("consent.backToKiosk", "Back to check-in")}
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-emerald-800">
                  {t(
                    "consent.signSuccessCloseHint",
                    "You may close this page or return to the front desk."
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="border-b border-neutral-100 bg-neutral-50/80">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary-600" />
                {ctx.template_name}
              </CardTitle>
              <CardDescription>Please read, complete any fields, and sign below.</CardDescription>
              <ConsentSigningSteps active={signingStep} className="pt-3" />
            </CardHeader>

            <CardContent className="p-0">
              <div
                ref={scrollRef}
                className="relative max-h-[50vh] min-h-0 overflow-y-auto p-6 space-y-4 border-b border-neutral-100 consent-document-scroll"
                onScroll={handleScroll}
              >
                <ConsentScrollProgress progress={scrollProgress} visible={needsScroll && !hasReachedEnd} />
                <ConsentDocumentContent
                  body={interpolateConsentBody(ctx.template_body, variables)}
                  fields={fields}
                  values={fieldResponses}
                  onChange={setFieldResponses}
                  disabled={signing}
                  title={ctx.template_name}
                  orgName={ctx.org_name}
                  patientName={patientName}
                  patientDob={ctx.patient_dob ?? undefined}
                  version={ctx.template_version}
                />
                <p className="text-center italic text-neutral-400 pt-4">— End of document —</p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col items-stretch p-6 gap-4 bg-neutral-50/80">
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
                  <label className="text-sm font-medium text-neutral-700 block">
                    Signer role
                    <select
                      value={signerRole}
                      onChange={(e) => setSignerRole(e.target.value as SignerRole)}
                      className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                      disabled={signing}
                    >
                      <option value="patient">Patient</option>
                      <option value="guardian">Parent / guardian</option>
                    </select>
                  </label>

                  <ConsentSignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                    onStrokeCountChange={setStrokeCount}
                    disabled={signing}
                  />

                  <div className="p-4 border border-neutral-300 rounded-md bg-white">
                    <p className="text-sm font-medium mb-2">Printed name</p>
                    <div className="flex items-center gap-2 border border-dashed border-neutral-300 rounded p-3 bg-neutral-50">
                      <PenTool className="h-5 w-5 text-neutral-400" />
                      <input
                        type="text"
                        required
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" required className="rounded text-primary-600" />
                    I have read and understood this document and consent to the terms.
                  </label>

                  <Button type="submit" className="w-full" disabled={signing || !signatureValid}>
                    {signing ? "Signing…" : "Sign & submit"}
                  </Button>
                </form>
              </ConsentScrollGate>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
