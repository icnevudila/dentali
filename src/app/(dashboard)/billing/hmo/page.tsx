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
import { searchPatients } from "@/lib/patients/patient-service"
import { fetchPatientInsuranceProfiles } from "@/lib/patients/insurance-service"
import {
  approveHmoClaim,
  createHmoClaim,
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
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { HmoAnalyticsPanel } from "@/components/analytics/HmoAnalyticsPanel"

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info" | "outline"> = {
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
  const [providers, setProviders] = React.useState<Awaited<ReturnType<typeof fetchHmoProviders>>["data"]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [providerId, setProviderId] = React.useState("")
  const [memberId, setMemberId] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [submitNote, setSubmitNote] = React.useState<string | null>(null)

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
    load()
  }, [load])

  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) {
      setPatients([])
      return
    }
    const t = setTimeout(() => searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data)), 300)
    return () => clearTimeout(t)
  }, [patientQuery, activeBranch])

  const pickPatient = async (patientId: string, displayName: string) => {
    setSelectedPatientId(patientId)
    setPatientQuery(displayName)
    setPatients([])
    const { data: profiles } = await fetchPatientInsuranceProfiles(patientId)
    const hmo = profiles.find((p) => p.payer_type === "hmo")
    if (hmo?.member_id) setMemberId(hmo.member_id)
    if (hmo?.payer_name && providers.length > 0) {
      const match = providers.find((p) => p.name.toLowerCase() === hmo.payer_name!.toLowerCase())
      if (match) setProviderId(match.id)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId || !providerId) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }
    const { error: err } = await createHmoClaim({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      providerId,
      memberId: memberId || undefined,
      claimedAmount: parseFloat(amount) || 0,
      userId: user.id,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setShowForm(false)
      load()
    }
  }

  const runAction = async (id: string, fn: () => Promise<{ error: string | null }>) => {
    setActionId(id)
    setSubmitNote(null)
    const { error: err } = await fn()
    setActionId(null)
    if (err) setError(err)
    else load()
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
    if (err) setError(err)
    else {
      setSubmitNote(
        data?.provider_ref
          ? `${t("billing.hmoSubmitted", "Claim submitted.")} Ref: ${data.provider_ref}`
          : t("billing.hmoSubmitted", "Claim submitted.")
      )
      load()
    }
  }

  const handleReject = async (claim: HmoClaim) => {
    const reason = window.prompt(t("billing.hmoRejectReason", "Rejection reason:"))
    if (!reason?.trim()) return
    await runAction(claim.id, () => rejectHmoClaim(claim.id, reason.trim()))
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
      hint: loading ? "" : `₱${hmoStats.totalAmount.toLocaleString()} ${t("billing.hmoTotalClaimed", "total claimed")}`,
      variant: "success" as const,
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.HMO_READ}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {statusFilter === "draft" ? (
            <Badge variant="warning" className="font-normal">
              {t("billing.hmoDraftFilter", "Draft claims only")}
            </Badge>
          ) : null}
          {canWrite ? (
            <Button className="gap-2 shadow-sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> {t("billing.newClaim", "New claim")}
            </Button>
          ) : null}
        </div>

        <MetricStrip items={metricItems} />

        {activeBranch ? <HmoAnalyticsPanel branchId={activeBranch.id} /> : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : null}
        {submitNote ? (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2 animate-fade-rise">
            {submitNote}
          </p>
        ) : null}

        {showForm && (
          <Card className="border-primary-200">
            <CardHeader><CardTitle className="text-base">{t("billing.draftClaim", "Draft HMO claim")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                <div className="sm:col-span-2">
                  <Input placeholder="Search patient…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
                  {patients.length > 0 && (
                    <ul className="border rounded-md divide-y mt-1 max-h-32 overflow-y-auto">
                      {patients.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50" onClick={() => pickPatient(p.id, `${p.first_name} ${p.last_name}`)}>
                            {p.first_name} {p.last_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <select className="h-9 rounded-md border px-3 text-sm" required value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                  <option value="">Select HMO provider</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input placeholder="Member ID" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
                <Input type="number" placeholder="Claimed amount ₱" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving || !selectedPatientId}>{saving ? "Saving…" : "Create draft"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel", "Cancel")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <ContentPanel padding="lg">
          <h3 className="text-base font-semibold text-neutral-950">{t("billing.claims", "Claims")}</h3>
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
                <p className="mt-1 text-sm text-neutral-500 max-w-sm mx-auto">
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
                  <Button className="mt-4 gap-2" onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4" />
                    {t("billing.newClaim", "New claim")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-neutral-500">
                    <th className="pb-2 text-left">Claim #</th>
                    <th className="pb-2 text-left">Patient</th>
                    <th className="pb-2 text-left">Provider</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 text-left">Status</th>
                    {canWrite && <th className="pb-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayedClaims.map((c) => (
                    <tr
                      key={c.id}
                      className={`cursor-pointer ${selected?.id === c.id ? "bg-primary-50/50" : "hover:bg-neutral-50"}`}
                      onClick={() => setSelected(c)}
                    >
                      <td className="py-2 font-mono text-xs">{c.claim_number}</td>
                      <td className="py-2"><Link href={`/patients/${c.patient_id}`} className="text-primary-600 hover:underline">{c.patient_name}</Link></td>
                      <td className="py-2">{c.provider_name ?? "—"}</td>
                      <td className="py-2 text-right">₱{c.claimed_amount.toLocaleString()}</td>
                      <td className="py-2"><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></td>
                      {canWrite && (
                        <td className="py-2 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          {c.status === "draft" && (
                            <Button size="sm" variant="outline" disabled={actionId === c.id} onClick={() => handleSubmit(c)}>
                              {t("billing.submitClaim", "Submit")}
                            </Button>
                          )}
                          {c.status === "submitted" && (
                            <>
                              <Button size="sm" disabled={actionId === c.id} onClick={() => runAction(c.id, () => approveHmoClaim(c.id, c.claimed_amount))}>
                                {t("billing.approveClaim", "Approve")}
                              </Button>
                              <Button size="sm" variant="ghost" disabled={actionId === c.id} onClick={() => handleReject(c)}>
                                {t("billing.rejectClaim", "Reject")}
                              </Button>
                            </>
                          )}
                          {c.status === "approved" && (
                            <Button size="sm" disabled={actionId === c.id} onClick={() => runAction(c.id, () => markHmoClaimPaid(c.id, `REF-${Date.now()}`))}>
                              {t("billing.markPaid", "Mark paid")}
                            </Button>
                          )}
                          {c.status === "rejected" && (
                            <Button size="sm" variant="outline" className="gap-1" disabled={actionId === c.id} onClick={() => runAction(c.id, () => resetHmoClaimToDraft(c.id))}>
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t("billing.resetToDraft", "Reset to draft")}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </ContentPanel>

        {selected && (
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="text-base">{t("billing.claimDetail", "Claim detail")} — {selected.claim_number}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-neutral-500">{t("billing.memberId", "Member ID")}:</span> {selected.member_id ?? "—"}</p>
              <p><span className="text-neutral-500">{t("billing.claimStatus", "Status")}:</span> <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status}</Badge></p>
              {selected.submitted_at && (
                <p><span className="text-neutral-500">{t("billing.submittedAt", "Submitted")}:</span> {new Date(selected.submitted_at).toLocaleString()}</p>
              )}
              {selected.provider_ref && (
                <p><span className="text-neutral-500">{t("billing.providerRef", "Provider ref")}:</span> <span className="font-mono text-xs">{selected.provider_ref}</span></p>
              )}
              {selected.rejection_reason && (
                <p className="sm:col-span-2 text-red-700"><span className="text-neutral-500">{t("billing.rejectionReason", "Rejection")}:</span> {selected.rejection_reason}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGate>
  )
}
