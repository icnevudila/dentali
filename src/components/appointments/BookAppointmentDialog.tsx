"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createAppointment } from "@/lib/appointments/appointment-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { Calendar } from "lucide-react"

interface BookAppointmentDialogProps {
  patientId: string
  onBooked?: () => void
}

export function BookAppointmentDialog({ patientId, onBooked }: BookAppointmentDialogProps) {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("09:00")
  const [purpose, setPurpose] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !date) return
    setSaving(true)
    setError(null)

    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
    const { error: createError } = await createAppointment({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      scheduledAt,
      purpose,
      userId: user.id,
    })

    setSaving(false)
    if (createError) {
      setError(createError)
      return
    }
    setOpen(false)
    setPurpose("")
    onBooked?.()
  }

  if (!open) {
    return (
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Calendar className="h-4 w-4" /> Book Now
      </Button>
    )
  }

  return (
    <Card className="border-primary-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Book Appointment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Date</label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Time</label>
            <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium">Purpose</label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Consultation, cleaning…" required />
          </div>
          {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Booking…" : "Confirm"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
