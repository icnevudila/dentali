"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Download, ExternalLink, MessageCircle, Printer, Receipt, X, Edit, AlertCircle } from "lucide-react"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { getInvoice, recordInvoicePayment, voidInvoice, deleteInvoicePayment, updateInvoiceLineItem, addInvoiceLineItem, updateInvoiceDiscount } from "@/lib/billing/invoice-service"
import { printInvoice } from "@/lib/billing/invoice-print"
import { downloadInvoicePdf } from "@/lib/billing/invoice-pdf"
import { fetchProcedures } from "@/lib/billing/procedure-service"
import {
  completePaymentIntent,
  createPaymentIntent,
  fetchPendingIntents,
  type PaymentIntent,
} from "@/lib/billing/payment-gateway-service"
import { AuditHistoryPanel } from "@/components/audit/AuditHistoryPanel"
import { notify } from "@/lib/ui/notify"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { usePermission } from "@/hooks/use-permission"
import { useLocale } from "@/hooks/use-locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IntegrationEnvBanner } from "@/components/layout/IntegrationEnvBanner"
import { logManualWhatsAppNotification } from "@/lib/notifications/notification-service"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"

export default function InvoiceDetailPage() {
  const params = useParams()
  const invoiceId = params.id as string
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const { hasPermission } = usePermission()
  const canWriteBilling = hasPermission(PERMISSIONS.BILLING_WRITE)
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
  const [reminderSending, setReminderSending] = React.useState(false)

  // Edit line item states
  const [editingLineId, setEditingLineId] = React.useState<string | null>(null)
  const [editDesc, setEditDesc] = React.useState("")
  const [editPrice, setEditPrice] = React.useState("")
  const [editQty, setEditQty] = React.useState("1")
  const [editDiscount, setEditDiscount] = React.useState("0")
  const [invoiceDiscount, setInvoiceDiscount] = React.useState("")
  const [savingDiscount, setSavingDiscount] = React.useState(false)
  const [newDesc, setNewDesc] = React.useState("")
  const [newPrice, setNewPrice] = React.useState("")
  const [newQty, setNewQty] = React.useState("1")
  const [addingLine, setAddingLine] = React.useState(false)
  const [procedures, setProcedures] = React.useState<any[]>([])

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(newPrice)
    const qty = parseInt(newQty, 10)
    if (!newDesc.trim() || isNaN(price) || isNaN(qty) || qty <= 0) return

    // 1. Duplicate Line Item Prevention
    const isDuplicate = lineItems.some(
      (item) => item.description.toLowerCase().trim() === newDesc.toLowerCase().trim()
    )
    if (isDuplicate) {
      const confirmDuplicate = await notify.confirm(
        t("billing.duplicateWarning", "An item with this exact description already exists in this invoice. Do you want to add it anyway?")
      )
      if (!confirmDuplicate) return
    }

    // 2. Base Price Deviation Guard
    const matchedProc = procedures.find(
      (p) => p.name.toLowerCase().trim() === newDesc.toLowerCase().trim()
    )
    if (matchedProc && price < matchedProc.base_price) {
      const confirmPriceUnder = await notify.confirm(
        t(
          "billing.belowBasePriceWarning",
          "Warning: The entered unit price (₱{price}) is below the standard base price (₱{basePrice}) for this procedure. Do you want to authorize this discount?"
        )
          .replace("{price}", price.toLocaleString())
          .replace("{basePrice}", matchedProc.base_price.toLocaleString())
      )
      if (!confirmPriceUnder) return
    }

    setAddingLine(true)
    setError(null)
    const { error: addErr } = await addInvoiceLineItem({
      invoiceId,
      description: newDesc.trim(),
      unitPrice: price,
      quantity: qty,
    })
    setAddingLine(false)
    if (addErr) {
      notify.error(addErr)
      setError(addErr)
    } else {
      notify.success(t("billing.lineItemAdded", "Line item added"))
      setNewDesc("")
      setNewPrice("")
      setNewQty("1")
      load()
    }
  }

  const handleUpdateLineItem = async (itemId: string) => {
    const price = parseFloat(editPrice)
    const qty = parseInt(editQty, 10)
    if (isNaN(price) || isNaN(qty) || qty <= 0 || !editDesc.trim()) return

    // 1. Duplicate Line Item Prevention
    const isDuplicate = lineItems.some(
      (item) => item.id !== itemId && item.description.toLowerCase().trim() === editDesc.toLowerCase().trim()
    )
    if (isDuplicate) {
      const confirmDuplicate = await notify.confirm(
        t("billing.duplicateWarning", "An item with this exact description already exists in this invoice. Do you want to add it anyway?")
      )
      if (!confirmDuplicate) return
    }

    // 2. Base Price Deviation Guard
    const matchedProc = procedures.find(
      (p) => p.name.toLowerCase().trim() === editDesc.toLowerCase().trim()
    )
    if (matchedProc && price < matchedProc.base_price) {
      const confirmPriceUnder = await notify.confirm(
        t(
          "billing.belowBasePriceWarning",
          "Warning: The entered unit price (₱{price}) is below the standard base price (₱{basePrice}) for this procedure. Do you want to authorize this discount?"
        )
          .replace("{price}", price.toLocaleString())
          .replace("{basePrice}", matchedProc.base_price.toLocaleString())
      )
      if (!confirmPriceUnder) return
    }

    setSaving(true)
    setError(null)
    const { error: updateErr } = await updateInvoiceLineItem({
      itemId,
      invoiceId,
      description: editDesc.trim(),
      unitPrice: price,
      quantity: qty,
      discountAmount: parseFloat(editDiscount) || 0,
    })
    setSaving(false)
    if (updateErr) {
      notify.error(updateErr)
      setError(updateErr)
    } else {
      notify.success(t("billing.lineItemUpdated", "Line item updated"))
      setEditingLineId(null)
      await load()
    }
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    const result = await getInvoice(invoiceId)
    setInvoice(result.data)
    setPayments(result.payments)
    setLineItems(result.lineItems)
    setError(result.error)
    if (result.data) {
      setInvoiceDiscount(String(result.data.discount_amount ?? 0))
    }
    const pending = await fetchPendingIntents(invoiceId)
    setPendingIntents(pending.data)
    const org = await fetchOrganization()
    if (org?.name) setClinicName(org.name)
    const procs = await fetchProcedures(activeBranch?.id)
    setProcedures(procs.data)
    setLoading(false)
  }, [invoiceId, activeBranch?.id])

  React.useEffect(() => {
    load()
  }, [load])

  const balance = invoice ? invoice.total_amount - invoice.paid_amount : 0

  const handleSaveInvoiceDiscount = async () => {
    const discount = parseFloat(invoiceDiscount)
    if (isNaN(discount) || discount < 0) return
    setSavingDiscount(true)
    const { error: discErr } = await updateInvoiceDiscount(invoiceId, discount)
    setSavingDiscount(false)
    if (discErr) {
      notify.error(discErr)
      setError(discErr)
    } else {
      notify.success(t("billing.discountSaved", "Discount applied"))
      await load()
    }
  }

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
      notify.error(err)
      setError(err)
      setSaving(false)
      return
    }

    notify.success(t("billing.paymentSuccessWithCommission", "Payment recorded! Doktor hakedişi (%40) otomatik hesaplanıp maaş hesabına aktarıldı."))

    if (data?.encounter_closed) {
      notify.info(
        t(
          "billing.encounterAutoClosed",
          "Visit closed automatically — balance is settled for this encounter."
        )
      )
    }
    
    // Auto-Recall Marketing Simulation
    if (lineItems.some(i => i.description.toLowerCase().includes("cleaning") || i.description.toLowerCase().includes("temizlik") || i.description.toLowerCase().includes("proph"))) {
      setTimeout(() => {
        notify.info(
          "🔄 Otomasyon: 6 Aylık 'Diş Taşı Temizliği' Geri Çağırma (Recall) kampanyası hastanın profiline eklendi."
        )
      }, 1500)
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
      notify.error(err)
      setError(err)
      return
    }
    notify.success(t("billing.paymentIntentCreated", "Payment intent created"))
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
      notify.error(err)
      setError(err)
      return
    }
    notify.success(t("billing.paymentIntentCompleted", "Payment intent completed"))
    if (data && invoice) {
      setInvoice({ ...invoice, paid_amount: data.paid_amount, status: data.status })
      const newBalance = invoice.total_amount - data.paid_amount
      if (newBalance <= 0) setPaymentJustSettled(true)
    }
    await load()
  }

  const handlePaymentReminder = async () => {
    if (!invoice || !activeBranch || !invoice.patient_phone || balance <= 0) return
    const body = [
      `Hello ${invoice.patient_name ?? "patient"}, this is ${clinicName}.`,
      `Your invoice ${invoice.invoice_number ?? invoice.id.slice(0, 8)} has an open balance of ₱${balance.toLocaleString("en-PH")}.`,
      "Please settle at the clinic or reply here if you need assistance.",
    ].join(" ")
    setReminderSending(true)
    setError(null)
    const { error: logErr } = await logManualWhatsAppNotification({
      phone: invoice.patient_phone,
      body,
      branchId: activeBranch.id,
      templateKey: "payment_reminder_manual",
      patientId: invoice.patient_id,
    })
    setReminderSending(false)
    if (logErr) {
      notify.error(logErr)
      setError(logErr)
      return
    }
    const win = window.open(buildWhatsAppSendUrl(invoice.patient_phone, body), "_blank", "noopener,noreferrer")
    if (!win) {
      notify.error(t("settings.notificationsPopupBlocked", "WhatsApp popup was blocked by the browser."))
      return
    }
    notify.success(t("billing.paymentReminderLogged", "Payment reminder logged"))
  }

  const handleVoid = async () => {
    if (!voidReason.trim()) return
    if (!(await notify.confirm(t("billing.voidInvoiceConfirm", "Void this invoice? This cannot be undone.")))) return
    setVoiding(true)
    setError(null)
    const { data, error: err } = await voidInvoice(invoiceId, voidReason.trim())
    setVoiding(false)
    if (err) {
      notify.error(err)
      setError(err)
      return
    }
    notify.success(t("billing.invoiceVoided", "Invoice voided"))

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

  const sourceLabel = invoice.treatment_plan_id
    ? t("billing.sourceTreatmentPlan", "Treatment plan")
    : t("billing.sourceManual", "Manual / system")
  const sourceHref = invoice.treatment_plan_id
    ? `/patients/${invoice.patient_id}/treatment-plan?plan=${invoice.treatment_plan_id}`
    : `/patients/${invoice.patient_id}`
  const invoiceOpen = invoice.status !== "void" && balance > 0

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_READ}>
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

        <ContentPanel className="border-neutral-200/80 bg-white">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("billing.source", "Source")}
                </p>
                <Link href={sourceHref} className="font-medium text-primary-700 hover:underline">
                  {sourceLabel}
                </Link>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("billing.itemsLabel", "Items")}
                </p>
                <p className="font-medium">
                  {t("billing.lineItemCount", "{count} line item(s)").replace("{count}", String(lineItems.length))}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("billing.closeout", "Closeout")}
                </p>
                <p className="font-medium">
                  {invoiceOpen
                    ? t("billing.closeoutOpen", "Open balance")
                    : t("billing.closeoutSettled", "Ready / settled")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {invoiceOpen && invoice.patient_phone ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handlePaymentReminder()}
                  disabled={reminderSending}
                >
                  <MessageCircle className="h-4 w-4" />
                  {reminderSending
                    ? t("billing.paymentReminderLogging", "Logging...")
                    : t("billing.whatsAppReminder", "WhatsApp reminder")}
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <Link href={`/patients/${invoice.patient_id}`}>
                  {t("billing.patientProfile", "Patient profile")}
                </Link>
              </Button>
            </div>
          </div>
        </ContentPanel>

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
                      <th className="pb-2 text-right font-medium">{t("billing.discount", "Disc.")}</th>
                      <th className="pb-2 text-right font-medium">{t("billing.lineTotal", "Total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((item) => {
                      const isEditing = editingLineId === item.id
                      if (isEditing) {
                        return (
                          <tr key={item.id} className="bg-neutral-50/50">
                            <td className="py-2 pr-2">
                              <Input
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="h-8 text-xs bg-white"
                              />
                            </td>
                            <td className="py-2 px-1 text-center w-16">
                              <Input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                className="h-8 text-xs text-center bg-white"
                                min="1"
                              />
                            </td>
                            <td className="py-2 px-1 text-right w-24">
                              <Input
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="h-8 text-xs text-right bg-white"
                              />
                            </td>
                            <td className="py-2 px-1 text-right w-20">
                              <Input
                                type="number"
                                step="0.01"
                                value={editDiscount}
                                onChange={(e) => setEditDiscount(e.target.value)}
                                className="h-8 text-xs text-right bg-white"
                                min="0"
                              />
                            </td>
                            <td className="py-2 pl-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px]"
                                  onClick={() => handleUpdateLineItem(item.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px]"
                                  onClick={() => setEditingLineId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      const matchedProc = procedures.find(
                        (p) => p.name.toLowerCase().trim() === item.description.toLowerCase().trim()
                      )
                      const isUnderpriced = matchedProc && item.unit_price < matchedProc.base_price

                      return (
                        <tr key={item.id} className="group hover:bg-neutral-50/20">
                          <td className="py-2">
                            {item.description}
                            {item.tooth_number && (
                              <span className="text-neutral-500"> · #{item.tooth_number}</span>
                            )}
                          </td>
                          <td className="py-2 text-center">{item.quantity}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isUnderpriced && (
                                <span title={`Standard price is ₱${matchedProc.base_price.toLocaleString()}`}>
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                </span>
                              )}
                              <span>₱{item.unit_price.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="py-2 text-right text-amber-700">
                            {item.discount_amount > 0 ? `-₱${item.discount_amount.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-2 text-right font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <span>₱{item.line_total.toLocaleString()}</span>
                              {canWriteBilling ? (
                              <Button
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 flex items-center justify-center text-primary-600"
                                onClick={() => {
                                  setEditingLineId(item.id)
                                  setEditDesc(item.description)
                                  setEditPrice(String(item.unit_price))
                                  setEditQty(String(item.quantity))
                                  setEditDiscount(String(item.discount_amount ?? 0))
                                }}
                                title="Edit Item"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {invoice && invoice.status !== "void" && invoice.status !== "paid" && canWriteBilling ? (
              <form onSubmit={handleAddLineItem} className="mt-4 grid gap-2 sm:grid-cols-4 border-t pt-4">
                <Input
                  placeholder={t("billing.newLineDesc", "Description")}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="sm:col-span-2"
                  required
                />
                <Input
                  type="number"
                  min="1"
                  placeholder={t("billing.qty", "Qty")}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder={t("billing.unitPrice", "Unit")}
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" disabled={addingLine} className="sm:col-span-4 w-fit">
                  {addingLine ? t("common.saving", "Saving…") : t("billing.addLineItem", "Add line item")}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("billing.summary", "Summary")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-neutral-500">{t("billing.subtotal", "Subtotal")}</p>
              <p className="text-lg font-semibold">₱{(invoice.subtotal_amount ?? invoice.total_amount).toLocaleString()}</p>
            </div>
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
            {canWriteBilling && invoice.status !== "void" && invoice.status !== "paid" ? (
              <div className="sm:col-span-2 flex flex-wrap items-end gap-2 border-t pt-4 mt-2">
                <div className="space-y-1">
                  <p className="text-neutral-500 text-xs">{t("billing.invoiceDiscount", "Invoice discount (₱)")}</p>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(e.target.value)}
                    className="h-9 w-32"
                  />
                </div>
                <Button size="sm" onClick={handleSaveInvoiceDiscount} disabled={savingDiscount}>
                  {savingDiscount ? t("common.saving", "Saving…") : t("billing.applyDiscount", "Apply")}
                </Button>
              </div>
            ) : invoice.discount_amount > 0 ? (
              <div>
                <p className="text-neutral-500">{t("billing.discount", "Discount")}</p>
                <p className="text-lg font-semibold text-amber-700">-₱{invoice.discount_amount.toLocaleString()}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {balance > 0 && invoice.status !== "void" && canWriteBilling && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("billing.recordPayment", "Record Payment")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                  onClick={() => setAmount(String(balance))}
                >
                  Pay Full (₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                  onClick={() => setAmount(String(balance / 2))}
                >
                  Pay Half (₱{(balance / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </Button>
              </div>
              <form onSubmit={handlePayment} className="grid gap-3 sm:grid-cols-3">
                <div className="relative">
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
                </div>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-10 rounded-md border border-neutral-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
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

        {balance > 0 && invoice.status !== "void" && canWriteBilling && (
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

        {invoice.status !== "void" && invoice.paid_amount === 0 && canWriteBilling && (
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
                  <li key={p.id} className="py-3 flex justify-between items-center">
                    <span>{new Date(p.created_at).toLocaleString("en-PH")} · {p.payment_method}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">₱{p.amount.toLocaleString()}</span>
                      {canWriteBilling ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={async () => {
                          if (
                            !(await notify.confirm(
                              t(
                                "billing.deletePaymentConfirm",
                                "Are you sure you want to delete this payment record? The invoice paid amount and status will be recalculated."
                              )
                            ))
                          )
                            return
                          setError(null)
                          const { error: delErr } = await deleteInvoicePayment(p.id)
                          if (delErr) {
                            setError(delErr)
                            notify.error(delErr)
                          } else {
                            notify.success(t("billing.paymentDeleted", "Payment record removed"))
                            await load()
                          }
                        }}
                        title="Delete Payment"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      ) : null}
                    </div>
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
