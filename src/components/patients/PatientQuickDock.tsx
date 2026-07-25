"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Pill,
  FileText,
  Sparkles,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"

interface PatientQuickDockProps {
  patientId: string
  patientName?: string
}

export function PatientQuickDock({ patientId, patientName }: PatientQuickDockProps) {
  const pathname = usePathname()

  const quickActions = [
    {
      label: "Odontogram & Tedavi",
      href: `/patients/${patientId}/pda-dental-chart`,
      icon: Stethoscope,
      accent: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    },
    {
      label: "Hızlı e-Reçete Yaz",
      href: `/patients/${patientId}/prescriptions`,
      icon: Pill,
      accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    },
    {
      label: "İstirahat Raporu",
      href: `/patients/${patientId}/medical-certificates`,
      icon: FileText,
      accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    },
    {
      label: "Öncesi/Sonrası Galeri",
      href: `/patients/${patientId}/aesthetic-gallery`,
      icon: Sparkles,
      accent: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    },
    {
      label: "Protez Garanti Belgesi",
      href: `/patients/${patientId}/guarantee-certificate/print`,
      icon: ShieldCheck,
      accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    },
  ]

  return (
    <div className="no-print mb-6 rounded-2xl bg-white dark:bg-slate-900 p-3 shadow-md border border-slate-200/80 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs shadow-sm">
            K
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
              Koltuk Başı Hızlı Klinik Eylem Dock&apos;u
            </h3>
            {patientName && (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Aktif Diş Hastası: <span className="font-bold text-slate-800 dark:text-slate-200">{patientName}</span>
              </p>
            )}
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-full border border-teal-200/60 dark:border-teal-800/60">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
          Koltuk Başı Hızlı Çalışma Modu Aktif
        </span>
      </div>

      {/* Action Buttons Row */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
