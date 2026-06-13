"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Edit, FileText, Activity, AlertTriangle, Calendar, Printer, Wallet, Users } from "lucide-react"
import { printCurrentPage } from "@/lib/utils/print"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PatientOdontogramSummary } from "@/components/patients/PatientOdontogramSummary"
import { PatientAvatar } from "@/components/patients/PatientAvatar"
import { ClinicalNotesWorkspace } from "@/components/clinical/ClinicalNotesWorkspace"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { getPatient, type PatientWithContacts } from "@/lib/patients/patient-service"
import { getPatientBalance, type PatientBalance } from "@/lib/billing/invoice-service"
import { ConsentFormsPanel } from "@/components/consent/ConsentFormsPanel"
import { fetchPatientConsents, type PatientConsent } from "@/lib/patients/consent-service"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { fetchPatientAppointments } from "@/lib/appointments/appointment-service"
import { fetchPatientTreatmentPlans, type TreatmentPlanSummary } from "@/lib/clinical/treatment-plan-service"
import { BookAppointmentDialog } from "@/components/appointments/BookAppointmentDialog"
import { MedicalAlertBanner } from "@/components/patients/MedicalAlertBanner"
import { PatientDocumentsPanel } from "@/components/patients/PatientDocumentsPanel"
import { PatientRecordOnePage } from "@/components/patients/PatientRecordOnePage"
import { OrthoRecordSummary } from "@/components/patients/OrthoRecordSummary"
import { fetchPatientTimeline, type TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import { createClient } from "@/lib/supabase/client"
import { useRouteParams } from "@/hooks/use-route-params"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { NAV_BACK_TRANSITION, NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { ClinicalVisitJourneyPanel } from "@/components/clinical/ClinicalVisitJourneyPanel"
import { buildClinicalVisitJourney } from "@/lib/clinical/clinical-visit-journey"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { useBranch } from "@/hooks/use-branch"

const PATIENT_TABS = [
  { id: "record", label: "Patient Record" },
  { id: "medical-history", label: "Medical History" },
  { id: "dental-chart", label: "Dental Chart" },
  { id: "clinical-notes", label: "Clinical Notes" },
  { id: "treatment-plans", label: "Treatment Plans" },
  { id: "orthodontics", label: "Orthodontics" },
  { id: "appointments", label: "Appointments" },
  { id: "consents", label: "Consents & Forms" },
  { id: "documents", label: "Documents" },
] as const

type PatientTabId = (typeof PATIENT_TABS)[number]["id"]

export default function PatientProfilePage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const intakeComplete = searchParams.get("intake") === "complete"
  const activeTab: PatientTabId =
    PATIENT_TABS.some((t) => t.id === tabParam) ? (tabParam as PatientTabId) : "record"

  const setActiveTab = React.useCallback(
    (tabId: PatientTabId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", tabId)
      router.replace(`/patients/${patientId}?${params.toString()}`, { scroll: false })
    },
    [patientId, router, searchParams]
  )
  const [patient, setPatient] = React.useState<PatientWithContacts | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [consents, setConsents] = React.useState<PatientConsent[]>([])
  const [appointments, setAppointments] = React.useState<Awaited<ReturnType<typeof fetchPatientAppointments>>["data"]>([])
  const [treatmentPlans, setTreatmentPlans] = React.useState<TreatmentPlanSummary[]>([])
  const [medicalHistory, setMedicalHistory] = React.useState<{
    allergies: string[]
    medications: string[]
    conditions: string[]
  } | null>(null)
  const [balance, setBalance] = React.useState<PatientBalance | null>(null)
  const [balanceError, setBalanceError] = React.useState<string | null>(null)
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([])
  const [timelineError, setTimelineError] = React.useState<string | null>(null)
  const [hasChartFindings, setHasChartFindings] = React.useState(false)

  const refreshConsents = React.useCallback(() => {
    fetchPatientConsents(patientId).then(({ data }) => setConsents(data))
  }, [patientId])

  const refreshAppointments = React.useCallback(() => {
    fetchPatientAppointments(patientId).then(({ data }) => setAppointments(data))
  }, [patientId])

  React.useEffect(() => {
    if (!patientId) return
    setLoading(true)
    Promise.all([
      getPatient(patientId),
      fetchPatientConsents(patientId),
      fetchPatientAppointments(patientId),
      fetchPatientTreatmentPlans(patientId),
      getLatestMedicalHistory(patientId),
      getPatientBalance(patientId),
      fetchPatientTimeline(patientId),
    ])
      .then(([patientRes, consentsRes, apptsRes, plansRes, medRes, balanceRes, timelineRes]) => {
        setPatient(patientRes.data)
        setLoadError(patientRes.error)
        setConsents(consentsRes.data)
        setAppointments(apptsRes.data)
        setTreatmentPlans(plansRes.data)
        if (medRes.data) {
          setMedicalHistory({
            allergies: medRes.data.allergies,
            medications: medRes.data.medications,
            conditions: medRes.data.conditions,
          })
        } else {
          setMedicalHistory(null)
        }
        setBalance(balanceRes.data)
        setBalanceError(balanceRes.error)
        setTimeline(timelineRes.data)
        setTimelineError(timelineRes.error)
        setLoading(false)
      })
      .catch((err: any) => {
        setLoadError(err?.message || "Failed to load patient profile")
        setLoading(false)
      })
  }, [patientId])

  React.useEffect(() => {
    if (!patientId || !activeBranch?.id) return
    getPatientOdontogram(patientId, activeBranch.id).then(({ data }) => {
      const findings = data?.findings ?? []
      setHasChartFindings(
        findings.some(
          (f) =>
            f.status === "active" &&
            ((f.condition && f.condition !== "present") ||
              Boolean(f.restoration_type) ||
              Boolean(f.surgery_type))
        )
      )
    })
  }, [patientId, activeBranch?.id])

  React.useEffect(() => {
    if (!patientId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`patient-consents-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_consents",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          refreshConsents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId, refreshConsents])

  if (loading) {
    return <PageLoadingSkeleton variant="detail" className="max-w-7xl px-4 py-8" />
  }

  if (loadError || !patient) {
    return (
      <ContentPanel className="mx-auto max-w-7xl py-14 text-center">
        <p className="text-red-800">{loadError ?? "Patient not found"}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/patients" transitionTypes={NAV_BACK_TRANSITION}>
            Back to registry
          </Link>
        </Button>
      </ContentPanel>
    )
  }

  const fullName = `${patient.first_name} ${patient.last_name}`
  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase()
  const pendingConsents = consents.filter((c) => c.status === "pending").length
  const upcomingAppointments = appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "completed"
  ).length

  const visitJourney = buildClinicalVisitJourney({
    patientId,
    patient,
    medicalHistory,
    consents,
    appointments,
    treatmentPlans,
    balance,
    timeline,
    hasChartFindings,
  })

  const profileMetrics = [
    {
      label: "Appointments",
      value: upcomingAppointments,
      hint: `${appointments.length} total on record`,
      icon: Calendar,
    },
    {
      label: "Treatment plans",
      value: treatmentPlans.length,
      hint: treatmentPlans.filter((p) => p.status === "proposed").length
        ? `${treatmentPlans.filter((p) => p.status === "proposed").length} proposed`
        : "Clinical planning",
      icon: FileText,
    },
    {
      label: "Balance",
      value: balance ? `₱${balance.open_balance.toLocaleString()}` : balanceError ? "—" : "₱0",
      hint: balanceError ?? (balance && balance.open_balance > 0 ? "Outstanding" : "Settled"),
      variant: balance && balance.open_balance > 0 ? ("warning" as const) : ("default" as const),
      href: balance && balance.open_balance > 0 ? `/billing?patient=${patientId}` : undefined,
    },
    {
      label: "Consents",
      value: pendingConsents,
      hint: pendingConsents > 0 ? "Awaiting signature" : `${consents.length} on file`,
      variant: pendingConsents > 0 ? ("warning" as const) : ("success" as const),
      href: `/patients/${patientId}?tab=consents`,
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_READ}>
    <DirectionalTransition className="space-y-6 pb-10 flex flex-col h-full max-w-7xl mx-auto">
      <SectionEyebrow icon={Users}>Clinical · Patient profile</SectionEyebrow>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link href="/patients" transitionTypes={NAV_BACK_TRANSITION}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PatientAvatar patientId={patientId} initials={initials} editable size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950">{fullName}</h1>
              <Badge variant={patient.status === "active" ? "success" : "default"}>{patient.status}</Badge>
              {balance && balance.open_balance > 0 && (
                <Link href={`/billing?patient=${patientId}`}>
                  <Badge variant="warning" className="gap-1 cursor-pointer">
                    <Wallet className="h-3 w-3 inline" />
                    ₱{balance.open_balance.toLocaleString()} due
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-sm text-neutral-500">
              ID: {patient.id.slice(0, 8)} • {patient.date_of_birth ?? "—"} • {patient.gender ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={`/patients/${patientId}/chart`} transitionTypes={NAV_FORWARD_TRANSITION}>
              <Activity className="h-4 w-4" /> Chart
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={`/patients/${patientId}?tab=consents`} transitionTypes={NAV_FORWARD_TRANSITION}>
              <FileText className="h-4 w-4" /> Consents
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => printCurrentPage({ title: `Patient — ${patient.first_name} ${patient.last_name}` })}>
            <Printer className="h-4 w-4"/> Print
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link href={`/patients/${patientId}/edit`} transitionTypes={NAV_FORWARD_TRANSITION}>
              <Edit className="h-4 w-4"/> Edit Profile
            </Link>
          </Button>
          <BookAppointmentDialog patientId={patientId} onBooked={refreshAppointments} />
        </div>
      </div>

      <MetricStrip items={profileMetrics} />

      <ClinicalVisitJourneyPanel journey={visitJourney} />

      {intakeComplete ? (
        <ContentPanel className="border-primary-200/80 bg-primary-50/40">
          <p className="text-sm font-medium text-primary-900">Patient registered — complete the chart file</p>
          <p className="mt-1 text-sm text-primary-800/90">
            Add medical history and sign consents before the first visit check-in.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href={`/patients/${patientId}/medical-history`}>Medical history</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/patients/${patientId}?tab=consents`}>Sign consents</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/appointments?patient=${patientId}`}>Book appointment</Link>
            </Button>
          </div>
        </ContentPanel>
      ) : null}

      <MedicalAlertBanner
        alerts={
          medicalHistory
            ? { allergies: medicalHistory.allergies, conditions: medicalHistory.conditions, medications: medicalHistory.medications }
            : null
        }
        editHref={`/patients/${patientId}/medical-history`}
      />

      {/* TWO-COLUMN SIDEBAR & CONTENT LAYOUT */}
      <div className="flex flex-col md:flex-row gap-6 items-start mt-4">
        {/* SIDEBAR TABS NAVIGATION */}
        <aside className="w-full md:w-60 shrink-0">
          {/* Mobile dropdown selector */}
          <div className="md:hidden">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 block">
              Menu Tab
            </label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as PatientTabId)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PATIENT_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop sidebar list */}
          <nav className="hidden md:flex flex-col gap-1 border-r border-neutral-200 pr-6 w-full">
            {PATIENT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* TAB CONTENT PANEL */}
        <div className="flex-1 w-full min-w-0">
          {activeTab === "record" && (
            <PatientRecordOnePage
              patientId={patientId}
              patient={patient}
              consents={consents}
              appointments={appointments}
              treatmentPlans={treatmentPlans}
              medicalHistory={medicalHistory}
              balance={balance}
              balanceError={balanceError}
              timeline={timeline}
              timelineError={timelineError}
              onConsentsChange={refreshConsents}
              onAppointmentsChange={refreshAppointments}
              onOpenTab={(tabId) => setActiveTab(tabId as PatientTabId)}
            />
          )}

          {/* CONSENTS TAB */}
          {activeTab === "consents" && (
            <Card>
              <CardHeader>
                <CardTitle>Consent Forms & Legal Documents</CardTitle>
                <CardDescription>
                  Clinic paper forms (DRG / PDA). Fill at the desk or send a patient link — then export PDF or Word.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConsentFormsPanel
                  patientId={patientId}
                  consents={consents}
                  onConsentsChange={refreshConsents}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "documents" && <PatientDocumentsPanel patientId={patientId} />}

          {/* MEDICAL HISTORY TAB */}
          {activeTab === "medical-history" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle>Medical Conditions & Allergies</CardTitle>
                    <CardDescription>Patient's self-reported medical history.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/patients/${patientId}/medical-history`} transitionTypes={NAV_FORWARD_TRANSITION}>
                      Update History
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 mt-4">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-neutral-900 border-b pb-2">Allergies</h4>
                    <ul className="space-y-2">
                      {(medicalHistory?.allergies ?? []).length === 0 ? (
                        <li className="text-sm text-neutral-500">None recorded</li>
                      ) : (
                        medicalHistory!.allergies.map((a) => (
                          <li key={a} className="flex items-center gap-2 text-sm text-neutral-700">
                            <AlertTriangle className="h-4 w-4 text-danger-500" /> {a}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-neutral-900 border-b pb-2">Chronic Conditions</h4>
                    <ul className="space-y-2">
                      {(medicalHistory?.conditions ?? []).length === 0 ? (
                        <li className="text-sm text-neutral-500">None recorded</li>
                      ) : (
                        medicalHistory!.conditions.map((c) => (
                          <li key={c} className="flex items-center gap-2 text-sm text-neutral-700">
                            <Activity className="h-4 w-4 text-primary-500" /> {c}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* DENTAL CHART TAB */}
          {activeTab === "dental-chart" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Clinical Odontogram</CardTitle>
                  <CardDescription>Interactive representation of tooth conditions.</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/patients/${patientId}/chart`} transitionTypes={NAV_FORWARD_TRANSITION}>
                    Open Full Chart
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <PatientOdontogramSummary patientId={patientId} />
              </CardContent>
            </Card>
          )}

          {/* CLINICAL NOTES TAB */}
          {activeTab === "clinical-notes" && (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Visit Timeline & Notes</CardTitle>
                  <CardDescription>SOAP notes, signed records, and appointment history.</CardDescription>
                </div>
                <Button size="sm" className="gap-2 shrink-0" asChild>
                  <Link href={`/patients/${patientId}/notes`} transitionTypes={NAV_FORWARD_TRANSITION}>
                    <FileText className="h-4 w-4" /> Open Timeline
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ClinicalNotesWorkspace
                  patientId={patientId}
                  patientName={fullName}
                  embedded
                />
              </CardContent>
            </Card>
          )}

          {/* ORTHODONTICS TAB */}
          {activeTab === "orthodontics" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Orthodontic Treatment Record</CardTitle>
                  <CardDescription>Adjustment log, next visits, and payment balance.</CardDescription>
                </div>
                <Button size="sm" className="gap-2" asChild>
                  <Link href={`/patients/${patientId}/ortho`} transitionTypes={NAV_FORWARD_TRANSITION}>
                    <Activity className="h-4 w-4" /> Open Ortho Record
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <OrthoRecordSummary patientId={patientId} />
              </CardContent>
            </Card>
          )}

          {/* TREATMENT PLANS TAB */}
          {activeTab === "treatment-plans" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Proposed Treatments</CardTitle>
                  <CardDescription>Active and historical treatment plans.</CardDescription>
                </div>
                <Button size="sm" className="gap-2" asChild>
                  <Link href={`/patients/${patientId}/treatment-plan`} transitionTypes={NAV_FORWARD_TRANSITION}>
                    <FileText className="h-4 w-4" /> Create Plan
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-neutral-700">Plan Name</th>
                        <th className="px-4 py-3 font-medium text-neutral-700">Date Created</th>
                        <th className="px-4 py-3 font-medium text-neutral-700">Total Cost</th>
                        <th className="px-4 py-3 font-medium text-neutral-700">Status</th>
                        <th className="px-4 py-3 font-medium text-right text-neutral-700">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {treatmentPlans.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No treatment plans yet.</td>
                        </tr>
                      ) : (
                        treatmentPlans.map((plan) => (
                          <tr key={plan.id} className="hover:bg-neutral-50">
                            <td className="px-4 py-3 font-medium text-neutral-900">{plan.title}</td>
                            <td className="px-4 py-3 text-neutral-600">{new Date(plan.created_at).toLocaleDateString("en-PH")}</td>
                            <td className="px-4 py-3 text-neutral-900">₱{Number(plan.total_estimated).toLocaleString()}</td>
                            <td className="px-4 py-3"><Badge variant={plan.status === "completed" ? "success" : "warning"}>{plan.status}</Badge></td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link
                                  href={`/patients/${patientId}/treatment-plan?plan=${plan.id}`}
                                  transitionTypes={NAV_FORWARD_TRANSITION}
                                >
                                  View
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* APPOINTMENTS TAB */}
          {activeTab === "appointments" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Appointment History</CardTitle>
                  <CardDescription>Past and upcoming visits.</CardDescription>
                </div>
                <BookAppointmentDialog patientId={patientId} onBooked={refreshAppointments} />
              </CardHeader>
              <CardContent>
                <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-neutral-700">Date & Time</th>
                        <th className="px-4 py-3 font-medium text-neutral-700">Purpose</th>
                        <th className="px-4 py-3 font-medium text-neutral-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {appointments.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">No appointments scheduled.</td>
                        </tr>
                      ) : (
                        appointments.map((appt) => (
                          <tr key={appt.id} className="hover:bg-neutral-50">
                            <td className="px-4 py-3 font-medium text-neutral-900">
                              {new Date(appt.scheduled_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                            </td>
                            <td className="px-4 py-3 text-neutral-600">{appt.purpose ?? "—"}</td>
                            <td className="px-4 py-3"><Badge variant={appt.status === "completed" ? "success" : "info"}>{appt.status}</Badge></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DirectionalTransition>
    </PermissionGate>
  )
}
