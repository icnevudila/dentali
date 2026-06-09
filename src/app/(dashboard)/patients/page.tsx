import { PatientSearchBar } from "@/components/patients/PatientSearchBar"
import { PatientTable } from "@/components/patients/PatientTable"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function PatientsPage() {
  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Patient Registry</h1>
          <p className="text-sm text-neutral-500">Manage patient records, demographics, and clinical files.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/patients/new">
            <Plus className="h-4 w-4" />
            New Patient
          </Link>
        </Button>
      </div>

      <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
        <PatientSearchBar />
        <PatientTable />
      </div>
    </div>
  )
}
