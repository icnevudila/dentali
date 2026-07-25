"use client"

import * as React from "react"
import Link from "next/link"
import {
  Pill,
  Search,
  FileText,
  Plus,
  ChevronRight,
  ShieldCheck,
  Clock,
  Printer,
  Sparkles,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DENTAL_PRESCRIPTION_PRESETS } from "@/lib/clinical/prescription-service"

interface PrescriptionSummary {
  id: string
  patientId: string
  patientName: string
  protocolTitle: string
  doctorName: string
  date: string
  status: "signed" | "draft"
  medCount: number
}

const RECENT_CLINIC_PRESCRIPTIONS: PrescriptionSummary[] = [
  {
    id: "rx_101",
    patientId: "p_01",
    patientName: "John Doe",
    protocolTitle: "Acute Dental Pain & Infection Protocol",
    doctorName: "Dr. Jane Smith, DDS",
    date: "2026-07-25",
    status: "signed",
    medCount: 2,
  },
  {
    id: "rx_102",
    patientId: "p_02",
    patientName: "Maria Santos",
    protocolTitle: "Surgical Extraction & Post-Op Implant Protocol",
    doctorName: "Dr. Robert Tan, DMD",
    date: "2026-07-24",
    status: "signed",
    medCount: 3,
  },
  {
    id: "rx_103",
    patientId: "p_03",
    patientName: "Alex Mercer",
    protocolTitle: "Periodontal Infection Protocol",
    doctorName: "Dr. Jane Smith, DDS",
    date: "2026-07-22",
    status: "draft",
    medCount: 2,
  },
]

export default function GlobalPrescriptionsPage() {
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredPrescriptions = RECENT_CLINIC_PRESCRIPTIONS.filter(
    (rx) =>
      rx.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.protocolTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header Container */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200/60">
            <Pill className="h-3.5 w-3.5" />
            <span>Clinical Pharmacology & Rx</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            e-Prescriptions & Clinical Rx Protocols
          </h1>
          <p className="text-xs text-slate-500">
            Manage dental prescriptions, protocol presets, and patient medication records across the clinic.
          </p>
        </div>

        <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-xs">
          <Link href="/patients">
            <Plus className="h-4 w-4" />
            <span>Issue New e-Rx</span>
          </Link>
        </Button>
      </div>

      {/* Preset Clinical Rx Protocol Packs Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Standard Dental Rx Preset Protocols
          </h2>
          <span className="text-xs text-slate-500">3 Verified Clinical Packs</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DENTAL_PRESCRIPTION_PRESETS.map((preset) => (
            <Card key={preset.name} className="border-slate-200 bg-white hover:border-teal-300 transition-colors">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold">
                    {preset.diagnosis}
                  </Badge>
                  <Sparkles className="h-4 w-4 text-teal-600" />
                </div>
                <CardTitle className="text-sm font-bold text-slate-900 mt-2">
                  {preset.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 line-clamp-2">
                  {preset.general_instructions}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 border-t border-slate-100">
                <div className="space-y-1.5 text-xs text-slate-700 mb-3">
                  {preset.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="font-medium text-slate-900">• {item.drug_name} ({item.strength})</span>
                      <span className="text-slate-500 font-mono">{item.frequency}</span>
                    </div>
                  ))}
                </div>

                <Button asChild variant="outline" size="sm" className="w-full text-xs gap-1 border-slate-200 hover:bg-slate-50">
                  <Link href="/patients">
                    <span>Select Patient to Issue</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Clinic Prescriptions Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Issued Clinic Prescriptions History
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Filter by patient, Rx protocol or dentist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 bg-white border-slate-200"
            />
          </div>
        </div>

        <Card className="border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Patient Name</th>
                  <th className="p-3">Rx Protocol / Diagnosis</th>
                  <th className="p-3">Attending Dentist</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                      No prescriptions found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredPrescriptions.map((rx) => (
                    <tr key={rx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span>{rx.patientName}</span>
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {rx.protocolTitle} ({rx.medCount} meds)
                      </td>
                      <td className="p-3 text-slate-600">{rx.doctorName}</td>
                      <td className="p-3 text-slate-500 font-mono">{rx.date}</td>
                      <td className="p-3">
                        {rx.status === "signed" ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Signed & Issued</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Draft</span>
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button asChild size="sm" variant="ghost" className="h-8 text-xs gap-1 text-teal-700 hover:text-teal-800 hover:bg-teal-50">
                          <Link href={`/patients/${rx.patientId}/prescriptions`}>
                            <Printer className="h-3.5 w-3.5" />
                            <span>View / Print</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
