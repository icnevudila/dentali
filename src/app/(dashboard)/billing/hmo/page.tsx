"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { usePermission } from "@/hooks/use-permission"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  approveHmoClaim,
  fetchHmoClaims,
  fetchHmoProviders,
  markHmoClaimPaid,
  rejectHmoClaim,
  resetHmoClaimToDraft,
  submitHmoClaim,
  type HmoClaim,
} from "@/lib/billing/hmo-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Building2, Plus, RotateCcw } from "lucide-react"
import { HmoClaimDrawer } from "@/components/billing/HmoClaimDrawer"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info" | "outline"
> = {
  draft: "outline",
  submitted: "info",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  paid: "success",
}

export default function HmoClaimsPage() {
  return (
    <React.Suspense fallback={<PageLoadingSkeleton variant="list" />}>
      <HmoClaimsPageContent />
    </React.Suspense>
  )
}

function HmoClaimsPageContent() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { hasPermission } = usePermission()
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get("status")
  const canWrite = hasPermission(PERMISSIONS.HMO_WRITE)

  const [claims, setClaims] = React.useState<HmoClaim[]>([])
  const [selected, setSelected] = React.useState<HmoClaim | null>(null)
  const [providers, setProviders] = React.useState<
    Awaited<ReturnType<typeof fetchHmoProviders>>["data"]
  >([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [payRef, setPayRef] = React.useState<Record<string, string>>({})
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [submitNote, setSubmitNote] = React.useState<string | null>(null)
  const [rejectingClaimId, setRejectingClaimId] = React.useState<string | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")

  const load = React.useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)
    const org = await fetchOrganization()
    const [cRes, pRes] = await Promise.all([
      fetchHmoClaims(activeBranch.id),
      org ? fetchHmoProviders(org.id) : Promise.resolve({ data: [], error: null }),
    ])
    setClaims(cRes.data)
    setProviders(pRes.data)
    setError(cRes.error ?? pRes.error)
    setSelected((prev) => (prev ? cRes.data.find((c) => c.id === prev.id) ?? prev : null))
    setLoading(false)
  }, [activeBranch])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const runAction = async (id: string, fn: () => Promise<{ error: string | null }>) => {
    setActionId(id)
    setSubmitNote(null)
    setError(null)
    const { error: err } = await fn()
    setActionId(null)
    if (err) setError(err)
    else void load()
  }

  const handleSubmit = async (claim: HmoClaim) => {
    if (!claim.member_id?.trim()) {
      setError(t("billing.hmoMemberRequired", "Member ID is required before submit."))
      return
    }
    setActionId(claim.id)
    setSubmitNote(null)
    const { data, error: err } = await submitHmoClaim(claim.id)
    setActionId(null)
    if (err) {
      setError(err)
    } else {
      setSubmitNote(
        data?.provider_ref
          ? `${t("billing.hmoSubmitted", "Claim submitted.")} Ref: ${data.provider_ref}`
          : t("billing.hmoSubmitted", "Claim submitted.")
      )
      void load()
    }
  }

  const handleReject = async (claim: HmoClaim) => {
    if (!rejectReason.trim()) {
      setError(
        t("billing.hmoRejectReasonRequired", "Enter a rejection reason before sending back.")
      )
      return
    }
    await runAction(claim.id, () => rejectHmoClaim(claim.id, rejectReason.trim()))
    setRejectingClaimId(null)
    setRejectReason("")
  }

  const hmoStats = React.useMemo(() => {
    const draft = claims.filter((c) => c.status === "draft").length
    const pending = claims.filter((c) =>
      ["submitted", "under_review", "approved"].includes(c.status)
    ).length
    const paid = claims.filter((c) => c.status === "paid").length
    const totalAmount = claims.reduce((sum, c) => sum + c.claimed_amount, 0)
    return { draft, pending, paid, totalAmount }
  }, [claims])

  const displayedClaims = React.useMemo(() => {
    if (statusFilter === "draft") return claims.filter((c) => c.status === "draft")
    return claims
  }, [claims, statusFilter])

  const metricItems = [
    {
      label: t("billing.claims", "Claims"),
      value: loading ? "—" : String(claims.length),
      hint: activeBranch?.name ?? t("dashboard.selectBranch", "Select a branch"),
      icon: Building2,
    },
    {
      label: t("billing.hmoDraft", "Draft"),
      value: loading ? "—" : String(hmoStats.draft),
      hint: t("billing.hmoDraftHint", "Not yet submitted"),
      variant: hmoStats.draft > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("billing.hmoPending", "In progress"),
      value: loading ? "—" : String(hmoStats.pending),
      hint: t("billing.hmoPendingHint", "Submitted or under review"),
    },
    {
      label: t("billing.hmoPaid", "Paid"),
      value: loading ? "—" : String(hmoStats.paid),
      hint: loading
        ? ""
        : `₱${hmoStats.totalAmount.toLocaleString()} ${t("billing.hmoTotalClaimed", "total claimed")}`,
      variant: "success" as const,
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.HMO_READ}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("billing.eyebrow", "Billing") + " · HMO"}
        icon={Building2}
        title={t("billing.hmoTitle", "HMO Claims")}
        description={t(
          "billing.hmoSubtitle",
          "Prepare, review, and settle provider claims from one queue."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowSettingsLink />
            {canWrite ? (
              <Button className="gap-2 shadow-sm" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" /> {t("billing.newClaim", "New claim")}
              </Button>
            ) : null}
          </div>
        }
        badges={
          statusFilter === "draft" ? (
            <Badge variant="warning" className="font-normal">
              {t("billing.hmoDraftFilter", "Draft claims only")}
            </Badge>
          ) : null
        }
        metrics={metricItems}
        metricsClassName="xl:grid-cols-4"
        error={error}
        onRetry={load}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        <div className="space-y-6">
          {activeBranch ? (
            <ReportDrillLink
              title={t("hmo.reportsTitle", "HMO pipeline analytics")}
              description={t(
                "hmo.reportsDescription",
                "Claim volume and status trends are in Reports finance."
              )}
              href="/reports#finance"
              linkLabel={t("hmo.openReports", "Open HMO reports")}
            />
          ) : null}

          {submitNote ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 animate-fade-rise">
              {submitNote}
            </p>
          ) : null}

          <ContentPanel padding="lg">
            <h3 className="text-base font-semibold text-neutral-950">
              {t("billing.claims", "Claims")}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {t(
                "billing.hmoQueueHint",
                "Draft claims are prepared here, then submitted for provider review and settlement."
              )}
            </p>
            <div className="mt-4">
              {loading ? (
                <PageLoadingSkeleton variant="inline" />
              ) : displayedClaims.length === 0 ? (
                <div className="py-12 text-center">
                  <Building2 className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
                  <p className="mt-3 font-medium text-neutral-700">
                    {statusFilter === "draft"
                      ? t("billing.noHmoDraftClaims", "No draft HMO claims")
                      : t("billing.noHmoClaimsTitle", "No HMO claims yet")}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                    {statusFilter === "draft" ? (
                      <Link href="/billing/hmo" className="text-primary-600 hover:underline">
                        {t("billing.clearFilter", "Clear filter")}
                      </Link>
                    ) : (
                      t(
                        "billing.noHmoClaimsHint",
                        "Draft a claim for a patient with active HMO coverage, then submit for review."
                      )
                    )}
                  </p>
                  {canWrite ? (
                    <Button className="mt-4 gap-2" onClick={() => setDrawerOpen(true)}>
                      <Plus className="h-4 w-4" />
                      {t("billing.newClaim", "New claim")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-0 text-sm sm:min-w-[780px]">
                    <thead>
                      <tr className="border-b text-neutral-500">
                        <th className="pb-2 text-left">Claim #</th>
                        <th className="pb-2 text-left">Patient</th>
                        <th className="pb-2 text-left">Provider</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2 text-left">Status</th>
                        {canWrite ? <th className="pb-2 text-right">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {displayedClaims.map((c) => (
                        <React.Fragment key={c.id}>
                          <tr
                            className={`cursor-pointer ${
                              selected?.id === c.id ? "bg-primary-50/50" : "hover:bg-neutral-50"
                            }`}
                            onClick={() => setSelected(c)}
                          >
                            <td className="py-2 font-mono text-xs">{c.claim_number}</td>
                            <td className="py-2">
                              <Link
                                href={`/patients/${c.patient_id}`}
                                className="text-primary-600 hover:underline"
                              >
                                {c.patient_name}
                              </Link>
                            </td>
                            <td className="py-2">{c.provider_name ?? "—"}</td>
                            <td className="py-2 text-right">₱{c.claimed_amount.toLocaleString()}</td>
                            <td className="py-2">
                              <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                            </td>
                            {canWrite ? (
                              <td
                                className="space-x-1 py-2 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.status === "draft" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionId === c.id}
                                    onClick={() => handleSubmit(c)}
                                  >
                                    {t("billing.submitClaim", "Submit")}
                                  </Button>
                                ) : null}
                                {c.status === "submitted" ? (
                                  <>
                                    <Button
                                      size="sm"
                                      disabled={actionId === c.id}
                                      onClick={() =>
                                        runAction(c.id, () => approveHmoClaim(c.id, c.claimed_amount))
                                      }
                                    >
                                      {t("billing.approveClaim", "Approve")}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={actionId === c.id}
                                      onClick={() => {
                                        setRejectingClaimId((prev) => (prev === c.id ? null : c.id))
                                        setRejectReason(c.rejection_reason ?? "")
                                        setError(null)
                                      }}
                                    >
                                      {t("billing.rejectClaim", "Reject")}
                                    </Button>
                                  </>
                                ) : null}
                                {c.status === "approved" ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      className="h-7 w-28 text-xs"
                                      placeholder={t("billing.refPlaceholder", "Ref #")}
                                      value={payRef[c.id] ?? ""}
                                      onChange={(e) =>
                                        setPayRef((prev) => ({ ...prev, [c.id]: e.target.value }))
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      disabled={actionId === c.id || !(payRef[c.id]?.trim())}
                                      onClick={() =>
                                        runAction(c.id, () => markHmoClaimPaid(c.id, payRef[c.id]?.trim() ?? ""))
                                      }
                                    >
                                      {t("billing.markPaid", "Mark paid")}
                                    </Button>
                                  </div>
                                ) : null}
                                {c.status === "rejected" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    disabled={actionId === c.id}
                                    onClick={() => runAction(c.id, () => resetHmoClaimToDraft(c.id))}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    {t("billing.resetToDraft", "Reset to draft")}
                                  </Button>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                          {rejectingClaimId === c.id ? (
                            <tr>
                              <td colSpan={canWrite ? 6 : 5} className="bg-amber-50/60 px-3 py-3">
                                <div className="flex flex-col gap-2 md:flex-row">
                                  <Input
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder={t("billing.hmoRejectReason", "Rejection reason")}
                                    className="md:flex-1"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRejectingClaimId(null)
                                        setRejectReason("")
                                      }}
                                    >
                                      {t("common.cancel", "Cancel")}
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={actionId === c.id || !rejectReason.trim()}
                                      onClick={() => void handleReject(c)}
                                    >
                                      {t("billing.rejectClaim", "Reject")}
                                    </Button>
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-amber-800">
                                  {t(
                                    "billing.hmoRejectHint",
                                    "This reason stays on the claim so billing can correct and resubmit it."
                                  )}
                                </p>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </ContentPanel>

          {selected ? (
            <Card className="border-neutral-200">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("billing.claimDetail", "Claim detail")} — {selected.claim_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-neutral-500">{t("billing.memberId", "Member ID")}:</span>{" "}
                  {selected.member_id ?? "—"}
                </p>
                <p>
                  <span className="text-neutral-500">{t("billing.claimStatus", "Status")}:</span>{" "}
                  <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status}</Badge>
                </p>
                {selected.submitted_at ? (
                  <p>
                    <span className="text-neutral-500">{t("billing.submittedAt", "Submitted")}:</span>{" "}
                    {new Date(selected.submitted_at).toLocaleString()}
                  </p>
                ) : null}
                {selected.provider_ref ? (
                  <p>
                    <span className="text-neutral-500">{t("billing.providerRef", "Provider ref")}:</span>{" "}
                    <span className="font-mono text-xs">{selected.provider_ref}</span>
                  </p>
                ) : null}
                {selected.rejection_reason ? (
                  <p className="text-red-700 sm:col-span-2">
                    <span className="text-neutral-500">{t("billing.rejectionReason", "Rejection")}:</span>{" "}
                    {selected.rejection_reason}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ModulePageShell>
      <HmoClaimDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        providers={providers ?? []}
        onCreated={() => void load()}
      />
    </PermissionGate>
  )
}
