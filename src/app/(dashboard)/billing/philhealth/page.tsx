"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import { fetchPatientInsuranceProfiles } from "@/lib/patients/insurance-service"
import {
  PHILHEALTH_CHECKLIST_KEYS,
  checklistComplete,
  createPhilHealthClaim,
  fetchPhilHealthClaims,
  fetchPhilHealthSyncLogs,
  resetPhilHealthClaimForRetry,
  syncPhilHealthClaim,
  updatePhilHealthChecklist,
  type PhilHealthClaim,
  type PhilHealthSyncLog,
} from "@/lib/billing/philhealth-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FileHeart, Plus, RotateCcw } from "lucide-react"
import { IntegrationEnvBanner } from "@/components/layout/IntegrationEnvBanner"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PhilHealthAnalyticsPanel } from "@/components/analytics/PhilHealthAnalyticsPanel"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info" | "outline"> = {
  checklist_incomplete: "warning",
  ready: "info",
  submitted: "success",
  sync_failed: "danger",
  draft: "outline",
  acknowledged: "success",
}

const PHILHEALTH_PENDING_STATUSES = [
  "draft",
  "checklist_incomplete",
  "ready",
  "sync_failed",
] as const

export default function PhilHealthPage() {
  return (
    <React.Suspense fallback={<PageLoadingSkeleton variant="list" />}>
      <PhilHealthPageContent />
    </React.Suspense>
  )
}

function PhilHealthPageContent() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get("status")
  const [claims, setClaims] = React.useState<PhilHealthClaim[]>([])
  const [selected, setSelected] = React.useState<PhilHealthClaim | null>(null)
  const [syncLogs, setSyncLogs] = React.useState<PhilHealthSyncLog[]>([])
  const [loading, setLoading] = React.useState(true)
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [philhealthId, setPhilhealthId] = React.useState("")
  const [caseRate, setCaseRate] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [retrying, setRetrying] = React.useState(false)
  const [syncNote, setSyncNote] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    fetchPhilHealthClaims(activeBranch.id).then(({ data, error: err }) => {
      setClaims(data)
      setError(err)
      setLoading(false)
      setSelected((prev) => (prev ? data.find((c) => c.id === prev.id) ?? prev : null))
    })
  }, [activeBranch])

  React.useEffect(() => { load() }, [load])

  React.useEffect(() => {
    if (!selected) {
      setSyncLogs([])
      return
    }
    setLogsLoading(true)
    fetchPhilHealthSyncLogs(selected.id).then(({ data }) => {
      setSyncLogs(data)
      setLogsLoading(false)
    })
  }, [selected?.id])

  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) { setPatients([]); return }
    const timer = setTimeout(() => searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data)), 300)
    return () => clearTimeout(timer)
  }, [patientQuery, activeBranch])

  const pickPatient = async (patientId: string, displayName: string) => {
    setSelectedPatientId(patientId)
    setPatientQuery(displayName)
    setPatients([])
    const { data: profiles } = await fetchPatientInsuranceProfiles(patientId)
    const ph = profiles.find((p) => p.payer_type === "philhealth" && p.member_id)
    if (ph?.member_id) setPhilhealthId(ph.member_id)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) { setError("Organization not found"); setSaving(false); return }
    const { error: err } = await createPhilHealthClaim({
      organizationId: org.id, branchId: activeBranch.id, patientId: selectedPatientId,
      philhealthId, caseRateCode: caseRate, userId: user.id,
    })
    setSaving(false)
    if (err) setError(err)
    else { setShowForm(false); setPhilhealthId(""); setCaseRate(""); load() }
  }

  const toggleCheck = async (key: string, checked: boolean) => {
    if (!selected) return
    const next = { ...selected.checklist, [key]: checked }
    const { error: err } = await updatePhilHealthChecklist(selected.id, next)
    if (err) setError(err)
    else {
      const updated = { ...selected, checklist: next, status: checklistComplete(next) ? "ready" : "checklist_incomplete" }
      setSelected(updated)
      load()
    }
  }

  const handleSubmit = async () => {
    if (!selected) return
    setSyncing(true)
    setSyncNote(null)
    const { data, error: err } = await syncPhilHealthClaim(selected.id)
    setSyncing(false)
    if (err) setError(err)
    else {
      setSyncNote(
        data?.dry_run
          ? t("billing.philhealthDryRun", "Dry-run sync recorded — configure PhilHealth API secrets for live submission.")
          : `${t("billing.philhealthLiveOk", "Claim submitted to PhilHealth eClaims.")}${data?.provider_ref ? ` Ref: ${data.provider_ref}` : ""}`
      )
      load()
      fetchPhilHealthSyncLogs(selected.id).then(({ data: logs }) => setSyncLogs(logs))
    }
  }

  const handleRetry = async () => {
    if (!selected) return
    setRetrying(true)
    setError(null)
    const { error: err } = await resetPhilHealthClaimForRetry(selected.id)
    setRetrying(false)
    if (err) setError(err)
    else load()
  }

  const phStats = React.useMemo(() => {
    const incomplete = claims.filter((c) => c.status === "checklist_incomplete").length
    const ready = claims.filter((c) => c.status === "ready").length
    const failed = claims.filter((c) => c.status === "sync_failed").length
    const submitted = claims.filter((c) => ["submitted", "acknowledged"].includes(c.status)).length
    return { incomplete, ready, failed, submitted }
  }, [claims])

  const displayedClaims = React.useMemo(() => {
    if (statusFilter === "pending") {
      return claims.filter((c) =>
        PHILHEALTH_PENDING_STATUSES.includes(
          c.status as (typeof PHILHEALTH_PENDING_STATUSES)[number]
        )
      )
    }
    return claims
  }, [claims, statusFilter])

  const metricItems = [
    {
      label: t("billing.claims", "Claims"),
      value: loading ? "—" : String(claims.length),
      hint: activeBranch?.name ?? t("dashboard.selectBranch", "Select a branch"),
      icon: FileHeart,
    },
    {
      label: t("billing.phReady", "Ready"),
      value: loading ? "—" : String(phStats.ready),
      hint: t("billing.phReadyHint", "Checklist complete"),
      variant: phStats.ready > 0 ? ("default" as const) : ("default" as const),
    },
    {
      label: t("billing.phIncomplete", "Incomplete"),
      value: loading ? "—" : String(phStats.incomplete),
      hint: t("billing.phIncompleteHint", "Missing checklist items"),
      variant: phStats.incomplete > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("billing.phSubmitted", "Synced"),
      value: loading ? "—" : String(phStats.submitted),
      hint: phStats.failed > 0 ? `${phStats.failed} ${t("billing.phFailed", "failed")}` : t("billing.phSubmittedHint", "Submitted or acknowledged"),
      variant: phStats.failed > 0 ? ("warning" as const) : ("success" as const),
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_READ}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("billing.eyebrow", "Billing") + " · PhilHealth"}
        icon={FileHeart}
        title={t("billing.philhealthTitle", "PhilHealth Claims")}
        description={t(
          "billing.philhealthSubtitle",
          "Readiness checklist and sync logs for eClaims submissions."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowSettingsLink />
            <Button className="gap-2 shadow-sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> {t("billing.newClaimPrep", "New claim prep")}
            </Button>
          </div>
        }
        badges={
          statusFilter === "pending" ? (
            <Badge variant="warning" className="font-normal">
              {t("billing.phPendingFilter", "Pending claims only")}
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
        <IntegrationEnvBanner
          title={t("billing.philhealthIntegration", "PhilHealth eClaims sync")}
          description={t(
            "billing.philhealthBanner",
            "Submissions use the sync-philhealth-claim edge function. Without PHILHEALTH_ECLAIMS_API_URL and related secrets, sync runs in dry-run mode and records a log only."
          )}
        />

        {activeBranch ? <PhilHealthAnalyticsPanel branchId={activeBranch.id} /> : null}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 max-w-xl">
                <div className="sm:col-span-2">
                  <Input placeholder={t("billing.searchPatient", "Search patient…")} value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
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
                <Input placeholder={t("billing.philhealthId", "PhilHealth ID")} required value={philhealthId} onChange={(e) => setPhilhealthId(e.target.value)} />
                <Input placeholder={t("billing.caseRateCode", "Case rate code")} required value={caseRate} onChange={(e) => setCaseRate(e.target.value)} />
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving || !selectedPatientId}>{t("common.save", "Save")}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel", "Cancel")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("billing.claims", "Claims")}</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <PageLoadingSkeleton variant="inline" />
              ) : displayedClaims.length === 0 ? (
                <div className="py-10 text-center">
                  <FileHeart className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
                  <p className="mt-3 font-medium text-neutral-700">
                    {statusFilter === "pending"
                      ? t("billing.noPhilhealthPendingClaims", "No pending PhilHealth claims")
                      : t("billing.noPhilhealthClaimsTitle", "No PhilHealth claims yet")}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 max-w-sm mx-auto">
                    {statusFilter === "pending" ? (
                      <Link href="/billing/philhealth" className="text-primary-600 hover:underline">
                        {t("billing.clearFilter", "Clear filter")}
                      </Link>
                    ) : (
                      t(
                        "billing.noPhilhealthClaimsHint",
                        "Prepare a claim with patient PhilHealth ID and case rate, then complete the checklist before sync."
                      )
                    )}
                  </p>
                  {statusFilter !== "pending" ? (
                    <Button className="mt-4 gap-2" onClick={() => setShowForm(true)}>
                      <Plus className="h-4 w-4" />
                      {t("billing.newClaimPrep", "New claim prep")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y">
                  {displayedClaims.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={`w-full text-left px-2 py-3 hover:bg-neutral-50 rounded ${selected?.id === c.id ? "bg-primary-50" : ""}`} onClick={() => setSelected(c)}>
                        <span className="font-medium">{c.patient_name}</span>
                        <Badge className="ml-2" variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                        {c.provider_ref && (
                          <span className="block text-xs text-neutral-500 mt-1">Ref: {c.provider_ref}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {selected && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">{t("billing.readinessChecklist", "Readiness checklist")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {PHILHEALTH_CHECKLIST_KEYS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!selected.checklist[key]} onChange={(e) => toggleCheck(key, e.target.checked)} disabled={selected.status === "submitted"} />
                      {label}
                    </label>
                  ))}
                  {selected.submitted_at && (
                    <p className="text-xs text-neutral-500">
                      {t("billing.submittedAt", "Submitted")}: {new Date(selected.submitted_at).toLocaleString()}
                    </p>
                  )}
                  {syncNote && (
                    <p className="text-sm text-neutral-600 bg-neutral-50 border rounded-md px-3 py-2">{syncNote}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(selected.status === "ready" || selected.status === "sync_failed") && (
                      <Button disabled={syncing} onClick={handleSubmit}>
                        {syncing
                          ? t("billing.submitting", "Submitting…")
                          : selected.status === "sync_failed"
                            ? t("billing.resubmitPhilhealth", "Resubmit to eClaims")
                            : t("billing.submitPhilhealth", "Submit to eClaims")}
                      </Button>
                    )}
                    {selected.status === "sync_failed" && (
                      <Button variant="outline" className="gap-1" disabled={retrying} onClick={handleRetry}>
                        <RotateCcw className="h-4 w-4" />
                        {retrying ? t("common.loading", "Loading…") : t("billing.retryPhilhealth", "Reset to ready")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">{t("billing.syncHistory", "Sync history")}</CardTitle></CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <PageLoadingSkeleton variant="inline" className="max-w-none" />
                  ) : syncLogs.length === 0 ? (
                    <p className="text-sm text-neutral-500">{t("billing.noSyncLogs", "No sync attempts yet.")}</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {syncLogs.map((log) => (
                        <li key={log.id} className="border border-neutral-100 rounded-md px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={log.status === "success" ? "success" : log.status === "failed" ? "danger" : "outline"}>
                              {log.status}
                            </Badge>
                            {log.mode && <span className="text-xs text-neutral-500">{log.mode}</span>}
                            <span className="text-xs text-neutral-400 ml-auto">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          {log.response_summary && (
                            <p className="text-xs text-neutral-600 mt-1">{log.response_summary}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
