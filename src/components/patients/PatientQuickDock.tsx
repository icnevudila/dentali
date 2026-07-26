"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Pill, FileText, Stethoscope, ScrollText } from "lucide-react"

interface PatientQuickDockProps {
  patientId: string
  patientName?: string
}

export function PatientQuickDock({ patientId, patientName }: PatientQuickDockProps) {
  const pathname = usePathname()

  const quickActions = [
    {
      label: "Odontogram & Charting",
      href: `/patients/${patientId}/pda-dental-chart`,
      icon: Stethoscope,
      accent: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    },
    {
      label: "Issue e-Rx",
      href: `/patients/${patientId}/prescriptions`,
      icon: Pill,
      accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    },
    {
      label: "Rest certificates",
      href: `/patients/${patientId}/medical-certificates`,
      icon: FileText,
      accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    },
    {
      label: "Fit-to-work letter",
      href: `/patients/${patientId}/medical-certificate`,
      icon: ScrollText,
      accent: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    },
  ]

  return (
    <div className="no-print mb-6 rounded-2xl bg-white dark:bg-slate-900 p-3 shadow-md border border-slate-200/80 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs shadow-sm">
            C
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
              Chairside quick actions
            </h3>
            {patientName ? (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Active patient:{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">{patientName}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon
          const isActive = pathname.startsWith(action.href)
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center gap-2.5 rounded-xl p-2.5 transition-all border text-xs font-bold ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-md dark:bg-teal-600 dark:border-teal-600"
                  : `${action.accent} hover:shadow-sm hover:scale-[1.01]`
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{action.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
