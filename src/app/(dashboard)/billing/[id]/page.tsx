"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Download, ExternalLink, Printer, Receipt } from "lucide-react"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { getInvoice, recordInvoicePayment, voidInvoice } from "@/lib/billing/invoice-service"
import { printInvoice } from "@/lib/billing/invoice-print"
import { downloadInvoicePdf } from "@/lib/billing/invoice-pdf"
import {
  completePaymentIntent,
  createPaymentIntent,
  fetchPendingIntents,
  type PaymentIntent,
} from "@/lib/billing/payment-gateway-service"
import { AuditHistoryPanel } from "@/components/audit/AuditHistoryPanel"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IntegrationEnvBanner } from "@/components/layout/IntegrationEnvBanner"

export default function InvoiceDetailPage() {
  const params = useParams()
  const invoiceId = params.id as string
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [invoice, setInvoice] = React.useState<Awaited<ReturnType<typeof getInvoice>>["data"]>(null)
  const [payments, setPayments] = React.useState<Awaited<ReturnType<typeof getInvoice>>["payments"]>([])
  const [lineItems, setLineItems] = React.useState<Awaited<ReturnType<typeof getInvoice>>["lineItems"]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [amount, setAmount] = React.useState("")
  const [method, setMethod] = React.useState("cash")
  const [saving, setSaving] = React.useState(false)
  const [onlineAmount, setOnlineAmount] = React.useState("")
  const [pendingIntents, setPendingIntents] = React.useState<PaymentIntent[]>([])
  const [gatewayLoading, setGatewayLoading] = React.useState<string | null>(null)
  const [gatewayDryRun, setGatewayDryRun] = React.useState(true)
  const [voidReason, setVoidReason] = React.useState("")
  const [voiding, setVoiding] = React.useState(false)
  const [clinicName, setClinicName] = React.useState("Dental Clinic")
  const [pdfLoading, setPdfLoading] = React.useState(false)
  const [paymentJustSettled, setPaymentJustSettled] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const result = await getInvoice(invoiceId)
    setInvoice(result.data)
    setPayments(result.payments)
    setLineItems(result.lineItems)
    setError(result.error)
    const pending = await fetchPendingIntents(invoiceId)
    setPendingIntents(pending.data)
    const org = await fetchOrganization()
    if (org?.name) setClinicName(org.name)
    setLoading(false)
  }, [invoiceId])

  React.useEffect(() => {
    load()
  }, [load])

  const balance = invoice ? invoice.total_amount - invoice.paid_amount : 0

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const payAmount = parseFloat(amount)
    if (!payAmount || payAmount <= 0) return
    setSaving(true)
    setError(null)

    const { data, error: err } = await recordInvoicePayment({
      invoiceId,
      amount: payAmount,
      paymentMethod: method,
    })

    if (err) {
      setError(err)
      setSaving(false)
      return
    }

    const org = await fetchOrganization()
    if (org) {
      await logAuditEvent({
        organizationId: org.id,
        branchId: activeBranch?.id,
        action: "invoice.payment",
        entityType: "invoice",
        entityId: invoiceId,
        metadata: { amount: payAmount, method },
      })
    }

    setAmount("")
    if (data && invoice) {
      setInvoice({ ...invoice, paid_amount: data.paid_amount, status: data.status })
      const newBalance = invoice.total_amount - data.paid_amount
      if (newBalance <= 0) setPaymentJustSettled(true)
    }
    await load()
    setSaving(false)
  }

  const handleCreateIntent = async (provider: "gcash" | "paymongo") => {
    const payAmount = parseFloat(onlineAmount || String(balance))
    if (!payAmount || payAmount <= 0 || payAmount > balance) return
    setGatewayLoading(provider)
    setError(null)
    const { data, error: err, dryRun } = await createPaymentIntent({
      invoiceId,
      provider,
      amount: payAmount,
    })
    setGatewayLoading(null)
    if (err) {
      setError(err)
      return
    }
    if (data) {
      setPendingIntents((prev) => [data, ...prev])
      setGatewayDryRun(dryRun === true)
    }
  }

  const handleCompleteIntent = async (intentId: string) => {
    setGatewayLoading(intentId)
    setError(null)
    const { data, error: err } = await completePaymentIntent(intentId)
    setGatewayLoading(null)
    if (err) {
      setError(err)
      return
    }
    if (data && invoice) {
      setInvoice({ ...invoice, paid_amount: data.paid_amount, status: data.status })
      const newBalance = invoice.total_amount - data.paid_amount
      if (newBalance <= 0) setPaymentJustSettled(true)
    }
    await load()
  }

  const handleVoid = async () => {
    if (!voidReason.trim()) return
    if (!confirm("Void this invoice? This cannot be undone.")) return
    setVoiding(true)
    setError(null)
    const { data, error: err } = await voidInvoice(invoiceId, voidReason.trim())
    setVoiding(false)
    if (err) {
      setError(err)
      return
    }
    if (data && invoice) {
      setInvoice({ ...invoice, status: data.status })
      setVoidReason("")
    }
  }

  if (loading) {
    return <PageLoadingSkeleton variant="detail" className="max-w-5xl" />
  }

  if (!invoice) {
    return (
      <ContentPanel className="py-14 text-center">
        <p className="text-red-800">{error ?? t("billing.notFound", "Invoice not found")}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/billing">{t("billing.back", "Back to invoices")}</Link>
        </Button>
      </ContentPanel>
    )
  }

  const metricItems = [
    {
      label: t("billing.total", "Total"),
      value: `₱${invoice.total_amount.toLocaleString()}`,
      hint: invoice.patient_name ?? t("billing.patient", "Patient"),
      icon: Receipt,
    },
    {
      label: t("billing.paid", "Paid"),
      value: `₱${invoice.paid_amount.toLocaleString()}`,
      hint: t("billing.paidHint", "Recorded payments"),
      variant: "success" as const,
    },
    {
      label: t("billing.balance", "Balance"),
      value: `₱${balance.toLocaleString()}`,
      hint: balance > 0 ? t("billing.outstanding", "Outstanding") : t("billing.settled", "Fully settled"),
      variant: balance > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("billing.status", "Status"),
      value: invoice.status,
      hint: invoice.due_date ? `${t("billing.dueDate", "Due")} ${invoice.due_date}` : "",
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_WRITE}>
      <div className="space-y-6 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/billing" aria-label={t("billing.back", "Back")}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-neutral-950 sm:text-2xl">
                {invoice.invoice_number ?? t("billing.invoice", "Invoice")}
              </h1>
              <p className="text-sm text-neutral-500">
                <Link href={`/patients/${invoice.patient_id}`} className="text-primary-600 hover:underline">
                  {invoice.patient_name}
                </Link>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{invoice.status}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              disabled={pdfLoading}
              onClick={async () => {
                setPdfLoading(true)
                setError(null)
                const { error: pdfErr } = await downloadInvoicePdf(invoiceId)
                if (pdfErr) setError(pdfErr)
                setPdfLoading(false)
              }}
            >
              <Download className="h-4 w-4" />
              {pdfLoading ? t("common.loading", "Loading…") : t("billing.downloadPdf", "Download PDF")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() =>
                printInvoice({
                  invoice,
                  payments,
                  lineItems,
                  clinicName,
                  branchName: activeBranch?.name ?? null,
                })
              }
            >
              <Printer className="h-4 w-4" />
              {t("billing.print", "Print")}
            </Button>
          </div>
        </div>

        <MetricStrip items={metricItems} />

        {paymentJustSettled && balance <= 0 ? (
          <ContentPanel className="border-emerald-200/80 bg-emerald-50/50">
            <p className="text-sm font-medium text-emerald-900">
              {t("billing.paymentComplete", "Payment recorded — invoice settled")}
            </p>
            <p className="mt-1 text-sm text-emerald-800/90">
              {t("billing.paymentCompleteHint", "Return to the patient chart or print a receipt for checkout.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <Link href={`/patients/${invoice.patient_id}`}>
                  <Receipt className="h-4 w-4" />
                  {t("billing.backToPatient", "Patient profile")}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={() =>
                  printInvoice({
                    invoice,
                    payments,
                    lineItems,
                    clinicName,
                    branchName: activeBranch?.name ?? null,
                  })
                }
              >
                <Printer className="h-4 w-4" />
                {t("billing.printReceipt", "Print receipt")}
              </Button>
            </div>
          </ContentPanel>
        ) : null}

        {(invoice.status === "issued" || invoice.status === "draft") && balance > 0 ? (
          <ContentPanel className="border-neutral-200/80 bg-neutral-50/60 py-3">
            <p className="text-sm text-neutral-700">
              {t("billing.hmoHint", "Patient uses HMO coverage?")}{" "}
              <Link href="/billing/hmo?status=draft" className="font-medium text-primary-600 hover:underline">
                {t("billing.viewHmoDrafts", "View HMO claim drafts")}
              </Link>
            </p>
          </ContentPanel>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : null}

        <Card>
          <CardHeader><CardTitle className="text-base">{t("billing.lineItems", "Line items")}</CardTitle></CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("billing.noLineItems", "No line items on this invoice.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-neutral-500">
                      <th className="pb-2 text-left font-medium">{t("billing.description", "Description")}</th>
                      <th className="pb-2 text-center font-medium">{t("billing.qty", "Qty")}</th>
                      <th className="pb-2 text-right font-medium">{t("billing.unitPrice", "Unit")}</th>
                      <th className="pb-2 text-right font-medium">{t("billing.lineTotal", "Total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          {item.description}
                          {item.tooth_number && (
                            <span className="text-neutral-500"> · #{item.tooth_number}</span>
                          )}
                        </td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right">₱{item.unit_price.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">₱{item.line_total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("billing.summary", "Summary")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-neutral-500">{t("billing.total", "Total")}</p>
              <p className="text-xl font-bold">₱{invoice.total_amount.toLocaleString()}</p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-neutral-500">{t("billing.dueDate", "Due date")}</p>
                <p className="text-xl font-bold">
                  {new Date(invoice.due_date).toLocaleDateString("en-PH")}
                </p>
              </div>
            )}
            <div>
              <p className="text-neutral-500">{t("billing.paid", "Paid")}</p>
              <p className="text-xl font-bold text-success-600">₱{invoice.paid_amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-neutral-500">{t("billing.balance", "Balance")}</p>
              <p className="text-xl font-bold text-amber-600">₱{balance.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {balance > 0 && invoice.status !== "void" && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("billing.recordPayment", "Record Payment")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handlePayment} className="grid gap-3 sm:grid-cols-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  placeholder="Amount (PHP)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="gcash">GCash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
                <Button type="submit" disabled={saving}>
                  {saving ? t("settings.saving", "Saving…") : t("billing.recordPayment", "Record Payment")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {balance > 0 && invoice.status !== "void" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("billing.onlinePayment", "Online Payment")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <IntegrationEnvBanner
                title={t("billing.paymongoTitle", "PayMongo online checkout")}
                description={
                  gatewayDryRun
                    ? t(
                        "billing.gatewayDryRun",
                        "Sandbox mode: checkout links are placeholders until PAYMONGO_SECRET_KEY is configured on the server. Open the link to preview, then record payment after the patient pays."
                      )
                    : t(
                        "billing.onlinePaymentLive",
                        "Live PayMongo checkout is active. Open the checkout link, then mark the invoice paid after confirmation."
                      )
                }
              />
              <div className="flex flex-wrap gap-2 items-end">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  placeholder={`Amount (max ₱${balance.toLocaleString()})`}
                  value={onlineAmount}
                  onChange={(e) => setOnlineAmount(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  disabled={!!gatewayLoading}
                  onClick={() => handleCreateIntent("gcash")}
                >
                  {gatewayLoading === "gcash" ? "Creating…" : "GCash link"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!!gatewayLoading}
                  onClick={() => handleCreateIntent("paymongo")}
                >
                  {gatewayLoading === "paymongo" ? "Creating…" : "PayMongo link"}
                </Button>
              </div>
              {pendingIntents.length > 0 && (
                <ul className="divide-y text-sm border rounded-md">
                  {pendingIntents.map((intent) => (
                    <li key={intent.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium capitalize">
                          {intent.provider} · ₱{intent.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">{intent.checkout_url}</p>
                        <p className="text-xs text-neutral-400">Ref: {intent.external_ref}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {intent.checkout_url ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={intent.checkout_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Open link
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={!!gatewayLoading}
                          onClick={() => handleCompleteIntent(intent.id)}
                        >
                          {gatewayLoading === intent.id ? "Confirming…" : "Mark paid"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {invoice.status !== "void" && invoice.paid_amount === 0 && (
          <Card className="border-red-200">
            <CardHeader><CardTitle className="text-base text-red-800">{t("billing.voidInvoice", "Void Invoice")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-neutral-600">
                Void only unpaid invoices. A reason is required and logged to audit.
              </p>
              <Input
                placeholder="Reason for voiding (required)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
              <Button variant="outline" className="text-red-700 border-red-300" disabled={voiding || !voidReason.trim()} onClick={handleVoid}>
                {voiding ? "Voiding…" : "Void invoice"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">{t("billing.paymentHistory", "Payment History")}</CardTitle></CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("billing.noPayments", "No payments recorded yet.")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="py-3 flex justify-between">
                    <span>{new Date(p.created_at).toLocaleString("en-PH")} · {p.payment_method}</span>
                    <span className="font-medium">₱{p.amount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <AuditHistoryPanel entityType="invoice" entityId={invoiceId} />
      </div>
    </PermissionGate>
  )
}
