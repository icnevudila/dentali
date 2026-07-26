"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  User,
  Calendar,
  Pill,
  FlaskConical,
  Plus,
  CreditCard,
  Building,
  Command,
  X,
  ChevronRight,
} from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import { searchPatients, type PatientRecord } from "@/lib/patients/patient-service"

interface NavigationItem {
  id: string
  title: string
  subtitle?: string
  category: "Patients" | "Clinical Actions" | "Quick Actions" | "Modules"
  icon: React.ComponentType<{ className?: string }>
  action: () => void
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [patientHits, setPatientHits] = useState<PatientRecord[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const router = useRouter()
  const { activeBranch } = useBranch()
  const searchGen = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const navigateTo = useCallback(
    (path: string) => {
      setIsOpen(false)
      setSearchQuery("")
      setPatientHits([])
      router.push(path)
    },
    [router]
  )

  useEffect(() => {
    if (!isOpen) return
    const q = searchQuery.trim()
    if (q.length < 2 || !activeBranch?.id) {
      setPatientHits([])
      setPatientsLoading(false)
      return
    }
    const gen = ++searchGen.current
    setPatientsLoading(true)
    const timer = window.setTimeout(() => {
      void searchPatients(q, activeBranch.id, { pageSize: 8 }).then(({ data, error }) => {
        if (gen !== searchGen.current) return
        setPatientsLoading(false)
        if (error) {
          setPatientHits([])
          return
        }
        setPatientHits(data)
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchQuery, isOpen, activeBranch?.id])

  const items: NavigationItem[] = [
    {
      id: "nav-patients",
      title: "Patient Directory & Search",
      subtitle: "View and search registered dental patients",
      category: "Modules",
      icon: User,
      action: () => navigateTo("/patients"),
    },
    {
      id: "nav-appointments",
      title: "Appointment Calendar & Schedule",
      subtitle: "Daily and weekly dentist appointments",
      category: "Modules",
      icon: Calendar,
      action: () => navigateTo("/appointments"),
    },
    {
      id: "act-new-patient",
      title: "Register New Dental Patient",
      subtitle: "Fast patient registration and consent onboarding",
      category: "Quick Actions",
      icon: Plus,
      action: () => navigateTo("/patients/new"),
    },
    {
      id: "nav-prescriptions",
      title: "e-Prescriptions & Rx Protocols",
      subtitle: "Dental pain and antibiotic prescription templates",
      category: "Clinical Actions",
      icon: Pill,
      action: () => navigateTo("/prescriptions"),
    },
    {
      id: "nav-lab",
      title: "Dental Laboratory Work Orders",
      subtitle: "Crown, zirconia, and try-in case tracking",
      category: "Clinical Actions",
      icon: FlaskConical,
      action: () => navigateTo("/lab-cases"),
    },
    {
      id: "nav-billing",
      title: "Billing, Invoicing & Payments",
      subtitle: "Payments, patient invoices, and financial overview",
      category: "Modules",
      icon: CreditCard,
      action: () => navigateTo("/billing"),
    },
    {
      id: "nav-branches",
      title: "Branch & Multi-Clinic Management",
      subtitle: "Switch between dental clinic locations",
      category: "Modules",
      icon: Building,
      action: () => navigateTo("/settings/branches"),
    },
  ]

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  const showEmpty =
    filteredItems.length === 0 && patientHits.length === 0 && !patientsLoading

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/30 backdrop-blur-xs transition-all"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3.5">
          <Search className="h-5 w-5 text-teal-600 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient (≥2 letters), procedure or page…"
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none font-medium"
            autoFocus
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
              ESC
            </kbd>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1 bg-white">
          {patientHits.length > 0 ? (
            <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Patients
            </div>
          ) : null}
          {patientHits.map((p) => (
            <button
              key={p.id}
              onClick={() => navigateTo(`/patients/${p.id}`)}
              className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:bg-teal-50/80 group border border-transparent"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {p.first_name} {p.last_name}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[p.patient_number, p.phone].filter(Boolean).join(" · ") || "Open chart"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          ))}
          {patientsLoading ? (
            <p className="px-3 py-2 text-[11px] text-slate-400">Searching patients…</p>
          ) : null}

          {filteredItems.length > 0 && patientHits.length > 0 ? (
            <div className="px-2 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Pages & actions
            </div>
          ) : null}

          {showEmpty ? (
            <div className="p-8 text-center text-xs font-medium text-slate-500">
              No matching clinical results found.
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:bg-teal-50/80 hover:border-teal-200 group border border-transparent"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-800 truncate">
                        {item.title}
                      </h4>
                      {item.subtitle ? (
                        <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200/60">
                      {item.category}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 bg-slate-50 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <Command className="h-3.5 w-3.5 text-teal-600" />
            <span>Dentali Command Search & Spotlight Action Palette</span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Open: <kbd className="font-bold text-slate-700">Ctrl+K</kbd>
            </span>
            <span>
              Close: <kbd className="font-bold text-slate-700">ESC</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
