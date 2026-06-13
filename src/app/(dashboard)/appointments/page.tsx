"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import {
  createAppointment,
  checkInAppointment,
  fetchAppointments,
  fetchAppointmentsRange,
  rescheduleAppointment,
  updateAppointmentStatus,
  markAppointmentNoShow,
} from "@/lib/appointments/appointment-service"
import {
  fetchAvailableAppointmentSlots,
  fetchBranchProviderAvailability,
  ensureProviderAvailabilityDefaults,
  type AppointmentSlot,
  type ProviderAvailabilityRow,
} from "@/lib/appointments/provider-availability-service"
import { sendAppointmentReminder } from "@/lib/notifications/notification-service"
import { notifyWaitlistOnSlotOpen } from "@/lib/waitlist/waitlist-service"
import { usePermission } from "@/hooks/use-permission"
import { fetchOrgStaff, type StaffMember, addStaffMemberDirectly, fetchRolesList } from "@/lib/staff/staff-service"
import { AppointmentWeekCalendar } from "@/components/appointments/AppointmentWeekCalendar"
import { ProviderAvailabilityPanel } from "@/components/appointments/ProviderAvailabilityPanel"
import {
  startOfWeekMonday,
  toDateKey,
  addDays,
  addDaysToKey,
  buildRescheduledAt,
  parseDateKey,
  formatAppointmentTime,
  appointmentDateKey,
} from "@/lib/appointments/week-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Calendar, Plus, Check, X, LayoutGrid, List, ChevronLeft, ChevronRight, UserCheck, Bell, UserX, MapPin } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"

type ViewMode = "today" | "week"

export default function AppointmentsPage() {
  return (
    <React.Suspense fallback={<PageLoadingSkeleton variant="list" />}>
      <AppointmentsPageContent />
    </React.Suspense>
  )
}

function AppointmentsPageContent() {
  const searchParams = useSearchParams()
  const focusMissingNotes = searchParams.get("focus") === "missing-notes"
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()
  const { hasPermission } = usePermission()
  const canWriteAppts = hasPermission(PERMISSIONS.APPOINTMENTS_WRITE)
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekMonday(new Date()))
  const [selectedDate, setSelectedDate] = React.useState(() => toDateKey(new Date()))
  const [weekAppointments, setWeekAppointments] = React.useState<Awaited<ReturnType<typeof fetchAppointmentsRange>>["data"]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showBook, setShowBook] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("09:00")
  const [purpose, setPurpose] = React.useState("")
  const [booking, setBooking] = React.useState(false)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const [reschedulingId, setReschedulingId] = React.useState<string | null>(null)
  const [checkingInId, setCheckingInId] = React.useState<string | null>(null)
  const [remindingId, setRemindingId] = React.useState<string | null>(null)
  const [reminderNotice, setReminderNotice] = React.useState<string | null>(null)
  const [waitlistNotice, setWaitlistNotice] = React.useState<string | null>(null)
  const [checkInQueueNotice, setCheckInQueueNotice] = React.useState(false)
  const [providers, setProviders] = React.useState<StaffMember[]>([])
  const [selectedProviderId, setSelectedProviderId] = React.useState("")
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [availabilityRows, setAvailabilityRows] = React.useState<ProviderAvailabilityRow[]>([])
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false)

  const today = toDateKey(new Date())

  const loadWeek = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    const start = toDateKey(addDays(weekStart, -15))
    const end = toDateKey(addDays(weekStart, 30))
    fetchAppointmentsRange(activeBranch.id, start, end).then(({ data, error: err }) => {
      setWeekAppointments(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch, weekStart])

  React.useEffect(() => {
    loadWeek()
  }, [loadWeek])

  React.useEffect(() => {
    if (!activeBranch) return
    setAvailabilityLoading(true)
    fetchOrgStaff().then(async ({ data }) => {
      const branchProviders = data.filter(
        (s) => s.is_active && s.branch_names.includes(activeBranch.name)
      )
      setProviders(branchProviders)
      if (branchProviders.length > 0) {
        setSelectedProviderId((prev) => prev || branchProviders[0].profile_id)
      }
      for (const p of branchProviders) {
        await ensureProviderAvailabilityDefaults(activeBranch.id, p.profile_id)
      }
      const { data: rows } = await fetchBranchProviderAvailability(activeBranch.id)
      setAvailabilityRows(rows)
      setAvailabilityLoading(false)
    })
  }, [activeBranch])

  React.useEffect(() => {
    if (!activeBranch || !selectedProviderId || !date) {
      setSlots([])
      return
    }
    setSlotsLoading(true)
    fetchAvailableAppointmentSlots({
      branchId: activeBranch.id,
      providerId: selectedProviderId,
      date,
    }).then(({ data }) => {
      setSlots(data)
      setSlotsLoading(false)
      const firstOpen = data.find((s) => s.available)
      if (firstOpen) setTime(firstOpen.time)
    })
  }, [activeBranch, selectedProviderId, date])


  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) {
      setPatients([])
      return
    }
    const t = setTimeout(() => {
      searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data))
    }, 300)
    return () => clearTimeout(t)
  }, [patientQuery, activeBranch])

  const reload = () => {
    loadWeek()
  }

  const reloadAvailability = React.useCallback(async () => {
    if (!activeBranch) return
    const { data: rows } = await fetchBranchProviderAvailability(activeBranch.id)
    setAvailabilityRows(rows)
  }, [activeBranch])

  const tryNotifyWaitlist = async (slotAt: string) => {
    if (!activeBranch) return
    setWaitlistNotice(null)
    const { data, error: notifyErr } = await notifyWaitlistOnSlotOpen({
      branchId: activeBranch.id,
      slotAt,
    })
    if (notifyErr) {
      setWaitlistNotice(notifyErr)
      return
    }
    if (data && data.notified > 0) {
      const label = data.dry_run ? " (dry run)" : ""
      setWaitlistNotice(
        `${t("appointments.waitlistNotified", "{count} waitlist patient(s) notified{dry}.")
          .replace("{count}", String(data.notified))
          .replace("{dry}", label)}`
      )
    }
  }

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId || !date) return
    setBooking(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setBooking(false)
      return
    }
    const { error: err } = await createAppointment({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      scheduledAt: new Date(`${date}T${time}:00`).toISOString(),
      purpose,
      userId: user.id,
      providerId: selectedProviderId || undefined,
    })
    setBooking(false)
    if (err) setError(err)
    else {
      setShowBook(false)
      setSelectedPatientId("")
      setPurpose("")
      setSelectedDate(date)
      reload()
    }
  }

  const handleReschedule = async (id: string, targetDateKey: string) => {
    const appt = weekAppointments.find((a) => a.id === id)
    if (!appt) return
    setReschedulingId(id)
    setError(null)
    const freedSlotAt = appt.scheduled_at
    const scheduledAt = buildRescheduledAt(appt.scheduled_at, targetDateKey)
    const { error: err } = await rescheduleAppointment(id, scheduledAt)
    setReschedulingId(null)
    if (err) setError(err)
    else {
      setSelectedDate(targetDateKey)
      reload()
      void tryNotifyWaitlist(freedSlotAt)
    }
  }

  const handleStatus = async (id: string, status: string) => {
    const appt =
      weekAppointments.find((a) => a.id === id)
    setUpdatingId(id)

    if (status === "no_show") {
      const { data, error: err } = await markAppointmentNoShow(id)
      setUpdatingId(null)
      if (err) setError(err)
      else {
        reload()
        const slotAt = data?.scheduled_at ?? appt?.scheduled_at
        if (slotAt) void tryNotifyWaitlist(slotAt)
      }
      return
    }

    const { error: err } = await updateAppointmentStatus(id, status)
    setUpdatingId(null)
    if (err) setError(err)
    else {
      reload()
      if (status === "cancelled" && appt?.scheduled_at) {
        void tryNotifyWaitlist(appt.scheduled_at)
      }
    }
  }

  const handleCheckIn = async (appointmentId: string) => {
    setCheckingInId(appointmentId)
    setError(null)
    setReminderNotice(null)
    const { data, error: err } = await checkInAppointment(appointmentId)
    setCheckingInId(null)
    if (err) setError(err)
    else if (data) {
      setError(null)
      setCheckInQueueNotice(true)
      reload()
    }
  }

  const handleSendReminder = async (appointmentId: string) => {
    setRemindingId(appointmentId)
    setError(null)
    setReminderNotice(null)
    const { data, error: err } = await sendAppointmentReminder(appointmentId)
    setRemindingId(null)
    if (err) setError(err)
    else if (data) {
      setReminderNotice(
        data.dry_run
          ? `Reminder logged (dry-run): ${data.body_preview}`
          : `Reminder sent: ${data.body_preview}`
      )
    }
  }

  const metricItems = React.useMemo(() => {
    const todayAppts = weekAppointments.filter((a) => appointmentDateKey(a.scheduled_at) === today)
    const todayTotal = todayAppts.length
    const todayUpcoming = todayAppts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length
    const todayCompleted = todayAppts.filter((a) => a.status === "completed").length

    return [
      {
        label: t("appointments.metricTotal", "Today"),
        value: loading ? "—" : todayTotal,
        hint: t("appointments.todayPrefix", "Today"),
        icon: Calendar,
      },
      {
        label: t("appointments.metricUpcoming", "Upcoming Today"),
        value: loading ? "—" : todayUpcoming,
        hint: t("appointments.metricUpcomingHint", "Scheduled or confirmed"),
        variant: "default" as const,
      },
      {
        label: t("appointments.metricDone", "Completed Today"),
        value: loading ? "—" : todayCompleted,
        hint: t("appointments.metricDoneHint", "Marked done today"),
        variant: "success" as const,
      },
    ]
  }, [weekAppointments, today, loading, t])

  return (
    <PermissionGate permission={PERMISSIONS.APPOINTMENTS_READ}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Calendar}>
            {t("appointments.eyebrow", "Scheduling")} · {t("appointments.title", "Appointments")}
          </SectionEyebrow>

          <PageHeader
            title={t("appointments.title", "Appointments")}
            description={t(
              "appointments.registrySubtitle",
              "Week calendar with daily visits — book, check in, and update status."
            )}
            actions={
            <>
              <WorkflowSettingsLink />
              <Button
                className="gap-2"
                onClick={() => {
                  const next = !showBook
                  setShowBook(next)
                  if (next) {
                    setDate(selectedDate)
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                {showBook ? t("common.cancel", "Cancel") : t("appointments.book", "Book")}
              </Button>
            </>
          }
          />

          {focusMissingNotes ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-950 animate-fade-rise">
              <p className="font-medium">
                {t("appointments.missingNotesTitle", "Completed visits may need clinical notes")}
              </p>
              <p className="mt-1 text-amber-900/80">
                {t(
                  "appointments.missingNotesHint",
                  "Review recent completed appointments and open the patient chart to sign a note for the visit."
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/appointments">{t("billing.clearFilter", "Clear filter")}</Link>
              </Button>
            </div>
          ) : null}

          {activeBranch ? (
            <Badge variant="info" className="gap-1 w-fit font-normal">
              <MapPin className="h-3 w-3" aria-hidden />
              {activeBranch.name}
            </Badge>
          ) : null}

          <MetricStrip items={metricItems} />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        )}
        {checkInQueueNotice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 animate-fade-rise">
            {t("appointments.checkInSuccess", "Patient checked in and added to the queue.")}{" "}
            <Link href="/queue" className="font-medium underline">
              {t("appointments.openQueue", "Open queue board")}
            </Link>
            <button
              type="button"
              className="ml-2 text-emerald-800/70 hover:text-emerald-900"
              onClick={() => setCheckInQueueNotice(false)}
            >
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        ) : null}
        {reminderNotice && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2">
            {reminderNotice}
          </p>
        )}
        {waitlistNotice ? (
          <div className="text-sm text-primary-800 bg-primary-50 border border-primary-200 rounded-md px-4 py-2">
            {waitlistNotice}{" "}
            <Link href="/waitlist" className="font-medium underline">
              {t("appointments.viewWaitlist", "View waitlist")}
            </Link>
          </div>
        ) : null}

        {showBook && (
          <Card className="border-primary-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("appointments.newAppointment", "New Appointment")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBook} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-medium">{t("appointments.searchPatient", "Search patient")}</label>
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder={t("appointments.searchPatientPlaceholder", "Name or phone…")}
                  />
                  {patients.length > 0 && (
                    <ul className="border rounded-md divide-y max-h-32 overflow-y-auto text-sm">
                      {patients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={`w-full text-left px-3 py-2 hover:bg-neutral-50 ${selectedPatientId === p.id ? "bg-primary-50" : ""}`}
                            onClick={() => setSelectedPatientId(p.id)}
                          >
                            {p.first_name} {p.last_name} — {p.phone}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Provider</label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                    required
                  >
                    {providers.length === 0 ? (
                      <option value="">No providers for this branch</option>
                    ) : (
                      providers.map((p) => (
                        <option key={p.profile_id} value={p.profile_id}>
                          {p.full_name ?? p.email ?? "Provider"}
                        </option>
                      ))
                    )}
                  </select>
                  {providers.length === 0 && (
                    <div className="mt-1 space-y-1">
                      <p className="text-[11px] text-amber-700 font-medium">
                        No doctors assigned to this branch yet.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-amber-300 hover:bg-amber-50"
                        onClick={async () => {
                          setError(null)
                          const roleList = await fetchRolesList()
                          const dentistRole = roleList.find((r) => r.name === "dentist")
                          if (!dentistRole) {
                            setError("Dentist role not found in database")
                            return
                          }
                          const { error: directErr } = await addStaffMemberDirectly({
                            email: `dr.santos@${activeBranch?.name.toLowerCase().replace(/\s+/g, "") || "clinic"}.com`,
                            fullName: "Dr. Maria Santos",
                            branchId: activeBranch!.id,
                            roleId: dentistRole.id,
                            specialization: "General Dentistry",
                            phoneNumber: "+63 912 345 6789"
                          })
                          if (directErr) {
                            setError(directErr)
                          } else {
                            // Reload staff/providers
                            const { data: staffData } = await fetchOrgStaff()
                            const branchProviders = staffData.filter(
                              (s) => s.is_active && s.branch_names.includes(activeBranch!.name)
                            )
                            setProviders(branchProviders)
                            if (branchProviders.length > 0) {
                              setSelectedProviderId(branchProviders[0].profile_id)
                            }
                          }
                        }}
                      >
                        ⚡ Quick Add Dentist (Dr. Maria Santos)
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Date</label>
                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-medium">Available slots</label>
                  {slotsLoading ? (
                    <p className="text-xs text-neutral-500">Loading slots…</p>
                  ) : !date || !selectedProviderId ? (
                    <p className="text-xs text-neutral-500">Select provider and date.</p>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-amber-700">No slots — provider may be closed this day.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <Button
                          key={slot.time}
                          type="button"
                          size="sm"
                          variant={time === slot.time ? "default" : "outline"}
                          disabled={!slot.available}
                          onClick={() => setTime(slot.time)}
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium">Purpose</label>
                  <Input required value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit" disabled={booking || !selectedPatientId}>
                    {booking
                      ? t("appointments.booking", "Booking…")
                      : t("appointments.confirmBooking", "Confirm Booking")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowBook(false)}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <PageLoadingSkeleton variant="block" />
        ) : (
          <AppointmentWeekCalendar
            appointments={weekAppointments}
            weekStart={weekStart}
            onWeekChange={(start) => {
              setWeekStart(start)
              setSelectedDate(toDateKey(start))
            }}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onStatusChange={handleStatus}
            onReschedule={canWriteAppts ? handleReschedule : undefined}
            onCheckIn={handleCheckIn}
            onRemind={handleSendReminder}
            updatingId={updatingId}
            reschedulingId={reschedulingId}
            checkingInId={checkingInId}
            remindingId={remindingId}
            dragHint={
              canWriteAppts
                ? t(
                    "appointments.dragRescheduleHint",
                    "Tip: drag a visit onto another day to reschedule (same time)."
                  )
                : undefined
            }
            providers={providers}
          />
        )}

        {!showBook && (
          <ProviderAvailabilityPanel
            rows={availabilityRows}
            loading={availabilityLoading}
            branchId={activeBranch?.id}
            providers={providers.map((p) => ({
              profile_id: p.profile_id,
              name: p.full_name || p.email || "Provider",
            }))}
            canWrite={canWriteAppts}
            onSaved={reloadAvailability}
            defaultCollapsed
          />
        )}
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
