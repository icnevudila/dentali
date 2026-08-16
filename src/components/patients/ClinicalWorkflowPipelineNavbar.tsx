"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Stethoscope,
  ClipboardList,
  Pill,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  CreditCard,
} from "lucide-react"

interface WorkflowStep {
  stepNumber: number
  title: string
  subtitle: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface ClinicalWorkflowPipelineNavbarProps {
  patientId: string
}

export function ClinicalWorkflowPipelineNavbar({ patientId }: ClinicalWorkflowPipelineNavbarProps) {
  const pathname = usePathname()

  const steps: WorkflowStep[] = [
    {
      stepNumber: 1,
      title: "Diagnosis & Odontogram",
      subtitle: "Dental Charting & Exam",
      href: `/patients/${patientId}/pda-dental-chart`,
      icon: Stethoscope,
    },
    {
      stepNumber: 2,
      title: "Treatment Plan",
      subtitle: "Procedures & Estimate",
      href: `/patients/${patientId}?tab=treatment-plans`,
      icon: ClipboardList,
    },
    {
      stepNumber: 3,
      title: "Rx & Certificates",
      subtitle: "e-Rx & Rest Certificate",
      href: `/patients/${patientId}/prescriptions`,
      icon: Pill,
    },
    {
      stepNumber: 4,
      title: "Lab cases",
      subtitle: "Prosthetic work orders",
      href: `/lab-cases`,
      icon: FlaskConical,
    },
    {
      stepNumber: 5,
      title: "Billing & checkout",
      subtitle: "Invoice & discharge",
      href: `/billing`,
      icon: CreditCard,
    },
  ]

  const getActiveStepIndex = () => {
    if (pathname.includes("/pda-dental-chart")) return 0
    if (pathname.includes("treatment-plans") || pathname.includes("/treatment-plan")) return 1
    if (pathname.includes("/prescriptions") || pathname.includes("/medical-certificate")) return 2
    if (pathname.includes("/lab-cases") || pathname.includes("/ortho")) return 3
    if (pathname.includes("/billing") || pathname.includes("/visits")) return 4
    return 0
  }

  const activeIndex = getActiveStepIndex()

  return (
    <nav className="no-print mb-4 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-neutral-100 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
            {activeIndex + 1}
          </span>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
            Klinik Hasta Muayene İş Akışı (Adım {activeIndex + 1} / 5)
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500">
          <span>Sıradaki Adım:</span>
          <span className="font-bold text-primary-700">
            {steps[(activeIndex + 1) % steps.length].title}
          </span>
        </div>
      </div>

      {/* 5-Step Navbar Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isActive = idx === activeIndex
          const isCompleted = idx < activeIndex

          return (
            <Link
              key={step.stepNumber}
              href={step.href}
              className={`relative flex items-center gap-3 rounded-xl p-2.5 transition-all border text-left group ${
                isActive
                  ? "bg-primary-600 text-white border-primary-600 shadow-sm ring-1 ring-primary-500/20"
                  : isCompleted
                  ? "bg-neutral-50 text-neutral-800 border-neutral-200 hover:bg-neutral-100"
                  : "bg-white text-neutral-500 border-neutral-100 hover:bg-neutral-50"
              }`}
            >
              {/* Step Number Circle */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs shrink-0 transition-colors ${
                  isActive
                    ? "bg-white text-primary-700 shadow-sm"
                    : isCompleted
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : step.stepNumber}
              </div>

              {/* Title & Subtitle */}
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                  <h3 className="text-xs font-bold truncate tracking-tight">{step.title}</h3>
                </div>
                <p
                  className={`text-[10px] truncate ${
                    isActive ? "text-primary-100" : "text-neutral-400"
                  }`}
                >
                  {step.subtitle}
                </p>
              </div>

              {/* Arrow Indicator on active */}
              {idx < steps.length - 1 && (
                <ChevronRight
                  className={`hidden lg:block h-4 w-4 shrink-0 opacity-40 ${
                    isActive ? "text-white opacity-80" : "text-slate-400"
                  }`}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
