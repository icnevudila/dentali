"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Printer, Save, AlertCircle, History, Download } from "lucide-react"
import { printCurrentPage } from "@/lib/utils/print"

interface PatientChartHeaderProps {
  patientName: string
  hasUnsavedChanges: boolean
  onSaveChart?: () => void
  onExportPng?: () => void | Promise<void>
  isSaving: boolean
  isExporting?: boolean
  lastUpdated?: string | null
  onOpenHistory?: () => void
  alertLabel?: string | null
}

export function PatientChartHeader({
  patientName,
  hasUnsavedChanges,
  onSaveChart,
  onExportPng,
  isSaving,
  isExporting = false,
  lastUpdated,
  onOpenHistory,
  alertLabel,
}: PatientChartHeaderProps) {
  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-neutral-200 p-4 rounded-xl shadow-sm mb-6">
      
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Dental Chart - {patientName}</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {alertLabel && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertCircle className="w-3 h-3 mr-1" /> {alertLabel}
            </Badge>
          )}
          {lastUpdatedLabel && (
            <span className="text-xs text-neutral-500 font-medium">Last updated: {lastUpdatedLabel}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {hasUnsavedChanges && (
          <span className="text-sm font-medium text-amber-600 mr-2 flex items-center">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse"></span>
            Unsaved Changes
          </span>
        )}
        {onOpenHistory && (
          <Button variant="outline" size="sm" onClick={onOpenHistory} className="gap-2">
            <History className="w-4 h-4" /> History
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => printCurrentPage({ title: `Dental Chart — ${patientName}` })} className="gap-2">
          <Printer className="w-4 h-4" /> Print
        </Button>
        {onExportPng && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onExportPng()}
            disabled={isExporting}
            className="gap-2"
            data-testid="chart-export-png-btn"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "Exporting…" : "Download PNG"}
          </Button>
        )}
        {onSaveChart && (
          <Button
            size="sm"
            onClick={onSaveChart}
            disabled={!hasUnsavedChanges || isSaving}
            className="gap-2"
            data-testid="chart-commit-btn"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Commit Chart"}
          </Button>
        )}
      </div>

    </div>
  )
}
