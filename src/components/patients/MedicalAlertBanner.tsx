"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import {
  formatMedicalAlertLabel,
  hasMedicalAlerts,
  toMedicalAlertsData,
  type MedicalAlertsData,
} from "@/lib/patients/medical-alerts"

interface MedicalAlertBannerProps {
  patientId?: string
  alerts?: MedicalAlertsData | null
  editHref?: string
  compact?: boolean
  className?: string
  refreshKey?: number
}

export function MedicalAlertBanner({
  patientId,
  alerts: alertsProp,
  editHref,
  compact = false,
  className = "",
  refreshKey = 0,
}: MedicalAlertBannerProps) {
  const [alerts, setAlerts] = React.useState<MedicalAlertsData | null>(alertsProp ?? null)
  const [loading, setLoading] = React.useState(Boolean(patientId && !alertsProp))

  React.useEffect(() => {
    if (alertsProp) {
      setAlerts(alertsProp)
      setLoading(false)
      return
    }
    if (!patientId) return

    setLoading(true)
    getLatestMedicalHistory(patientId).then(({ data }) => {
      setAlerts(data ? toMedicalAlertsData(data) : null)
      setLoading(false)
    })
  }, [patientId, alertsProp, refreshKey])

  if (loading || !hasMedicalAlerts(alerts)) return null

  const label = formatMedicalAlertLabel(alerts!)

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded px-2 py-0.5 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[280px]">{label}</span>
      </span>
    )
  }

  return (
    <div
      role="alert"
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-900">Medical Alert</p>
          <p className="text-sm text-red-800 mt-0.5">{label}</p>
          {alerts!.medications.length > 0 && (
            <p className="text-xs text-red-700/80 mt-1">
              Medications: {alerts!.medications.join(", ")}
            </p>
          )}
        </div>
      </div>
      {editHref && (
        <Button variant="outline" size="sm" className="shrink-0 border-red-200 text-red-800 hover:bg-red-100" asChild>
          <Link href={editHref}>Update History</Link>
        </Button>
      )}
    </div>
  )
}
