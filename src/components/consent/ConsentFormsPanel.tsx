"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardPen,
  ExternalLink,
  FileText,
  Link2,
  PenLine,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  createConsentSigningToken,
  ensurePatientConsent,
  fetchConsentCatalog,
  type ConsentCatalogItem,
  type PatientConsent,
} from "@/lib/patients/consent-service"
import { useBranch } from "@/hooks/use-branch"
import { cn } from "@/lib/utils"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

type FormStatus = "not_started" | "pending" | "signed" | "voided"

function resolveFormStatus(slug: string, consents: PatientConsent[]): FormStatus {
  const record = consents.find((c) => c.template_slug === slug)
  if (!record) return "not_started"
  if (record.status === "signed") return "signed"
  if (record.status === "voided") return "voided"
  return "pending"
}

const STATUS_BADGE: Record<FormStatus, { label: string; variant: "default" | "success" | "warning" }> = {
  not_started: { label: "Not started", variant: "default" },
  pending: { label: "Awaiting signature", variant: "warning" },
  signed: { label: "Signed", variant: "success" },
  voided: { label: "Voided", variant: "default" },
}

export function ConsentFormsPanel({
  patientId,
  consents,
  onConsentsChange,
}: {
  patientId: string
  consents: PatientConsent[]
  onConsentsChange?: () => void
}) {
  const router = useRouter()
  const { activeBranch } = useBranch()
  const [catalog, setCatalog] = React.useState<ConsentCatalogItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busySlug, setBusySlug] = React.useState<string | null>(null)
  const [linkCopiedSlug, setLinkCopiedSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchConsentCatalog().then(({ data, error: err }) => {
      setCatalog(data)
      setError(err)
      setLoading(false)
    })
  }, [])

  const ensureAndGetConsentId = async (template: ConsentCatalogItem): Promise<string | null> => {
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      return null
    }
    const { consentId, error: ensureErr } = await ensurePatientConsent({
      patientId,
      organizationId: org.id,
      branchId: activeBranch?.id ?? null,
      template,
    })
    if (ensureErr) {
      setError(ensureErr)
      return null
    }
    onConsentsChange?.()
    return consentId
  }

  const handleFillNow = async (template: ConsentCatalogItem) => {
    setBusySlug(template.slug)
    setError(null)
    const consentId = await ensureAndGetConsentId(template)
    setBusySlug(null)
    if (!consentId) return
    router.push(`/patients/${patientId}/consents/${template.slug}`)
  }

  const handlePatientLink = async (template: ConsentCatalogItem) => {
    setBusySlug(template.slug)
    setError(null)
    const consentId = await ensureAndGetConsentId(template)
    if (!consentId) {
      setBusySlug(null)
      return
    }
    const { token, error: linkErr } = await createConsentSigningToken({
      consentId,
      channel: "qr",
    })
    setBusySlug(null)
    if (linkErr || !token) {
      setError(linkErr ?? "Could not create patient link")
      return
    }
    const url = `${window.location.origin}/sign/${token}`
    await navigator.clipboard.writeText(url)
    setLinkCopiedSlug(template.slug)
    toast.success("Link copied! You can send it via WhatsApp or SMS.")
    setTimeout(() => setLinkCopiedSlug(null), 2500)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="cards" />
  }

  if (error && catalog.length === 0) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
        {error}
      </p>
    )
  }

  const signedCount = catalog.filter((t) => resolveFormStatus(t.slug, consents) === "signed").length
  const pendingCount = catalog.filter((t) => {
    const s = resolveFormStatus(t.slug, consents)
    return s === "pending" || s === "not_started"
  }).length

  return (
    <div className="space-y-6">
      {catalog.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-center shadow-sm">
            <p className="text-lg font-semibold tabular-nums text-neutral-950">{catalog.length}</p>
            <p className="text-[11px] text-neutral-500">Forms</p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-3 py-3 text-center shadow-sm">
            <p className="text-lg font-semibold tabular-nums text-emerald-800">{signedCount}</p>
            <p className="text-[11px] text-emerald-700">Signed</p>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-3 py-3 text-center shadow-sm">
            <p className="text-lg font-semibold tabular-nums text-amber-900">{pendingCount}</p>
            <p className="text-[11px] text-amber-800">To complete</p>
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-primary-100 bg-primary-50/40 px-4 py-3 text-sm text-neutral-700">
        <p className="font-medium text-neutral-900 flex items-center gap-2">
          <ClipboardPen className="h-4 w-4 text-primary-600" />
          Two ways to complete a form
        </p>
        <ul className="mt-2 space-y-1 text-neutral-600 list-disc list-inside">
          <li>
            <strong className="text-neutral-800">Fill now</strong> — staff completes and signs at the
            front desk or in the operatory
          </li>
          <li>
            <strong className="text-neutral-800">Patient link</strong> — send a link; the patient fills
            and signs on their phone
          </li>
        </ul>
      </div>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((template) => {
          const status = resolveFormStatus(template.slug, consents)
          const badge = STATUS_BADGE[status]
          const isBusy = busySlug === template.slug

          return (
            <article
              key={template.slug}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
                status === "signed" && "border-emerald-200/90",
                status === "pending" && "border-amber-200/70",
                status === "not_started" && "border-neutral-200",
                status === "voided" && "border-neutral-200"
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-0.5",
                  status === "signed" && "bg-emerald-500",
                  status === "pending" && "bg-amber-400",
                  status === "not_started" && "bg-neutral-200",
                  status === "voided" && "bg-neutral-300"
                )}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-900 leading-snug">
                      {template.name}
                    </h3>
                    {template.description ? (
                      <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                        {template.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                  {badge.label}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {template.source_asset ? (
                  <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                    {template.source_asset}
                  </span>
                ) : null}
                {template.is_default ? (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    Auto on intake
                  </span>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {status === "signed" ? (
                  <Button size="sm" variant="outline" className="gap-1 w-full" asChild>
                    <Link
                      href={`/patients/${patientId}/consents/${template.slug}/view`}
                      transitionTypes={NAV_FORWARD_TRANSITION}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      View & export (PDF / Word)
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="gap-1 flex-1"
                      disabled={isBusy}
                      onClick={() => void handleFillNow(template)}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Fill now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 flex-1"
                      disabled={isBusy}
                      onClick={() => void handlePatientLink(template)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {linkCopiedSlug === template.slug ? "Copied!" : "Patient link"}
                    </Button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {consents.filter((c) => c.status === "pending").length > 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            Pending signatures
          </p>
          <ul className="space-y-2">
            {consents
              .filter((c) => c.status === "pending")
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-sm text-neutral-700"
                >
                  <span>{c.template_name}</span>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" asChild>
                    <Link
                      href={`/patients/${patientId}/consents/${c.template_slug}`}
                      transitionTypes={NAV_FORWARD_TRANSITION}
                    >
                      Continue
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
