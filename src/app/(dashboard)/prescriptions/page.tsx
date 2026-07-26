"use client"

import * as React from "react"
import Link from "next/link"
import {
  Pill,
  Search,
  Plus,
  ChevronRight,
  ShieldCheck,
  Clock,
  Printer,
  User,
  Ban,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip, type MetricItem } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import {
  DENTAL_PRESCRIPTION_PRESETS,
  fetchBranchPrescriptions,
  type BranchPrescriptionSummary,
} from "@/lib/clinical/prescription-service"
import { SelectPatientForRxModal } from "@/components/clinical/SelectPatientForRxModal"
import { EmptyState } from "@/components/ui/empty-state"

function patientLabel(rx: BranchPrescriptionSummary) {
  const name = [rx.patient_first_name, rx.patient_last_name].filter(Boolean).join(" ").trim()
  return name || "Patient"
}

export default function GlobalPrescriptionsPage() {
  const { activeBranch, hasActiveBranch } = useBranch()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedPreset, setSelectedPreset] = React.useState<{ name: string; diagnosis: string } | null>(null)
  const [rows, setRows] = React.useState<BranchPrescriptionSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useEffectEvent(async () => {
    if (!activeBranch?.id) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchBranchPrescriptions(activeBranch.id)
    if (err) setError(err)
    setRows(data)
    setLoading(false)
  })

  React.useEffect(() => {
    if (!hasActiveBranch || !activeBranch?.id) {
      setLoading(false)
      setRows([])
      return
    }
    void load()
  }, [activeBranch?.id, hasActiveBranch])

  const openModalWithPreset = (preset?: { name: string; diagnosis: string }) => {
    setSelectedPreset(preset ?? null)
    setModalOpen(true)
  }

  const filtered = rows.filter((rx) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    const hay = [
      patientLabel(rx),
      rx.diagnosis ?? "",
      rx.prescriber_name ?? "",
      rx.status,
    ]
      .join(" ")
      .toLowerCase()
    return hay.includes(q)
  })

  const metrics: MetricItem[] = [
    {
      label: "Recent e-Rx",
      value: String(rows.length),
      hint: "This branch (latest batch)",
    },
    {
      label: "Signed",
      value: String(rows.filter((r) => r.status === "signed").length),
      hint: "Signed by dentist",
    },
    {
      label: "Preset protocols",
      value: String(DENTAL_PRESCRIPTION_PRESETS.length),
      hint: "Standard dental packs",
    },
    {
      label: "Draft / voided",
      value: String(rows.filter((r) => r.status === "draft" || r.status === "voided").length),
      hint: "Needs attention",
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.PRESCRIPTIONS_READ}>
      <div className="space-y-6">
        <SelectPatientForRxModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedPresetName={selectedPreset?.name}
          selectedPresetDiagnosis={selectedPreset?.diagnosis}
        />

        <PageHeader
          eyebrow={<SectionEyebrow icon={Pill}>CLINICAL · e-PRESCRIPTIONS</SectionEyebrow>}
          title="e-Prescriptions"
          description="Branch prescription history and protocol presets. Issue Rx from a patient record."
          actions={
            <Button
              onClick={() => openModalWithPreset()}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Issue new e-Rx</span>
            </Button>
          }
        />

        <MetricStrip items={metrics} />

        <ContentPanel>
          <div className="mb-4 space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Standard dental Rx presets
            </h2>
            <p className="text-xs text-slate-500">
              Templates for acute pain, surgical post-op, and periodontal infection — pick a patient to apply.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DENTAL_PRESCRIPTION_PRESETS.map((preset) => (
              <Card
                key={preset.name}
                className="border-slate-200 bg-white hover:border-teal-300 transition-colors shadow-xs"
              >
                <CardHeader className="p-4 pb-2">
                  <Badge
                    variant="outline"
                    className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold w-fit"
                  >
                    {preset.diagnosis}
                  </Badge>
                  <CardTitle className="text-sm font-bold text-slate-900 mt-2">{preset.name}</CardTitle>
                  <CardDescription className="text-xs text-slate-500 line-clamp-2">
                    {preset.general_instructions}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5 text-xs text-slate-700 mb-3">
                    {preset.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] gap-2">
                        <span className="font-medium text-slate-900">
                          • {item.drug_name} ({item.strength})
                        </span>
                        <span className="text-slate-500 font-mono shrink-0">{item.frequency}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => openModalWithPreset(preset)}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1 border-slate-200 hover:bg-slate-50 text-teal-700 hover:text-teal-800 font-semibold cursor-pointer"
                  >
                    <span>Select patient to issue</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </ContentPanel>

        <ContentPanel>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Branch prescription history
              </h2>
              <p className="text-xs text-slate-500">Live records for this clinic branch — no sample data.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Filter by patient, diagnosis, or dentist…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-white border-slate-200"
              />
            </div>
          </div>

          {loading ? (
            <PageLoadingSkeleton variant="list" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Could not load prescriptions</p>
              <p className="mt-1 text-xs">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Pill}
              title={rows.length === 0 ? "No prescriptions yet" : "No matches"}
              description={
                rows.length === 0
                  ? "Issue an e-Rx from a patient record or use a protocol preset above."
                  : "Try a different search term."
              }
              action={
                rows.length === 0 ? (
                  <Button size="sm" onClick={() => openModalWithPreset()}>
                    Issue new e-Rx
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card className="border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-3">Patient</th>
                      <th className="p-3">Diagnosis</th>
                      <th className="p-3">Dentist</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((rx) => (
                      <tr key={rx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span>{patientLabel(rx)}</span>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {rx.diagnosis || "—"}
                          {typeof rx.item_count === "number" ? (
                            <span className="text-slate-500"> ({rx.item_count} meds)</span>
                          ) : null}
                        </td>
                        <td className="p-3 text-slate-600">{rx.prescriber_name || "—"}</td>
                        <td className="p-3 text-slate-500 font-mono">
                          {rx.created_at.slice(0, 10)}
                        </td>
                        <td className="p-3">
                          {rx.status === "signed" ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-semibold">
                              <ShieldCheck className="h-3 w-3" />
                              Signed
                            </Badge>
                          ) : rx.status === "voided" ? (
                            <Badge
                              variant="outline"
                              className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1 font-semibold"
                            >
                              <Ban className="h-3 w-3" />
                              Voided
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1 font-semibold"
                            >
                              <Clock className="h-3 w-3" />
                              Draft
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1 text-teal-700 hover:text-teal-800 hover:bg-teal-50 font-semibold"
                          >
                            <Link href={`/patients/${rx.patient_id}/prescriptions`}>
                              <Printer className="h-3.5 w-3.5" />
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </ContentPanel>
      </div>
    </PermissionGate>
  )
}
