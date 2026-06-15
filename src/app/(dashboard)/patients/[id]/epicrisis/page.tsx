"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { getPatient } from "@/lib/patients/patient-service"
import { fetchPatientTimeline, type TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import { fetchInvoices, type InvoiceRecord } from "@/lib/billing/invoice-service"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Printer, Download, FileText, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { fetchOrganization } from "@/lib/auth/auth-service"

export default function EpicrisisPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const { user } = useAuth()

  const [patient, setPatient] = React.useState<any>(null)
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([])
  const [invoices, setInvoices] = React.useState<InvoiceRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [clinicName, setClinicName] = React.useState("Dental Clinic")

  React.useEffect(() => {
    async function loadData() {
      setLoading(true)
      const patientRes = await getPatient(patientId)
      if (patientRes.data) {
        setPatient(patientRes.data)
      }
      const timelineRes = await fetchPatientTimeline(patientId)
      if (timelineRes.data) {
        setTimeline(timelineRes.data)
      }
      if (activeBranch) {
        const invoicesRes = await fetchInvoices(activeBranch.id)
        if (invoicesRes.data) {
          setInvoices(invoicesRes.data.filter((inv) => inv.patient_id === patientId))
        }
      }
      const org = await fetchOrganization()
      if (org) {
        setClinicName(org.name)
      }
      setLoading(false)
    }
    loadData()
  }, [patientId, activeBranch])

  const handlePrintEpicrisis = () => {
    const age = patient?.date_of_birth
      ? String(new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear())
      : "—"
    
    const timelineRows = timeline
      .map(
        (event, i) => `
      <tr>
        <td>${new Date(event.occurred_at).toLocaleDateString("en-PH")}</td>
        <td><strong style="text-transform: capitalize;">${event.event_type.replace(/_/g, " ")}</strong></td>
        <td>${event.title}</td>
        <td>${event.subtitle ?? "—"}</td>
      </tr>`
      )
      .join("")

    const invoiceRows = invoices
      .map(
        (inv) => `
      <tr>
        <td>${inv.invoice_number}</td>
        <td>${new Date(inv.created_at).toLocaleDateString("en-PH")}</td>
        <td>₱${Number(inv.total_amount).toLocaleString()}</td>
        <td>₱${Number(inv.paid_amount).toLocaleString()}</td>
        <td><span style="font-weight: bold; color: ${inv.status === "paid" ? "green" : "orange"}">${inv.status.toUpperCase()}</span></td>
      </tr>`
      )
      .join("")

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Epicrisis & Discharge Report — ${patient?.first_name} ${patient?.last_name}</title>
        <style>
          body { font-family: system-ui, sans-serif; color: #1e293b; padding: 40px; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
          .clinic-name { font-size: 16px; color: #64748b; margin-top: 4px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #0d9488; border-left: 4px solid #0d9488; padding-left: 10px; margin-bottom: 15px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .grid-item { font-size: 14px; }
          .grid-item strong { color: #64748b; display: block; font-size: 11px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .signature-box { width: 200px; border-top: 1px solid #0f172a; text-align: center; margin-top: 40px; padding-top: 8px; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #0d9488; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Export PDF</button>
        </div>
        <div class="header">
          <div>
            <h1 class="title">Clinical Epicrisis & Discharge Summary</h1>
            <div class="clinic-name">${clinicName} · Patient Record System</div>
          </div>
          <div style="text-align: right;">
            <div><strong>Date Generated:</strong> ${new Date().toLocaleDateString("en-PH")}</div>
            <div style="font-size: 12px; color: #64748b;">Record Ref: #${patientId.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Patient Profile Information</div>
          <div class="grid">
            <div class="grid-item"><strong>Full Name</strong>${patient?.first_name} ${patient?.last_name}</div>
            <div class="grid-item"><strong>Contact Number</strong>${patient?.phone_number ?? "—"}</div>
            <div class="grid-item"><strong>Age / Sex</strong>${age} / ${patient?.gender ?? "—"}</div>
            <div class="grid-item"><strong>Email Address</strong>${patient?.email ?? "—"}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Treatment History & Clinical Encounters</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description / Diagnosis</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${timelineRows || '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No clinical encounters found.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Financial Summary & Billings</div>
          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date Issued</th>
                <th>Total Bill</th>
                <th>Amount Paid</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No financial records found.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div>
            Generated by system clinician. Valid medical document.
          </div>
          <div>
            <div class="signature-box">
              Attending Dentist Signature
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    const win = window.open("", "_blank", "noopener,noreferrer,width=1000,height=800")
    if (win) {
      win.document.write(htmlContent)
      win.document.close()
    }
  }

  return (
    <PatientPageShell
      patientId={patientId}
      section="Epicrisis"
      title="Discharge & Epicrisis Summary"
      description={`Discharge report, SOAP summaries, and complete clinical ledger for ${patient ? `${patient.first_name} ${patient.last_name}` : "Patient"}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        <Card className="border-teal-200/60 bg-teal-50/10">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
                Comprehensive Epicrisis Report
              </CardTitle>
              <CardDescription>
                Generate a medical epicrisis document compile from all visits, procedures, SOAP notes and bills.
              </CardDescription>
            </div>
            <Button className="gap-1.5" onClick={handlePrintEpicrisis}>
              <Printer className="h-4 w-4" /> Generate Report / Print PDF
            </Button>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <p className="text-neutral-600">
              The epicrisis compiling logic aggregates:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-neutral-500">
              <li>Attending Patient Profile and Demographic variables</li>
              <li>Consolidated History of Dental Procedures & Clinic Journeys</li>
              <li>SOAP assessment plans and Clinical notes</li>
              <li>Outstanding Balance, Total billed value, and Invoice logs</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PatientPageShell>
  )
}
