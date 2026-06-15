"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { getPatient, type PatientWithContacts } from "@/lib/patients/patient-service"
import { getLatestMedicalHistory, type MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import { fetchPatientTimeline, type TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import { fetchInvoices, getPatientBalance, type InvoiceRecord } from "@/lib/billing/invoice-service"
import { fetchPatientConsents, type PatientConsent } from "@/lib/patients/consent-service"
import { fetchPatientTreatmentTimeline, type TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import { fetchPatientPrescriptions, type PrescriptionRecord } from "@/lib/clinical/prescription-service"
import { fetchPatientQueueHistory, type PatientQueueVisit } from "@/lib/queue/queue-service"
import { fetchPatientLabCases, type PatientWithLabCase } from "@/lib/clinical/lab-service"
import { buildEpicrisisPrintHtml, printEpicrisis, type EpicrisisData } from "@/lib/clinical/epicrisis-print"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Printer, FileText, CheckCircle2 } from "lucide-react"
import { fetchOrganization } from "@/lib/auth/auth-service"

function SectionPreview({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span>{title}</span>
          <Badge variant="outline">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-neutral-600">{children}</CardContent>
    </Card>
  )
}

export default function EpicrisisPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const { user } = useAuth()

  const [data, setData] = React.useState<EpicrisisData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!patientId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const [
        patientRes,
        medicalRes,
        timelineRes,
        consentsRes,
        balanceRes,
        org,
      ] = await Promise.all([
        getPatient(patientId),
        getLatestMedicalHistory(patientId),
        fetchPatientTimeline(patientId),
        fetchPatientConsents(patientId),
        getPatientBalance(patientId),
        fetchOrganization(),
      ])

      const branchId = activeBranch?.id
      const [queueRes, labRes, treatmentRes, rxRes, invoicesRes] = await Promise.all([
        fetchPatientQueueHistory(patientId),
        fetchPatientLabCases(patientId),
        fetchPatientTreatmentTimeline(patientId, branchId),
        branchId ? fetchPatientPrescriptions(patientId, branchId) : Promise.resolve({ data: [], error: null }),
        branchId ? fetchInvoices(branchId) : Promise.resolve({ data: [], error: null }),
      ])

      if (cancelled) return

      if (!patientRes.data) {
        setError(patientRes.error ?? "Patient not found")
        setLoading(false)
        return
      }

      const invoices = (invoicesRes.data ?? []).filter((inv) => inv.patient_id === patientId)

      setData({
        patient: patientRes.data,
        medicalHistory: medicalRes.data,
        timeline: timelineRes.data ?? [],
        queueVisits: queueRes.data ?? [],
        labCases: labRes.data ?? [],
        consents: consentsRes.data ?? [],
        treatmentItems: treatmentRes.data ?? [],
        prescriptions: rxRes.data ?? [],
        invoices,
        balance: balanceRes.data,
        clinicName: org?.name ?? "Dental Clinic",
        clinicAddress: org?.address,
        clinicPhone: org?.contact_number,
        branchName: activeBranch?.name,
        generatedBy: user?.email ?? null,
      })
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id, activeBranch?.name, user?.email])

  const handlePrint = () => {
    if (!data) return
    printEpicrisis(buildEpicrisisPrintHtml(data))
  }

  const patientName = data
    ? `${data.patient.first_name} ${data.patient.last_name}`
    : "Patient"

  return (
    <PatientPageShell
      patientId={patientId}
      section="Epicrisis"
      title="Discharge & Epicrisis Summary"
      description={`Full clinical discharge report for ${patientName}`}
      maxWidth="max-w-5xl"
      error={error}
    >
      {loading ? (
        <PageLoadingSkeleton variant="detail" />
      ) : data ? (
        <div className="space-y-6">
          <Card className="border-teal-200/60 bg-teal-50/10">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                  Comprehensive epicrisis report
                </CardTitle>
                <CardDescription className="mt-1 max-w-xl">
                  Ten-section discharge document: demographics, medical history, consents, visits,
                  clinical notes, treatment procedures, lab work, prescriptions, and billing — ready
                  to print or save as PDF.
                </CardDescription>
              </div>
              <Button className="gap-1.5 shrink-0" onClick={handlePrint}>
                <Printer className="h-4 w-4" /> Print / PDF
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="outline">{data.timeline.length} timeline events</Badge>
                <Badge variant="outline">{data.queueVisits.length} queue visits</Badge>
                <Badge variant="outline">{data.treatmentItems.length} procedures</Badge>
                <Badge variant="outline">{data.prescriptions.length} prescriptions</Badge>
                <Badge variant="outline">{data.invoices.length} invoices</Badge>
                {data.balance && data.balance.open_balance > 0 ? (
                  <Badge variant="warning">
                    ₱{data.balance.open_balance.toLocaleString()} outstanding
                  </Badge>
                ) : (
                  <Badge variant="success">Balance settled</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionPreview title="1. Demographics" count={1}>
              <p>
                <strong>{patientName}</strong>
                <br />
                {data.patient.phone ?? "—"} · {data.patient.email ?? "—"}
                <br />
                {data.patient.address ?? "—"}
              </p>
            </SectionPreview>

            <SectionPreview title="2. Medical history" count={data.medicalHistory ? 1 : 0}>
              {data.medicalHistory ? (
                <>
                  <p>
                    <strong>Allergies:</strong>{" "}
                    {data.medicalHistory.allergies.length
                      ? data.medicalHistory.allergies.join(", ")
                      : "None recorded"}
                  </p>
                  <p className="mt-1">
                    <strong>Medications:</strong>{" "}
                    {data.medicalHistory.medications.join(", ") || "—"}
                  </p>
                  <p className="mt-1">
                    <strong>Conditions:</strong>{" "}
                    {data.medicalHistory.conditions.join(", ") || "—"}
                  </p>
                </>
              ) : (
                <p>No medical history on file.</p>
              )}
            </SectionPreview>

            <SectionPreview title="3. Consents" count={data.consents.length}>
              {data.consents.length === 0 ? (
                <p>No consent forms.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.consents.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      {c.template_name} — <span className="capitalize">{c.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionPreview>

            <SectionPreview title="4–5. Visits & notes" count={data.timeline.length + data.queueVisits.length}>
              <p>
                {data.queueVisits.length} queue check-in(s), {data.timeline.length} appointment /
                note event(s) included in printout.
              </p>
            </SectionPreview>

            <SectionPreview title="6. Treatment procedures" count={data.treatmentItems.length}>
              {data.treatmentItems.length === 0 ? (
                <p>No treatment plan items.</p>
              ) : (
                <ul className="space-y-1 text-xs max-h-32 overflow-y-auto">
                  {data.treatmentItems.slice(0, 8).map((item) => (
                    <li key={item.item_id}>
                      {item.description}
                      {item.tooth_number ? ` (#${item.tooth_number})` : ""} — ₱
                      {Number(item.estimated_price).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </SectionPreview>

            <SectionPreview title="7–8. Lab & prescriptions" count={data.labCases.length + data.prescriptions.length}>
              <p>
                {data.labCases.length} lab case(s), {data.prescriptions.length} prescription(s).
              </p>
            </SectionPreview>

            <SectionPreview title="9. Billing" count={data.invoices.length}>
              <p>
                Total billed ₱{(data.balance?.total_billed ?? 0).toLocaleString()} · Paid ₱
                {(data.balance?.total_paid ?? 0).toLocaleString()} · Outstanding ₱
                {(data.balance?.open_balance ?? 0).toLocaleString()}
              </p>
            </SectionPreview>

            <Card className="md:col-span-2 border-dashed">
              <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-neutral-600">
                  <FileText className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                  <p>
                    The printed epicrisis includes signature blocks for the attending dentist and a
                    formal discharge statement suitable for referral or insurance.
                  </p>
                </div>
                <Button variant="outline" className="gap-1.5" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Open print preview
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </PatientPageShell>
  )
}
