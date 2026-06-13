"use client"

import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ConsentDocumentContent } from "@/components/consent/ConsentDocumentContent"
import { ConsentResponsesSummary } from "@/components/consent/ConsentFormRenderer"
import type { ConsentField, ConsentFieldResponses } from "@/lib/consent/consent-field-types"
import {
  buildConsentVariables,
  interpolateConsentBody,
  interpolateConsentFields,
} from "@/lib/consent/consent-template-render"
import { cn } from "@/lib/utils"

export function ConsentSignedDocument({
  orgName,
  branchName,
  patientName,
  patientDob,
  patientId,
  templateName,
  templateBody,
  templateVersion,
  bodySnapshot,
  fields,
  fieldResponses,
  signerName,
  signerRole,
  imageDataUrl,
  signedDateLabel,
  capturedAt,
  signedAt,
  className,
  id = "consent-print-document",
}: {
  orgName: string
  branchName?: string
  patientName: string
  patientDob?: string
  patientId: string
  templateName: string
  templateBody: string
  templateVersion: string
  bodySnapshot: string | null
  fields: ConsentField[]
  fieldResponses: ConsentFieldResponses
  signerName: string
  signerRole?: string | null
  imageDataUrl?: string | null
  signedDateLabel: string
  capturedAt?: string | null
  signedAt?: string | null
  className?: string
  id?: string
}) {
  const variables = buildConsentVariables({
    patientName,
    patientDob,
    orgName,
    clinicName: branchName?.trim() || orgName,
    branchName,
  })

  const hasStructuredFields = fields.length > 0
  const hasParagraphSections = fields.some((f) => f.type === "paragraph")
  const interpolatedFields = interpolateConsentFields(fields, variables)
  const narrativeFromTemplate = interpolateConsentBody(templateBody, variables)

  const useStructuredLayout = hasStructuredFields && (hasParagraphSections || Object.keys(fieldResponses).length > 0)

  const legacyBody = bodySnapshot || narrativeFromTemplate

  return (
    <div
      id={id}
      className={cn(
        "bg-white border border-neutral-200 rounded-xl shadow-sm print:shadow-none print:border-0 print:rounded-none",
        className
      )}
    >
      <div className="border-b border-neutral-200 px-8 py-6 print:px-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {branchName?.trim() || orgName}
            </p>
            {branchName?.trim() && orgName && branchName !== orgName ? (
              <p className="text-[11px] text-neutral-500 mt-0.5">{orgName}</p>
            ) : null}
            <h2 className="text-lg font-bold text-neutral-900 mt-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-600 print:hidden" />
              {templateName}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">Patient: {patientName}</p>
            <p className="text-xs text-neutral-500">
              Reference: {patientId.slice(0, 8)} · v{templateVersion}
            </p>
          </div>
          <Badge variant="success" className="print:border print:border-green-700 print:text-green-800">
            Signed
          </Badge>
        </div>
      </div>

      <div className="px-8 py-6 print:px-0">
        {useStructuredLayout ? (
          <ConsentDocumentContent
            body={narrativeFromTemplate}
            fields={interpolatedFields}
            values={fieldResponses}
            readOnly
            showHeader={false}
            orgName={orgName}
            branchName={branchName}
            patientName={patientName}
            patientDob={patientDob}
            version={templateVersion}
          />
        ) : (
          <>
            <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{legacyBody}</div>
            {fields.length > 0 && Object.keys(fieldResponses).length > 0 ? (
              <div className="mt-6">
                <ConsentResponsesSummary fields={fields} responses={fieldResponses} />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-neutral-200 px-8 py-6 bg-neutral-50 rounded-b-xl print:bg-white print:px-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Electronic Signature
        </p>
        <p className="font-serif text-2xl text-neutral-900 italic border-b border-neutral-300 pb-2 inline-block min-w-[200px]">
          {signerName}
        </p>
        {signerRole ? (
          <p className="text-xs text-neutral-500 mt-1 capitalize">
            Signer: {signerRole === "guardian" ? "Parent / guardian" : "Patient"}
          </p>
        ) : null}
        {imageDataUrl ? (
          <img
            src={imageDataUrl}
            alt="Signature"
            className="mt-3 max-h-24 border border-neutral-200 rounded bg-white"
          />
        ) : null}
        <p className="text-sm text-neutral-600 mt-3">Signed on {signedDateLabel}</p>
        {capturedAt && signedAt && capturedAt !== signedAt ? (
          <p className="text-xs text-neutral-500">
            Captured at device: {new Date(capturedAt).toLocaleString("en-PH")}
          </p>
        ) : null}
      </div>
    </div>
  )
}
