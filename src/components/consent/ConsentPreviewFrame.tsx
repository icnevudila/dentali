"use client"

import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  interpolateConsentBody,
  PREVIEW_CONSENT_VARIABLES,
} from "@/lib/consent/consent-template-render"
import type { ConsentField } from "@/lib/consent/consent-field-types"
import { ConsentFormRenderer } from "@/components/consent/ConsentFormRenderer"

type ConsentPreviewFrameProps = {
  title: string
  body: string
  version?: string
  clinicName?: string
  fields?: ConsentField[]
  className?: string
}

export function ConsentPreviewFrame({
  title,
  body,
  version,
  clinicName = PREVIEW_CONSENT_VARIABLES.clinic_name,
  fields = [],
  className,
}: ConsentPreviewFrameProps) {
  const previewBody = interpolateConsentBody(body, PREVIEW_CONSENT_VARIABLES)

  return (
    <div className={cn("rounded-xl border border-neutral-200/80 bg-neutral-50/90 p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs font-medium text-neutral-500">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-600">
            <FileText className="h-3.5 w-3.5" aria-hidden />
          </span>
          Live preview
        </span>
        {version ? (
          <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-mono text-[10px] text-neutral-500">
            v{version}
          </span>
        ) : null}
      </div>

      <div className="relative mx-auto max-w-md">
        <div
          className="absolute -right-1 -top-1 h-8 w-8 rounded-br-lg bg-neutral-200/60"
          style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
          aria-hidden
        />
        <div className="relative rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)]">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {clinicName}
          </p>
          <h3 className="mt-2 text-center text-base font-semibold text-neutral-950">
            {title || "Consent form"}
          </h3>
          <p className="mt-1 text-center text-[10px] text-neutral-400">
            {PREVIEW_CONSENT_VARIABLES.patient_name} · {PREVIEW_CONSENT_VARIABLES.today_date}
          </p>
          <div className="my-4 h-px bg-neutral-200" />
          <div className="max-h-52 overflow-y-auto text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap consent-document-scroll">
            {previewBody.trim() ? previewBody : "Form text will appear here as you type…"}
          </div>
          {fields.length > 0 ? (
            <ConsentFormRenderer
              fields={fields}
              values={{}}
              readOnly
              documentMode
              className="mt-4 border-0 bg-transparent p-0"
            />
          ) : null}
          <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 px-3 py-3">
            <p className="text-xs font-medium text-neutral-600">Patient signature</p>
            <div className="mt-2 h-11 rounded-md border border-neutral-200 bg-white" />
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-neutral-400">
              <span>Date: _______________</span>
              <span>Witness: ___________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
