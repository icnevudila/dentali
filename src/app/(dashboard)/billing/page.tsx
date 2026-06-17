"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Plus, Receipt, FileText } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { getPatient } from "@/lib/patients/patient-service"
import {
  fetchInvoices,
  filterInvoicesByStatus,
  filterOverdueInvoices,
  type InvoiceStatusFilter,
} from "@/lib/billing/invoice-service"
import { ManualInvoiceDrawer } from "@/components/billing/ManualInvoiceDrawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { BillingOpsSummary } from "@/components/billing/BillingOpsSummary"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { RecordRow } from "@/components/layout/RecordRow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"
import { WorkflowStatusBanner } from "@/components/layout/WorkflowStatusBanner"

const STATUS_FILTERS: InvoiceStatusFilter[] = ["all", "open", "paid", "void"]

function BillingPageContent() {
  const { activeBranch, branchRevision } = useBranch()
  const { t } = useLocale()
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
  const [prefillPatientId, setPrefillPatientId] = React.useState<string | undefined>()
  const [prefillPatientLabel, setPrefillPatientLabel] = React.useState<string | undefined>()

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
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load, branchRevision])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      if (patientFilter) {
        getPatient(patientFilter).then(({ data }) => {
          if (data) {
            setPrefillPatientId(patientFilter)
            setPrefillPatientLabel(`${data.first_name} ${data.last_name}`)
          }
        })
        if (searchParams.get("create") === "true") {
          setShowCreate(true)
        }
      } else {
        setPrefillPatientId(undefined)
        setPrefillPatientLabel(undefined)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [patientFilter, searchParams])

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
    const overdue = filterOverdueInvoices(scopedInvoices).length
    return { total: scopedInvoices.length, open: open.length, outstanding, paid, overdue }
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
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowSettingsLink />
            <PermissionGate permission={PERMISSIONS.BILLING_WRITE}>
              <Button className="gap-2 shadow-sm" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-4 w-4" />
                {showCreate ? t("common.cancel", "Cancel") : t("billing.createInvoice", "New invoice")}
              </Button>
            </PermissionGate>
          </div>
        </div>

        {activeBranch ? (
          <BillingOpsSummary
            total={billingStats.total}
            open={billingStats.open}
            outstanding={billingStats.outstanding}
            paid={billingStats.paid}
            overdue={billingStats.overdue}
            loading={loading}
            branchName={activeBranch.name}
          />
        ) : null}

        <WorkflowStatusBanner
          title={t("billing.workflowBannerTitle", "Automation affecting billing")}
          description={t(
            "billing.workflowBannerDescription",
            "Invoice drafting, booking or check-in billing gates, and reminder automations depend on branch settings."
          )}
          items={[
            {
              key: "auto_approve_creates_invoice",
              label: t("billing.workflowInvoiceDraft", "Plan approval event"),
            },
            {
              key: "billing_gate_block_services",
              label: t("billing.workflowBillingGate", "Booking and check-in gate"),
            },
            {
              key: "auto_payment_reminder",
              label: t("billing.workflowReminder", "Payment reminders"),
            },
          ]}
        />

        {activeBranch ? (
          <ReportDrillLink
            title={t("billing.reportsTitle", "Collections and AR analytics")}
            description={t(
              "billing.reportsDescription",
              "Seven-day collections trends and accounts-receivable aging live in Reports finance."
            )}
            href="/reports#finance"
            linkLabel={t("billing.openFinanceReports", "Open finance reports")}
          />
        ) : null}

        <ContentPanel padding="lg" className="space-y-6">

          <ManualInvoiceDrawer
            open={showCreate}
            onOpenChange={setShowCreate}
            defaultPatientId={prefillPatientId}
            defaultPatientLabel={prefillPatientLabel}
            onCreated={() => load()}
          />

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
                  {patientFilter
                    ? t(
                        "billing.emptyPatientHint",
                        "This patient has no invoices yet. Start from the treatment plan or create a manual invoice."
                      )
                    : t(
                        "billing.emptyHint",
                        "Approve a treatment plan and convert it to an invoice."
                      )}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {patientFilter ? (
                    <>
                      <Button onClick={() => setShowCreate(true)}>
                        {t("billing.createInvoice", "New invoice")}
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/patients/${patientFilter}/treatment-plan`}>
                          {t("billing.openTreatmentPlan", "Open treatment plan")}
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" asChild>
                        <Link href="/patients">{t("billing.goToPatients", "Go to Patients")}</Link>
                      </Button>
                      <Button onClick={() => setShowCreate(true)}>
                        {t("billing.createInvoice", "New invoice")}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" asChild>
                    <Link href="/settings/workflow">
                      {t("billing.workflowSettings", "Automation settings")}
                    </Link>
                  </Button>
                </div>
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
                      secondary={
                        inv.patient_id ? (
                          <Link
                            href={`/patients/${inv.patient_id}`}
                            className="text-primary-600 hover:underline relative z-10"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            {inv.patient_name ?? t("billing.patient", "Patient")}
                          </Link>
                        ) : (
                          inv.patient_name ?? t("billing.patient", "Patient")
                        )
                      }
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
