"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronRight,
  ClipboardList,
  FileText,
  ListOrdered,
  Mail,
  MapPin,
  Phone,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { ConsentFormsPanel } from "@/components/consent/ConsentFormsPanel"
import { PatientOdontogramSummary } from "@/components/patients/PatientOdontogramSummary"
import { PatientInsurancePanel } from "@/components/patients/PatientInsurancePanel"
import { BookAppointmentDialog } from "@/components/appointments/BookAppointmentDialog"
import type { PatientBalance } from "@/lib/billing/invoice-service"
import type { PatientConsent } from "@/lib/patients/consent-service"
import type { PatientWithContacts } from "@/lib/patients/patient-service"
import { buildPatientRecordChecklist } from "@/lib/patients/patient-record-completeness"
import type { TreatmentPlanSummary } from "@/lib/clinical/treatment-plan-service"
import { TreatmentPlanProgressBar } from "@/components/clinical/TreatmentPlanProgressBar"
import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import { PatientEncountersWorkspace } from "@/components/patients/PatientEncountersWorkspace"
import { fetchOrthoCase, type OrthoCase } from "@/lib/clinical/ortho-service"
import { AuditHistoryPanel } from "@/components/audit/AuditHistoryPanel"
import { useBranch } from "@/hooks/use-branch"
import { cn } from "@/lib/utils"

const RECORD_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "record-status", label: "Status", icon: Activity },
  { id: "record-contact", label: "Contact", icon: Phone },
  { id: "record-medical", label: "Medical", icon: Stethoscope },
  { id: "record-chart", label: "Chart", icon: FileText },
  { id: "record-consents", label: "Forms", icon: ShieldCheck },
  { id: "record-notes", label: "Notes", icon: ClipboardList },
  { id: "record-treatment", label: "Treatment", icon: ListOrdered },
  { id: "record-ortho", label: "Ortho", icon: Activity },
  { id: "record-appointments", label: "Appts", icon: Calendar },
  { id: "record-visit-history", label: "Visits", icon: UserCheck },
  { id: "record-billing", label: "Billing", icon: Wallet },
]

function RecordSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn("scroll-mt-28 animate-fade-rise", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
          {description ? <p className="text-sm text-neutral-500 mt-0.5">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SectionNav({ activeId }: { activeId: string | null }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <nav className="xl:hidden sticky top-0 z-10 -mx-1 mb-4 flex gap-1.5 overflow-x-auto hide-scrollbar rounded-lg border border-neutral-200 bg-white/95 p-1.5 backdrop-blur-sm">
        {RECORD_SECTIONS.map((s) => {
          const SectionIcon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeId === s.id
                  ? "bg-primary-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              <SectionIcon className="h-3.5 w-3.5 shrink-0" />
              {s.label}
            </button>
          )
        })}
      </nav>

      <aside className="hidden xl:block w-40 shrink-0">
        <nav className="sticky top-24 space-y-0.5 text-sm">
          {RECORD_SECTIONS.map((s) => {
            const SectionIcon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors text-left",
                  activeId === s.id
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50"
                )}
              >
                <SectionIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    activeId === s.id ? "text-primary-600" : "text-neutral-400"
                  )}
                />
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export function PatientRecordOnePage({
  patientId,
  patient,
  consents,
  appointments,
  treatmentPlans,
  medicalHistory,
  balance,
  balanceError,
  timeline,
  timelineError,
  onConsentsChange,
  onAppointmentsChange,
  onOpenTab,
}: {
  patientId: string
  patient: PatientWithContacts
  consents: PatientConsent[]
  appointments: Awaited<ReturnType<typeof import("@/lib/appointments/appointment-service").fetchPatientAppointments>>["data"]
  treatmentPlans: TreatmentPlanSummary[]
  medicalHistory: { allergies: string[]; medications: string[]; conditions: string[] } | null
  balance: PatientBalance | null
  balanceError: string | null
  timeline: TimelineEvent[]
  timelineError: string | null
  onConsentsChange: () => void
  onAppointmentsChange: () => void
  onOpenTab: (tabId: string) => void
}) {
  const { activeBranch } = useBranch()
  const [activeSection, setActiveSection] = React.useState<string | null>(RECORD_SECTIONS[0].id)
  const [orthoCase, setOrthoCase] = React.useState<OrthoCase | null>(null)

  React.useEffect(() => {
    if (!activeBranch?.id) return
    fetchOrthoCase(patientId, activeBranch.id).then(({ data }) => setOrthoCase(data))
  }, [patientId, activeBranch?.id])

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActiveSection(visible.target.id)
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    )
    for (const s of RECORD_SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const { items: checklist, percent } = buildPatientRecordChecklist({
    patient,
    medicalHistory,
    consents,
    patientId,
  })

  const noteEvents = timeline.filter((e) => e.event_type === "clinical_note").slice(0, 4)
  const upcomingAppts = appointments
    .filter((a) => new Date(a.scheduled_at) >= new Date() && a.status !== "cancelled")
    .slice(0, 3)
  const recentAppts = appointments
    .filter((a) => new Date(a.scheduled_at) < new Date() || a.status === "completed")
    .slice(0, 5)

  const pendingConsents = consents.filter((c) => c.status === "pending").length
  const signedConsents = consents.filter((c) => c.status === "signed").length

  return (
    <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
      <SectionNav activeId={activeSection} />

      <div className="min-w-0 flex-1 space-y-10 pb-8">
        <RecordSection id="record-status" title="Record status" description="Intake checklist for this patient">
          <ContentPanel>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-700">
                {percent}%
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium text-neutral-900">Chart completeness</p>
                <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      item.done ? "bg-emerald-500" : "bg-amber-400"
                    )}
                  />
                  {item.href && !item.done ? (
                    <Link href={item.href} className="text-primary-600 hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className={item.done ? "text-neutral-700" : "text-neutral-600"}>{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </ContentPanel>
        </RecordSection>

        <RecordSection
          id="record-contact"
          title="Contact & emergency"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/patients/${patientId}/edit`}>Edit</Link>
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ContentPanel className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{patient.phone ?? "—"}</p>
                  <p className="text-xs text-neutral-500">Mobile</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{patient.email ?? "—"}</p>
                  <p className="text-xs text-neutral-500">Email</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{patient.address ?? "—"}</p>
                  <p className="text-xs text-neutral-500">Address</p>
                </div>
              </div>
            </ContentPanel>
            <div className="space-y-4">
              <ContentPanel>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Emergency</p>
                <p className="mt-2 text-sm font-medium">{patient.emergency_contact?.name ?? "Not provided"}</p>
                <p className="text-sm text-neutral-500">{patient.emergency_contact?.phone ?? "—"}</p>
              </ContentPanel>
              <PatientInsurancePanel patientId={patientId} />
            </div>
          </div>
        </RecordSection>

        <RecordSection
          id="record-medical"
          title="Medical history"
          description="Allergies, conditions, and medications"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${patientId}/medical-history`}>Update</Link>
            </Button>
          }
        >
          <ContentPanel>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Allergies</h3>
                <ul className="space-y-1">
                  {(medicalHistory?.allergies ?? []).length === 0 ? (
                    <li className="text-sm text-neutral-500">None recorded</li>
                  ) : (
                    medicalHistory!.allergies.map((a) => (
                      <li key={a} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-danger-500" /> {a}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Conditions</h3>
                <ul className="space-y-1">
                  {(medicalHistory?.conditions ?? []).length === 0 ? (
                    <li className="text-sm text-neutral-500">None recorded</li>
                  ) : (
                    medicalHistory!.conditions.map((c) => (
                      <li key={c} className="flex items-center gap-2 text-sm">
                        <Activity className="h-3.5 w-3.5 text-primary-500" /> {c}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Medications</h3>
                <ul className="space-y-1">
                  {(medicalHistory?.medications ?? []).length === 0 ? (
                    <li className="text-sm text-neutral-500">None recorded</li>
                  ) : (
                    medicalHistory!.medications.map((m) => (
                      <li key={m} className="text-sm text-neutral-700">
                        {m}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </ContentPanel>
        </RecordSection>

        <RecordSection
          id="record-chart"
          title="Dental chart"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${patientId}/chart`}>Full chart</Link>
            </Button>
          }
        >
          <ContentPanel padding="default">
            <PatientOdontogramSummary patientId={patientId} compact />
          </ContentPanel>
        </RecordSection>

        <RecordSection
          id="record-consents"
          title="Consent forms"
          description={`${signedConsents} signed · ${pendingConsents} pending — fill at desk or send patient link`}
        >
          <ConsentFormsPanel
            patientId={patientId}
            consents={consents}
            onConsentsChange={onConsentsChange}
          />
        </RecordSection>

        <RecordSection
          id="record-notes"
          title="Clinical notes"
          action={
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={`/patients/${patientId}/notes`}>
                Open timeline <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          <ContentPanel>
            {timelineError ? (
              <p className="text-sm text-red-700">{timelineError}</p>
            ) : noteEvents.length === 0 ? (
              <div className="text-center py-8 text-sm text-neutral-500">
                <Stethoscope className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
                No clinical notes yet.
                <div className="mt-3">
                  <Button size="sm" asChild>
                    <Link href={`/patients/${patientId}/notes`}>Create first note</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-4">
                {noteEvents.map((ev) => (
                  <li key={ev.event_id} className="border-l-2 border-primary-500 pl-4">
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{ev.title}</span>
                      <span className="text-xs text-neutral-500 shrink-0">
                        {new Date(ev.occurred_at).toLocaleDateString("en-PH")}
                      </span>
                    </div>
                    {ev.subtitle ? (
                      <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{ev.subtitle}</p>
                    ) : null}
                    <Badge variant={ev.status === "signed" ? "success" : "warning"} className="mt-2 text-[10px]">
                      {ev.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </ContentPanel>
        </RecordSection>

        <RecordSection
          id="record-treatment"
          title="Treatment plans"
          action={
            <Button size="sm" className="gap-1" asChild>
              <Link href={`/patients/${patientId}/treatment-plan`}>
                <FileText className="h-3.5 w-3.5" /> New plan
              </Link>
            </Button>
          }
        >
          <TreatmentPlanProgressBar
            patientId={patientId}
            branchId={activeBranch?.id}
            className="mb-3"
          />
          <ContentPanel padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">Plan</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Created</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Total</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {treatmentPlans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                        No treatment plans yet.
                      </td>
                    </tr>
                  ) : (
                    treatmentPlans.slice(0, 5).map((plan) => (
                      <tr key={plan.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/patients/${patientId}/treatment-plan?plan=${plan.id}`}
                            className="text-primary-600 hover:underline"
                          >
                            {plan.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {new Date(plan.created_at).toLocaleDateString("en-PH")}
                        </td>
                        <td className="px-4 py-3">₱{Number(plan.total_estimated).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <Badge variant={plan.status === "completed" ? "success" : "warning"}>{plan.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ContentPanel>
        </RecordSection>

        <RecordSection id="record-visit-history" title="Visit history">
          <PatientEncountersWorkspace patientId={patientId} branchId={activeBranch?.id} />
        </RecordSection>

        <RecordSection
          id="record-ortho"
          title="Orthodontics"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${patientId}/ortho`}>Ortho record</Link>
            </Button>
          }
        >
          <ContentPanel>
            {orthoCase ? (
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Status</p>
                  <Badge variant={orthoCase.status === "active" ? "info" : "default"}>{orthoCase.status}</Badge>
                </div>
                {orthoCase.appliance_type ? (
                  <div>
                    <p className="text-xs text-neutral-500">Appliance</p>
                    <p className="font-medium">{orthoCase.appliance_type}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-neutral-500">Contract</p>
                  <p className="font-medium">₱{Number(orthoCase.contract_amount).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No active ortho case. Open ortho record to start.</p>
            )}
          </ContentPanel>
        </RecordSection>

        <RecordSection
          id="record-appointments"
          title="Appointments"
          action={<BookAppointmentDialog patientId={patientId} onBooked={onAppointmentsChange} />}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppts.length === 0 ? (
                  <p className="text-sm text-neutral-500">No upcoming visits.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingAppts.map((a) => (
                      <li key={a.id} className="text-sm flex justify-between gap-2">
                        <span className="font-medium">
                          {new Date(a.scheduled_at).toLocaleString("en-PH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <Badge variant="info">{a.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent</CardTitle>
                <CardDescription>
                  <button
                    type="button"
                    className="text-primary-600 hover:underline"
                    onClick={() => onOpenTab("appointments")}
                  >
                    Full history
                  </button>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentAppts.length === 0 ? (
                  <p className="text-sm text-neutral-500">No past visits.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentAppts.map((a) => (
                      <li key={a.id} className="text-sm">
                        <span className="text-neutral-500">
                          {new Date(a.scheduled_at).toLocaleDateString("en-PH")}
                        </span>
                        <span className="mx-2 text-neutral-300">·</span>
                        <span>{a.purpose ?? "Visit"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </RecordSection>

        <RecordSection
          id="record-billing"
          title="Billing"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/billing?patient=${patientId}`}>
                <Receipt className="h-3.5 w-3.5" /> Invoices
              </Link>
            </Button>
          }
        >
          <ContentPanel>
            {balanceError ? (
              <p className="text-sm text-red-700">{balanceError}</p>
            ) : balance ? (
              <div className="flex flex-wrap gap-8">
                <div>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-neutral-400" />
                    ₱{balance.open_balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-neutral-500">Open balance</p>
                </div>
                <div>
                  <p className="text-sm font-medium">₱{balance.total_billed.toLocaleString()}</p>
                  <p className="text-xs text-neutral-500">Total billed</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-success-600">₱{balance.total_paid.toLocaleString()}</p>
                  <p className="text-xs text-neutral-500">Total paid</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Loading balance…</p>
            )}
          </ContentPanel>
        </RecordSection>

        <AuditHistoryPanel entityType="patient" entityId={patientId} />

        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-600 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-neutral-400" />
            Documents & deep modules open in their own tabs.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenTab("documents")}>
              Documents
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenTab("clinical-notes")}>
              Notes tab
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
