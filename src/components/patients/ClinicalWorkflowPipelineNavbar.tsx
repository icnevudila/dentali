"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Stethoscope,
  ClipboardList,
  Pill,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
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
      title: "Teşhis & Odontogram",
      subtitle: "Diş Haritası & Muayene",
      href: `/patients/${patientId}/pda-dental-chart`,
      icon: Stethoscope,
    },
    {
      stepNumber: 2,
      title: "Tedavi Planı",
      subtitle: "Prosedür & Maliyet",
      href: `/patients/${patientId}?tab=treatment-plans`,
      icon: ClipboardList,
    },
    {
      stepNumber: 3,
      title: "e-Reçete & Rapor",
      subtitle: "İlaç & İstirahat Belgesi",
      href: `/patients/${patientId}/prescriptions`,
      icon: Pill,
    },
    {
      stepNumber: 4,
      title: "Estetik & Lab",
      subtitle: "Öncesi/Sonrası & VITA",
      href: `/patients/${patientId}/aesthetic-gallery`,
      icon: Sparkles,
    },
    {
      stepNumber: 5,
      title: "Garanti & Çıkış",
      subtitle: "Sertifika & Taburcu",
      href: `/patients/${patientId}/guarantee-certificate/print`,
      icon: ShieldCheck,
    },
  ]

  // Determine current active step index (0-based)
  const getActiveStepIndex = () => {
    if (pathname.includes("/pda-dental-chart")) return 0
    if (pathname.includes("treatment-plans")) return 1
    if (pathname.includes("/prescriptions") || pathname.includes("/medical-certificates")) return 2
    if (pathname.includes("/aesthetic-gallery") || pathname.includes("/ortho")) return 3
    if (pathname.includes("/guarantee-certificate") || pathname.includes("/billing")) return 4
    return 0
  }

  const activeIndex = getActiveStepIndex()

  return (
    <nav className="no-print mb-4 rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-lg border border-slate-200 dark:border-slate-800">
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-black">
            {activeIndex + 1}
          </span>
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Klinik Hasta Muayene İş Akışı (Adım {activeIndex + 1} / 5)
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span>Sıradaki Adım:</span>
          <span className="font-bold text-teal-600 dark:text-teal-400">
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
                  ? "bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-500/20"
                  : isCompleted
                  ? "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700"
                  : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
              }`}
            >
              {/* Step Number Circle */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs shrink-0 transition-colors ${
                  isActive
                    ? "bg-white text-teal-700 shadow-sm"
                    : isCompleted
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
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
                    isActive ? "text-teal-100" : "text-slate-400 dark:text-slate-500"
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
