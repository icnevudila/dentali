"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CalendarDays, Plus, Lock, Receipt, FileSignature, Pencil } from "lucide-react"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BulletTextarea } from "@/components/ui/BulletTextarea"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { usePermission } from "@/hooks/use-permission"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { getPatient } from "@/lib/patients/patient-service"
import { fetchPatientConsents } from "@/lib/patients/consent-service"
import {
  closeOrthoCase,
  createOrthoCase,
  createInvoiceFromOrthoCase,
  fetchOrthoAdjustments,
  fetchOrthoBalance,
  fetchOrthoCase,
  logOrthoAdjustment,
  revertOrthoAdjustment,
  updateOrthoAdjustment,
  type OrthoAdjustment,
  type OrthoBalance,
  type OrthoCase,
} from "@/lib/clinical/ortho-service"
import { OrthoCaseTimelinePanel } from "@/components/clinical/OrthoCaseTimelinePanel"
import { OrthoAdjustmentRow } from "@/components/clinical/OrthoAdjustmentRow"
import { OrthoCaseDrawer } from "@/components/clinical/OrthoCaseDrawer"
import { OrthoAdjustmentDrawer } from "@/components/clinical/OrthoAdjustmentDrawer"
import { notify } from "@/lib/ui/notify"
import { toStoredBulletText } from "@/lib/text/bullet-text"
import { cn } from "@/lib/utils"

export default function OrthoRecordPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const { hasPermission } = usePermission()
  const canWrite = hasPermission(PERMISSIONS.DENTAL_CHART_WRITE)

  const [patientName, setPatientName] = React.useState("")
  const [orthoCase, setOrthoCase] = React.useState<OrthoCase | null>(null)
  const [adjustments, setAdjustments] = React.useState<OrthoAdjustment[]>([])
  const [balance, setBalance] = React.useState<OrthoBalance | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showNewCase, setShowNewCase] = React.useState(false)
  const [showEditCase, setShowEditCase] = React.useState(false)
  const [showAddRow, setShowAddRow] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [orthoConsentSigned, setOrthoConsentSigned] = React.useState<boolean | null>(null)
  const [linkedInvoiceId, setLinkedInvoiceId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!activeBranch || !patientId) return
    setLoading(true)
    const { data: c, error: caseErr } = await fetchOrthoCase(patientId, activeBranch.id)
    setOrthoCase(c)
    setLinkedInvoiceId(c?.linked_invoice_id ?? null)
    setError(caseErr)

    // Check ortho consent forms
    const { data: consentList } = await fetchPatientConsents(patientId)
    const hasOrthoConsent = consentList.some(
      (form) =>
        (form.template_slug === "informed-consent-ortho" ||
          form.template_slug === "orthodontic-consent" ||
          form.template_slug === "ortho-agreement") &&
        form.status === "signed"
    )
    setOrthoConsentSigned(hasOrthoConsent)

    if (c) {
      const [adjRes, balRes] = await Promise.all([
        fetchOrthoAdjustments(c.id),
        fetchOrthoBalance(c.id),
      ])
      setAdjustments(adjRes.data)
      setBalance(balRes.data)
      if (adjRes.error) setError(adjRes.error)
    } else {
      setAdjustments([])
      setBalance(null)
    }
    setLoading(false)
  }, [activeBranch, patientId])

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
    queueMicrotask(() => {
      void load()
    })
  }, [patientId, load])



  const handleUpdateAdjustment = async (
    adjustmentId: string,
    patch: {
      adjustmentDate: string
      procedure: string
      nextProcedure?: string
      nextVisitDate?: string
      paymentAmount: number
      notes?: string
    }
  ) => {
    setSaving(true)
    const { error: err } = await updateOrthoAdjustment({
      adjustmentId,
      ...patch,
    })
    setSaving(false)
    if (err) setError(err)
    else load()
  }

  const handleCloseCase = async () => {
    if (!orthoCase) return
    const warnings = [
      balance && balance.balance > 0 ? `Open balance: ₱${balance.balance.toLocaleString("en-PH")}` : null,
      latestAdjustment?.next_visit_date ? `Next visit still planned: ${latestAdjustment.next_visit_date}` : null,
      linkedInvoiceId ? null : "No linked ortho invoice",
    ].filter(Boolean)
    const prompt =
      warnings.length > 0
        ? `Close this orthodontic case with warnings?\n\n${warnings.map((warning) => `- ${warning}`).join("\n")}\n\nThis is allowed, but staff should document the reason.`
        : "Close this orthodontic case?"
    if (!(await notify.confirm(prompt))) return
    setSaving(true)
    const { error: err } = await closeOrthoCase(orthoCase.id)
    setSaving(false)
    if (err) setError(err)
    else load()
  }

  const handleRevertAdjustment = async (adjustmentId: string) => {
    if (!(await notify.confirm("Remove this visit row? Balance will be recalculated."))) return
    setSaving(true)
    const { error: err } = await revertOrthoAdjustment(adjustmentId)
    setSaving(false)
    if (err) setError(err)
    else load()
  }

  const handleCreateInvoice = async () => {
    if (!orthoCase) return
    setSaving(true)
    const { data, error: err } = await createInvoiceFromOrthoCase(orthoCase.id)
    setSaving(false)
    if (err) setError(err)
    else if (data) {
      setLinkedInvoiceId(data.id)
      if (!data.existing) {
        window.location.href = `/billing/${data.id}`
      }
    }
  }

  const orthoMetrics = orthoCase
    ? [
        {
          label: "Contract",
          value: `₱${(orthoCase.contract_amount ?? 0).toLocaleString()}`,
          hint: orthoCase.appliance_type ?? "Appliance",
        },
        {
          label: "Balance",
          value: balance ? `₱${balance.balance.toLocaleString()}` : "—",
          hint: balance ? `₱${balance.total_paid.toLocaleString()} paid` : "Payment ledger",
          variant: balance && balance.balance > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          label: "Adjustments",
          value: String(adjustments.length),
          hint: orthoCase.status,
        },
      ]
    : undefined

  const latestAdjustment = adjustments[0] ?? null
  const nextVisit = adjustments.find((adjustment) => adjustment.next_visit_date)?.next_visit_date ?? null
  const buildAppointmentHref = (date: string) => {
    const params = new URLSearchParams({
      patient: patientId,
      patientName: patientName || "Selected Patient",
      date,
      source: "ortho",
    })
    return `/appointments?${params.toString()}`
  }
  const closeWarnings = orthoCase
    ? [
        balance && balance.balance > 0 ? `${balance.balance.toLocaleString("en-PH")} balance` : null,
        latestAdjustment?.next_visit_date ? "next visit planned" : null,
        linkedInvoiceId ? null : "invoice not linked",
      ].filter(Boolean)
    : []

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <PatientPageShell
        patientId={patientId}
        section="Orthodontics"
        title="Orthodontic record"
        description={`${patientName}${activeBranch ? ` · ${activeBranch.name}` : ""}`}
        maxWidth="max-w-5xl"
        error={error}
        onRetry={load}
        metrics={!loading ? orthoMetrics : undefined}
        panel={false}
      >
        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : !orthoCase ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-500 mb-4">No active orthodontic case for this branch.</p>
              {canWrite && (
                <Button onClick={() => setShowNewCase(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Start ortho case
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-base">{t("ortho.caseDashboard", "Case dashboard")}</CardTitle>
                    <CardDescription>
                      {orthoCase.appliance_type ?? "Orthodontic case"} · started {orthoCase.start_date ?? "not set"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canWrite && orthoCase.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => setShowEditCase(true)}
                      >
                        <Pencil className="h-4 w-4" /> Edit case details
                      </Button>
                    )}
                    {nextVisit ? (
                      <Button size="sm" variant="outline" className="gap-2" asChild>
                        <Link href={buildAppointmentHref(nextVisit)}>
                          <CalendarDays className="h-4 w-4" /> Book next visit
                        </Link>
                      </Button>
                    ) : null}
                    {linkedInvoiceId ? (
                      <Button size="sm" variant="outline" className="gap-2" asChild>
                        <Link href={`/billing/${linkedInvoiceId}`}>
                          <Receipt className="h-4 w-4" /> Open invoice
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs text-neutral-500">Last visit</p>
                  <p className="font-semibold">{latestAdjustment?.adjustment_date ?? "No visits yet"}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs text-neutral-500">Next visit</p>
                  <p className="font-semibold">{nextVisit ?? "Not scheduled"}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs text-neutral-500">Invoice</p>
                  <p className="font-semibold">{linkedInvoiceId ? "Linked" : "Not linked"}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs text-neutral-500">{t("ortho.closeReadiness", "Close readiness")}</p>
                  <p className="font-semibold">
                    {closeWarnings.length > 0
                      ? t("ortho.closeWarnings", "{count} warning(s)").replace("{count}", String(closeWarnings.length))
                      : t("ortho.ready", "Ready")}
                  </p>
                </div>
                {orthoConsentSigned !== null && (
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 sm:col-span-2 lg:col-span-4",
                      orthoConsentSigned
                        ? "border-emerald-200 bg-emerald-50/20 text-emerald-950"
                        : "border-amber-200 bg-amber-50/20 text-amber-950"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileSignature className={cn("h-5 w-5 shrink-0", orthoConsentSigned ? "text-emerald-600" : "text-amber-600")} />
                      <div className="text-sm">
                        <span className="font-semibold">Ortho Informed Consent:</span>{" "}
                        {orthoConsentSigned ? (
                          <span className="text-emerald-700 font-medium">Signed and active</span>
                        ) : (
                          <span className="text-amber-700 font-medium">Awaiting signature</span>
                        )}
                      </div>
                    </div>
                    {!orthoConsentSigned && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-amber-300 bg-white text-amber-800 hover:bg-amber-50" asChild>
                        <Link href={`/patients/${patientId}/consents/ortho-agreement?returnTo=ortho`}>
                          Sign Consent Form
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
                {closeWarnings.length > 0 ? (
                  <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:col-span-2 lg:col-span-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{closeWarnings.join(" · ")} before closing, unless intentionally overridden.</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Appliance</p>
                  <p className="font-semibold">{orthoCase.appliance_type ?? "—"}</p>
                  <Badge className="mt-1">{orthoCase.status}</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Diagnosis</p>
                  <p className="font-semibold text-neutral-800 line-clamp-2" title={orthoCase.diagnosis ?? "No diagnosis recorded"}>
                    {orthoCase.diagnosis ?? "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Contract</p>
                  <p className="font-semibold">₱{(balance?.contract_amount ?? orthoCase.contract_amount).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Paid</p>
                  <p className="font-semibold text-emerald-700">₱{(balance?.total_paid ?? 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Balance</p>
                  <p className="font-semibold text-amber-700">₱{(balance?.balance ?? orthoCase.contract_amount).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit charts</CardTitle>
                <CardDescription>Balance trend and adjustment timeline for this case</CardDescription>
              </CardHeader>
              <CardContent>
                <OrthoCaseTimelinePanel
                  contractAmount={balance?.contract_amount ?? orthoCase.contract_amount}
                  adjustments={adjustments}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Adjustment log</CardTitle>
                  <CardDescription>Date · Procedure · Next visit · Payment · Balance</CardDescription>
                </div>
                {canWrite && orthoCase.status === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setShowAddRow(true)
                      }}
                    >
                      <Plus className="h-4 w-4" /> Log visit
                    </Button>
                    {balance && balance.balance > 0 ? (
                      linkedInvoiceId ? (
                        <Button size="sm" variant="outline" className="gap-2" asChild>
                          <Link href={`/billing/${linkedInvoiceId}`}>
                            <Receipt className="h-4 w-4" /> Open invoice
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="default" className="gap-2" onClick={handleCreateInvoice} disabled={saving}>
                          <Receipt className="h-4 w-4" /> Invoice balance
                        </Button>
                      )
                    ) : null}
                    <Button size="sm" variant="ghost" className="gap-2" onClick={handleCloseCase} disabled={saving}>
                      <Lock className="h-4 w-4" /> Close case
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {adjustments.length === 0 ? (
                  <p className="text-center py-8 text-neutral-500 text-sm">No adjustments logged yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-neutral-500 bg-neutral-50/50">
                        <th className="py-2 px-3 text-left font-semibold text-xs text-neutral-500 uppercase tracking-wider">Date</th>
                        <th className="py-2 px-3 text-left font-semibold text-xs text-neutral-500 uppercase tracking-wider">Procedure</th>
                        <th className="py-2 px-3 text-left font-semibold text-xs text-neutral-500 uppercase tracking-wider">Next procedure</th>
                        <th className="py-2 px-3 text-left font-semibold text-xs text-neutral-500 uppercase tracking-wider">Next date</th>
                        <th className="py-2 px-3 text-right font-semibold text-xs text-neutral-500 uppercase tracking-wider">Payment</th>
                        {canWrite && orthoCase.status === "active" ? (
                          <th className="py-2 px-3 text-right font-medium w-32" />
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {adjustments.map((a) => (
                        <OrthoAdjustmentRow
                          key={a.id}
                          adjustment={a}
                          canEdit={!!canWrite && orthoCase.status === "active"}
                          saving={saving}
                          colSpan={canWrite && orthoCase.status === "active" ? 6 : 5}
                          onUpdate={(patch) => handleUpdateAdjustment(a.id, patch)}
                          onRevert={() => handleRevertAdjustment(a.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PatientPageShell>
      <OrthoCaseDrawer
        open={showNewCase}
        onOpenChange={setShowNewCase}
        patientId={patientId}
        onCreated={() => void load()}
      />
      <OrthoCaseDrawer
        open={showEditCase}
        onOpenChange={setShowEditCase}
        patientId={patientId}
        initialCase={orthoCase}
        onCreated={() => void load()}
      />
      <OrthoAdjustmentDrawer
        open={showAddRow}
        onOpenChange={setShowAddRow}
        caseId={orthoCase?.id ?? ""}
        onCreated={async (nextDate, bookNext) => {
          await load()
          if (bookNext && nextDate) {
            router.push(buildAppointmentHref(nextDate))
          }
        }}
      />
    </PermissionGate>
  )
}
