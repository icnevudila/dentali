"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  Receipt,
  Stethoscope,
  UserCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type WorkflowStatus = "done" | "active" | "attention" | "upcoming"

type PatientWorkflowStep = {
  id: string
  title: string
  description: string
  status: WorkflowStatus
  href: string
  cta: string
  icon: ComponentType<{ className?: string }>
}

type PatientWorkflowGuideProps = {
  patientId: string
  hasMedicalHistory: boolean
  pendingConsents: number
  upcomingAppointments: number
  activeVisit: boolean
  hasChartFindings: boolean
  treatmentPlansCount: number
  openBalance: number
  patientArrivalHref: string
}

const statusCopy: Record<WorkflowStatus, { label: string; className: string }> = {
  done: {
    label: "Ready",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  active: {
    label: "Active",
    className: "border-primary-200 bg-primary-50 text-primary-800",
  },
  attention: {
    label: "Needs action",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  upcoming: {
    label: "Next",
    className: "border-neutral-200 bg-neutral-50 text-neutral-700",
  },
}

function statusBadge(status: WorkflowStatus) {
  const copy = statusCopy[status]
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", copy.className)}>
      {copy.label}
    </span>
  )
}

export function PatientWorkflowGuide({
  patientId,
  hasMedicalHistory,
  pendingConsents,
  upcomingAppointments,
  activeVisit,
  hasChartFindings,
  treatmentPlansCount,
  openBalance,
  patientArrivalHref,
}: PatientWorkflowGuideProps) {
  const fileReady = hasMedicalHistory && pendingConsents === 0
  const clinicalReady = hasChartFindings || treatmentPlansCount > 0

  const steps: PatientWorkflowStep[] = [
    {
      id: "file",
      title: "1. Patient file",
      description: fileReady
        ? "Registration, medical history, and consent blockers are clear."
        : "Complete medical history and pending consents before treatment starts.",
      status: fileReady ? "done" : "attention",
      href: `/patients/${patientId}?tab=record`,
      cta: "Review file",
      icon: ClipboardList,
    },
    {
      id: "appointment",
      title: "2. Appointment or walk-in arrival",
      description:
        upcomingAppointments > 0
          ? `${upcomingAppointments} open appointment(s). On arrival, front desk checks in from Queue.`
          : "No appointment is required for a walk-in; front desk can send this patient to Waiting from Queue.",
      status: upcomingAppointments > 0 ? "done" : "upcoming",
      href: upcomingAppointments > 0 ? `/patients/${patientId}?tab=appointments` : patientArrivalHref,
      cta: upcomingAppointments > 0 ? "See appointments" : "Open arrival",
      icon: Calendar,
    },
    {
      id: "queue",
      title: "3. Queue and chair handoff",
      description: activeVisit
        ? "This patient has an active visit. Move them through Waiting, Called, In Chair, then Served."
        : "Check-in creates today's visit and puts the patient in Waiting; doctor works from the Dentist board.",
      status: activeVisit ? "active" : "upcoming",
      href: activeVisit ? "/dentist" : patientArrivalHref,
      cta: activeVisit ? "Open dentist board" : "Check in",
      icon: UserCheck,
    },
    {
      id: "clinical",
      title: "4. Dentist work",
      description: clinicalReady
        ? "Chart findings or treatment planning already exists for this patient."
        : "Record dental chart findings, SOAP notes, and plan before closing the visit.",
      status: clinicalReady ? "done" : activeVisit ? "attention" : "upcoming",
      href: `/patients/${patientId}/chart`,
      cta: "Open chart",
      icon: Stethoscope,
    },
    {
      id: "billing",
      title: "5. Billing and payment",
      description:
        openBalance > 0
          ? `Open balance: PHP ${openBalance.toLocaleString()}. Collect or review before closeout.`
          : "No open balance is blocking this patient right now.",
      status: openBalance > 0 ? "attention" : "done",
      href: `/billing?patient=${patientId}`,
      cta: "Open billing",
      icon: Receipt,
    },
    {
      id: "discharge",
      title: "6. Discharge and follow-up",
      description:
        "After treatment, close the visit, print discharge/abstract if needed, then book follow-up or recall.",
      status: activeVisit ? "attention" : "upcoming",
      href: `/patients/${patientId}/epicrisis`,
      cta: "Discharge tools",
      icon: FileCheck2,
    },
  ]

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-primary-600" aria-hidden />
            <h2 className="text-sm font-semibold text-neutral-950">Patient workflow A-Z</h2>
            {activeVisit ? <Badge variant="info">Active visit</Badge> : <Badge variant="outline">No active visit</Badge>}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">
            Reception starts the arrival, Queue creates the visit, Dentist completes clinical work, then billing and discharge close the loop.
          </p>
        </div>
        <Button size="sm" variant={activeVisit ? "outline" : "default"} asChild>
          <Link href={activeVisit ? "/dentist" : patientArrivalHref}>
            {activeVisit ? "Continue visit" : "Start arrival"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <Link
              key={step.id}
              href={step.href}
              className="group rounded-xl border border-neutral-200/80 bg-neutral-50/40 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-500 ring-1 ring-neutral-200 group-hover:text-primary-700">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {statusBadge(step.status)}
              </div>
              <p className="mt-3 text-sm font-semibold text-neutral-950">{step.title}</p>
              <p className="mt-1 min-h-10 text-xs leading-5 text-neutral-600">{step.description}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                {step.cta}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </p>
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-xs text-neutral-600">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        <p>
          Recommended clinic flow: book appointment or accept walk-in - Queue check-in - Waiting/Called/In Chair - notes/chart/plan - invoice/payment - discharge/follow-up.
        </p>
      </div>
    </section>
  )
}
