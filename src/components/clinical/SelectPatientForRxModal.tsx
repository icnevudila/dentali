"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, User, X, Pill, ArrowRight, Phone, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { searchPatients, type PatientRecord } from "@/lib/patients/patient-service"
import { useBranch } from "@/hooks/use-branch"

interface SelectPatientForRxModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPresetName?: string | null
  selectedPresetDiagnosis?: string | null
}

export function SelectPatientForRxModal({
  isOpen,
  onClose,
  selectedPresetName,
  selectedPresetDiagnosis,
}: SelectPatientForRxModalProps) {
  const router = useRouter()
  const { activeBranch } = useBranch()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [patients, setPatients] = React.useState<PatientRecord[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) return
    let isCancelled = false
    setLoading(true)
    searchPatients(searchQuery, activeBranch?.id ?? null, {
      pageSize: 20,
    }).then(({ data }) => {
      if (!isCancelled) {
        setPatients(data || [])
        setLoading(false)
      }
    })
    return () => {
      isCancelled = true
    }
  }, [isOpen, searchQuery, activeBranch?.id])

  if (!isOpen) return null

  const handleSelectPatient = (patientId: string) => {
    onClose()
    const presetParam = selectedPresetName ? `?preset=${encodeURIComponent(selectedPresetName)}` : ""
    router.push(`/patients/${patientId}/prescriptions${presetParam}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/30 backdrop-blur-xs transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Select Patient for e-Prescription
              </h3>
            </div>
            {selectedPresetName ? (
              <p className="text-xs text-slate-500 font-medium">
                Protocol: <span className="text-teal-700 font-semibold">{selectedPresetName}</span>
                {selectedPresetDiagnosis ? ` (${selectedPresetDiagnosis})` : ""}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Search and select a patient to open their prescription editor
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              autoFocus
              placeholder="Search by patient name, phone number, or patient ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 bg-white border-slate-200 focus:border-teal-500"
            />
          </div>
        </div>

        {/* Patients List */}
        <div className="max-h-[320px] overflow-y-auto p-2 space-y-1 bg-white">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              Loading clinic patients...
            </div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-medium">
              No patients found matching "{searchQuery}".
            </div>
          ) : (
            patients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => handleSelectPatient(patient.id)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-teal-50/70 border border-transparent hover:border-teal-200 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-800 truncate">
                      {patient.first_name} {patient.last_name}
                    </h4>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      {patient.patient_number ? (
                        <span>ID: <strong className="font-mono text-slate-700">{patient.patient_number}</strong></span>
                      ) : null}
                      {patient.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {patient.phone}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-teal-700 group-hover:bg-teal-600 group-hover:text-white shrink-0">
                  <span>Issue e-Rx</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 bg-slate-50 text-[11px] text-slate-500 font-medium">
          <span>Select patient to immediately pre-fill & issue prescription</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-[11px] border-slate-200">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
