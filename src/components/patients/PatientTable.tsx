import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

export function PatientTable() {
  // Mock data for MVP UI
  const mockPatients = [
    { id: "P-1001", name: "Maria Garcia", dob: "1985-04-12", phone: "+63 917 123 4567", status: "Active", lastVisit: "2024-05-10" },
    { id: "P-1002", name: "Juan Dela Cruz", dob: "1990-08-23", phone: "+63 918 987 6543", status: "Active", lastVisit: "2024-06-01" },
    { id: "P-1003", name: "Ana Santos", dob: "1978-11-05", phone: "+63 920 555 1234", status: "Inactive", lastVisit: "2023-12-15" },
  ]

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
            <th className="px-4 py-3 font-medium">Patient ID</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Date of Birth</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {mockPatients.map((patient) => (
            <tr key={patient.id} className="hover:bg-neutral-50 transition-colors">
              <td className="px-4 py-3 font-medium text-neutral-900">{patient.id}</td>
              <td className="px-4 py-3 font-medium text-primary-600 cursor-pointer hover:underline">
                {patient.name}
              </td>
              <td className="px-4 py-3 text-neutral-600">{patient.dob}</td>
              <td className="px-4 py-3 text-neutral-600">{patient.phone}</td>
              <td className="px-4 py-3">
                <Badge variant={patient.status === "Active" ? "success" : "default"}>
                  {patient.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
          {mockPatients.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                No patients found. Try adjusting your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
