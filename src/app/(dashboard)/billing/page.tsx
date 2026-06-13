"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Plus, Receipt, FileText } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import {
  createManualInvoice,
  fetchInvoices,
  filterInvoicesByStatus,
  filterOverdueInvoices,
  type InvoiceStatusFilter,
} from "@/lib/billing/invoice-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { RecordRow } from "@/components/layout/RecordRow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { BillingArAgingPanel } from "@/components/analytics/BillingArAgingPanel"
import { Sparkline } from "@/components/charts/ChartKit"
import { useReportsSummary } from "@/hooks/use-reports-summary"

const STATUS_FILTERS: InvoiceStatusFilter[] = ["all", "open", "paid", "void"]

function BillingPageContent() {
  const { activeBranch, branchRevision } = useBranch()
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const { summary: reportsSummary, loading: reportsLoading } = useReportsSummary(7, locale)
  const searchParams = useSearchParams()
  const patientFilter = searchParams.get("patient")
  const focusParam = searchParams.get("focus")
  const focusOverdue = focusParam === "overdue"
  const focusOpen = focusParam === "open"
  const [invoices, setInvoices] = React.useState<Awaited<ReturnType<typeof fetchInvoices>>["data"]>([])
  const [statusFilter, setStatusFilter] = React.useState<InvoiceStatusFilter>("all")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    fetchInvoices(activeBranch.id).then(({ data, error: err }) => {
      setInvoices(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch])

  React.useEffect(() => {
    load()
  }, [load, branchRevision])

  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) {
      setPatients([])
      return
    }
    const timer = setTimeout(
      () => searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data)),
      300
    )
    return () => clearTimeout(timer)
  }, [patientQuery, activeBranch])

  const scopedInvoices = React.useMemo(
    () => (patientFilter ? invoices.filter((inv) => inv.patient_id === patientFilter) : invoices),
    [invoices, patientFilter]
  )

  const filteredInvoices = React.useMemo(() => {
    const status = focusOpen ? "open" : statusFilter
    let list = filterInvoicesByStatus(scopedInvoices, status)
    if (focusOverdue) list = filterOverdueInvoices(list)
    return list
  }, [scopedInvoices, statusFilter, focusOverdue, focusOpen])

  const billingStats = React.useMemo(() => {
    const open = scopedInvoices.filter(
      (inv) => inv.status !== "void" && inv.status !== "paid" && inv.total_amount - inv.paid_amount > 0
    )
    const outstanding = open.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0)
    const paid = scopedInvoices.filter((inv) => inv.status === "paid").length
    return { total: scopedInvoices.length, open: open.length, outstanding, paid }
  }, [scopedInvoices])

  const filterLabel = (f: InvoiceStatusFilter) => {
    const map: Record<InvoiceStatusFilter, string> = {
      all: t("billing.filterAll", "All"),
      open: t("billing.filterOpen", "Open"),
      paid: t("billing.filterPaid", "Paid"),
      void: t("billing.filterVoid", "Void"),
    }
    return map[f]
  }

  const invoiceStatusVariant = (status: string, balance: number) => {
    if (status === "void") return "outline" as const
    if (status === "paid" || balance <= 0) return "success" as const
    return "warning" as const
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId) return
    const totalAmount = parseFloat(amount)
    if (!totalAmount || totalAmount <= 0) return

    setCreating(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setCreating(false)
      return
    }

    const { data, error: err } = await createManualInvoice({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      totalAmount,
      dueDate: dueDate || undefined,
      userId: user.id,
    })

    setCreating(false)
    if (err) setError(err)
    else {
      setShowCreate(false)
      setAmount("")
      setDueDate("")
      setPatientQuery("")
      setSelectedPatientId("")
      load()
      if (data?.id) window.location.href = `/billing/${data.id}`
    }
  }

  const metricItems = [
    {
      label: t("billing.metricTotal", "Invoices"),
      value: loading ? "—" : billingStats.total,
      hint: activeBranch?.name ?? t("dashboard.selectBranch", "Select a branch"),
      icon: Receipt,
    },
    {
      label: t("billing.filterOpen", "Open"),
      value: loading ? "—" : billingStats.open,
      hint: t("billing.metricOpenHint", "Outstanding balance"),
      variant: billingStats.open > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("billing.balance", "Outstanding"),
      value: loading ? "—" : `₱${billingStats.outstanding.toLocaleString()}`,
      hint: t("billing.metricOutstandingHint", "Unpaid total"),
      icon: FileText,
    },
    {
      label: t("billing.filterPaid", "Paid"),
      value: loading ? "—" : billingStats.paid,
      hint: t("billing.metricPaidHint", "Fully settled"),
      variant: "success" as const,
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_READ}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {patientFilter ? (
              <Badge variant="outline" className="font-normal">
                {t("billing.filteredByPatient", "Filtered by patient")}
              </Badge>
            ) : null}
            {focusOverdue ? (
              <Badge variant="danger" className="font-normal">
                {t("billing.overdueOnly", "Overdue only")}
              </Badge>
            ) : null}
            {focusOpen ? (
              <Badge variant="warning" className="font-normal">
                {t("billing.openOnly", "Open only")}
              </Badge>
            ) : null}
          </div>
          <PermissionGate permission={PERMISSIONS.BILLING_WRITE}>
            <Button className="gap-2 shadow-sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-4 w-4" />
              {showCreate ? t("common.cancel", "Cancel") : t("billing.createInvoice", "New invoice")}
            </Button>
          </PermissionGate>
        </div>

        <MetricStrip items={metricItems} />

        {activeBranch && reportsSummary ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div>
              <p className="text-xs font-medium text-neutral-500">
                {t("billing.collectionsSparkline", "Collections — last 7 days")}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {reportsLoading
                  ? "—"
                  : `₱${reportsSummary.totals.collected.toLocaleString()}`}
              </p>
            </div>
            <Sparkline
              data={reportsSummary.dailyCollections.map((d) => d.value)}
              color="#059669"
              width={120}
              height={32}
            />
          </div>
        ) : null}

        {activeBranch ? <BillingArAgingPanel branchId={activeBranch.id} /> : null}

        <ContentPanel padding="lg" className="space-y-6">

          {showCreate && (
            <Card className="border-primary-200 animate-fade-rise">
              <CardHeader>
                <CardTitle className="text-base">{t("billing.createInvoiceTitle", "Create manual invoice")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder={t("appointments.searchPatientPlaceholder", "Name or phone…")}
                      value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)}
                    />
                    {patients.length > 0 && (
                      <ul className="border rounded-md divide-y mt-1 max-h-32 overflow-y-auto">
                        {patients.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50"
                              onClick={() => {
                                setSelectedPatientId(p.id)
                                setPatientQuery(`${p.first_name} ${p.last_name}`)
                                setPatients([])
                              }}
                            >
                              {p.first_name} {p.last_name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={t("billing.invoiceAmount", "Amount (PHP)")}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    aria-label={t("billing.dueDate", "Due date")}
                  />
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="submit" disabled={creating || !selectedPatientId}>
                      {creating ? t("billing.creating", "Creating…") : t("billing.createInvoice", "New invoice")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                      {t("common.cancel", "Cancel")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {(patientFilter || focusOverdue || focusOpen) && (
            <div className="flex items-center gap-2 text-sm animate-fade-rise">
              <Button variant="outline" size="sm" asChild>
                <Link href="/billing">{t("billing.clearFilter", "Clear filter")}</Link>
              </Button>
            </div>
          )}

          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 bg-white/95 px-1 pb-1 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={statusFilter === f ? "default" : "outline"}
                onClick={() => setStatusFilter(f)}
              >
                {filterLabel(f)}
              </Button>
            ))}
          </div>

          {error && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 text-center animate-fade-rise">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={load}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <SectionEyebrow icon={FileText}>
              {patientFilter
                ? t("billing.patientInvoices", "Patient invoices")
                : t("billing.invoiceList", "Invoice list")}
            </SectionEyebrow>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <PageLoadingSkeleton key={i} variant="recordRow" />
                ))}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-14 text-center animate-fade-rise">
                <Receipt className="mx-auto mb-3 h-10 w-10 text-neutral-300" aria-hidden />
                <p className="text-neutral-600">{t("billing.empty", "No invoices yet.")}</p>
                <p className="mt-2 text-sm text-neutral-500">
                  {t("billing.emptyHint", "Approve a treatment plan and convert it to an invoice.")}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/patients">{t("billing.goToPatients", "Go to Patients")}</Link>
                </Button>
                <Button variant="ghost" className="mt-4 ml-2" asChild>
                  <Link href="/settings/workflow">{t("billing.workflowSettings", "Automation settings")}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInvoices.map((inv, index) => {
                  const balance = inv.total_amount - inv.paid_amount
                  const label = inv.invoice_number ?? inv.id.slice(0, 8)
                  return (
                    <RecordRow
                      key={inv.id}
                      href={`/billing/${inv.id}`}
                      initials={label.slice(0, 2).toUpperCase()}
                      primary={
                        <span className="font-medium text-neutral-950">
                          {label}
                        </span>
                      }
                      secondary={inv.patient_name ?? t("billing.patient", "Patient")}
                      meta={
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <span className="tabular-nums">
                            ₱{inv.total_amount.toLocaleString()}
                          </span>
                          {balance > 0 ? (
                            <span className="font-medium text-amber-700 tabular-nums">
                              {t("billing.balance", "Balance")} ₱{balance.toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      }
                      trailing={
                        <Badge variant={invoiceStatusVariant(inv.status, balance)}>
                          {inv.status}
                        </Badge>
                      }
                      staggerIndex={index}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </ContentPanel>
      </div>
    </PermissionGate>
  )
}

export default function BillingPage() {
  return (
    <React.Suspense
      fallback={<PageLoadingSkeleton variant="list" />}
    >
      <BillingPageContent />
    </React.Suspense>
  )
}
