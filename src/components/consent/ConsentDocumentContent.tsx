"use client"

import { ConsentDocumentHeader } from "@/components/consent/ConsentDocumentHeader"
import { ConsentFormRenderer } from "@/components/consent/ConsentFormRenderer"
import type { ConsentField, ConsentFieldResponses } from "@/lib/consent/consent-field-types"
import {
  interpolateConsentFields,
  type ConsentTemplateVariables,
} from "@/lib/consent/consent-template-render"
import { cn } from "@/lib/utils"

/**
 * Paper-style consent: narrative header + structured fields in document flow.
 */
export function ConsentDocumentContent({
  body,
  fields,
  values,
  onChange,
  disabled,
  readOnly,
  className,
  title,
  orgName,
  branchName,
  patientName,
  patientDob,
  version,
  showHeader = true,
}: {
  body: string
  fields: ConsentField[]
  values: ConsentFieldResponses
  onChange?: (next: ConsentFieldResponses) => void
  disabled?: boolean
  readOnly?: boolean
  className?: string
  title?: string
  orgName?: string
  branchName?: string
  patientName?: string
  patientDob?: string
  version?: string
  showHeader?: boolean
}) {
  const trimmedBody = body.trim()
  const hasStructuredFields = fields.length > 0
  const hasParagraphSections = fields.some((f) => f.type === "paragraph")
  const resolvedFields = hasStructuredFields
    ? interpolateConsentFields(fields, {
        patient_name: patientName ?? "",
        patient_dob: patientDob ?? "",
        clinic_name: branchName?.trim() || orgName?.trim() || "",
        org_name: orgName ?? "",
        branch_name: branchName ?? "",
        today_date: new Date().toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      } satisfies ConsentTemplateVariables)
    : fields

  if (!hasStructuredFields) {
    return (
      <div className={cn("space-y-4", className)}>
        {showHeader && title ? (
          <ConsentDocumentHeader
            title={title}
            orgName={orgName}
            branchName={branchName}
            patientName={patientName}
            patientDob={patientDob}
            version={version}
          />
        ) : null}
        <div className="whitespace-pre-wrap text-sm text-neutral-700 leading-relaxed rounded-lg border border-neutral-200 bg-white px-4 py-4">
          {trimmedBody || (
            <p className="text-neutral-500 italic">No document text configured for this form.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showHeader && title ? (
        <ConsentDocumentHeader
          title={title}
          orgName={orgName}
          branchName={branchName}
          patientName={patientName}
          patientDob={patientDob}
          version={version}
        />
      ) : null}

      {trimmedBody && !hasParagraphSections ? (
        <div className="rounded-lg border border-neutral-200/90 bg-white px-4 py-4 text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          {body}
        </div>
      ) : null}

      <ConsentFormRenderer
        fields={resolvedFields}
        values={values}
        onChange={onChange ?? (() => {})}
        disabled={disabled}
        readOnly={readOnly}
        documentMode
      />
    </div>
  )
}
