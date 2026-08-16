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
      accent: "bg-teal-50 text-teal-700 border-teal-200",
    },
    {
      label: "Issue e-Rx",
      href: `/patients/${patientId}/prescriptions`,
      icon: Pill,
      accent: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      label: "Rest certificates",
      href: `/patients/${patientId}/medical-certificates`,
      icon: FileText,
      accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      label: "Fit-to-work letter",
      href: `/patients/${patientId}/medical-certificate`,
      icon: ScrollText,
      accent: "bg-neutral-50 text-neutral-700 border-neutral-200",
    },
  ]

  return (
    <div className="no-print mb-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-2 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">
            C
          </div>
          <div>
            <h3 className="text-xs font-semibold text-neutral-900">
              Chairside quick actions
            </h3>
            {patientName ? (
              <p className="text-[11px] font-medium text-neutral-500">
                Active patient:{" "}
                <span className="font-semibold text-neutral-800">{patientName}</span>
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
                  ? "bg-primary-600 text-white border-primary-600 shadow-sm"
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
