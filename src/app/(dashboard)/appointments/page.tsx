"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import { callAppointmentToServe } from "@/lib/queue/queue-service"
import {
  createAppointment,
  checkInAppointment,
  fetchAppointments,
  fetchAppointmentsRange,
  rescheduleAppointment,
  updateAppointmentStatus,
  markAppointmentNoShow,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import { notify } from "@/lib/ui/notify"
import { PageErrorNotifier } from "@/components/ui/PageErrorNotifier"
import {
  fetchPreparedAppointmentSlots,
  manilaScheduledAtIso,
  pickDefaultSlotTime,
} from "@/lib/appointments/appointment-slots"
import {
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
import { AppointmentEditDialog } from "@/components/appointments/AppointmentEditDialog"
import { AppointmentSlotButtons } from "@/components/appointments/AppointmentSlotButtons"
import { getPatientBillingGate, type PatientBillingGate } from "@/lib/billing/invoice-service"
import { PatientBillingGateBanner } from "@/components/billing/PatientBillingGateBanner"
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
import { Calendar, Plus, Check, X, LayoutGrid, List, ChevronLeft, ChevronRight, UserCheck, Bell, UserX, MapPin, Globe } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip, type MetricItem } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { useOperationalRefresh } from "@/hooks/use-operational-refresh"
import { resolveBookingSource } from "@/lib/appointments/booking-source"
import type { BookingSource } from "@/lib/appointments/booking-source"

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
  const router = useRouter()
  const focusMissingNotes = searchParams.get("focus") === "missing-notes"
  const sourceParam = searchParams.get("source")
  const bookingSourceFilter: BookingSource | null =
    sourceParam === "portal" || sourceParam === "kiosk" || sourceParam === "walk_in" || sourceParam === "phone"
      ? sourceParam
      : null
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()
  const { hasPermission } = usePermission()
  const canWriteAppts = hasPermission(PERMISSIONS.APPOINTMENTS_WRITE)
  const canCheckIn =
    hasPermission(PERMISSIONS.QUEUE_MANAGE) || hasPermission(PERMISSIONS.APPOINTMENTS_WRITE)
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
  const [callingToServeId, setCallingToServeId] = React.useState<string | null>(null)
  const [remindingId, setRemindingId] = React.useState<string | null>(null)
  const [reminderNotice, setReminderNotice] = React.useState<string | null>(null)
  const [waitlistNotice, setWaitlistNotice] = React.useState<string | null>(null)
  const [checkInQueueNotice, setCheckInQueueNotice] = React.useState(false)
  const [providers, setProviders] = React.useState<StaffMember[]>([])
  const [selectedProviderId, setSelectedProviderId] = React.useState("")
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingAppt, setEditingAppt] = React.useState<AppointmentRecord | null>(null)
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [bookingBillingGate, setBookingBillingGate] = React.useState<PatientBillingGate | null>(null)
  const [forceBillingOverride, setForceBillingOverride] = React.useState(false)
  const [availabilityRows, setAvailabilityRows] = React.useState<ProviderAvailabilityRow[]>([])
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false)

  const today = toDateKey(new Date())

  const setBookingSourceFilter = React.useCallback(
    (source: BookingSource | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!source) params.delete("source")
      else params.set("source", source)
      const qs = params.toString()
      router.replace(qs ? `/appointments?${qs}` : "/appointments", { scroll: false })
    },
    [router, searchParams]
  )

  const filteredWeekAppointments = React.useMemo(() => {
    if (!bookingSourceFilter) return weekAppointments
    return weekAppointments.filter((a) => resolveBookingSource(a) === bookingSourceFilter)
  }, [weekAppointments, bookingSourceFilter])

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

  useOperationalRefresh(["appointments"], loadWeek)

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
    void fetchPreparedAppointmentSlots({
      branchId: activeBranch.id,
      providerId: selectedProviderId,
      date,
    }).then(({ data, error: slotError }) => {
      setSlots(data)
      setSlotsLoading(false)
      if (slotError) notify.error(slotError)
      setTime((prev) => pickDefaultSlotTime(data, prev))
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

  React.useEffect(() => {
    if (!selectedPatientId) {
      setBookingBillingGate(null)
      setForceBillingOverride(false)
      return
    }
    getPatientBillingGate(selectedPatientId).then(({ data }) => setBookingBillingGate(data))
    setForceBillingOverride(false)
  }, [selectedPatientId])

  const patchAppointment = React.useCallback((id: string, patch: Partial<AppointmentRecord>) => {
    setWeekAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }, [])

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
      scheduledAt: manilaScheduledAtIso(date, time),
      purpose,
      userId: user.id,
      providerId: selectedProviderId || undefined,
      forceBillingOverride,
    })
    setBooking(false)
    if (err) {
      notify.error(err)
      setError(err)
    } else {
      notify.success(t("appointments.bookingSuccess", "Appointment created successfully"))
      setShowBook(false)
      setSelectedPatientId("")
      setPurpose("")
      setSelectedDate(date)
      void loadWeek()
    }
  }

  const handleEditSaved = (updated: AppointmentRecord) => {
    patchAppointment(updated.id, updated)
    setSelectedDate(appointmentDateKey(updated.scheduled_at))
    void loadWeek()
  }

  const openEditDialog = (appt: AppointmentRecord) => {
    setEditingAppt(appt)
    setEditDialogOpen(true)
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
    if (err) {
      notify.error(err)
    } else {
      notify.success(
        t("appointments.rescheduleSuccess", "Appointment rescheduled successfully") +
          ` · ${targetDateKey}`
      )
      patchAppointment(id, { scheduled_at: scheduledAt })
      setSelectedDate(targetDateKey)
      const weekMonday = toDateKey(weekStart)
      const weekSunday = addDaysToKey(weekMonday, 6)
      if (targetDateKey < weekMonday || targetDateKey > weekSunday) {
        setWeekStart(startOfWeekMonday(parseDateKey(targetDateKey)))
      }
      void tryNotifyWaitlist(freedSlotAt)
    }
  }

  const handleStatus = async (id: string, status: string) => {
    const appt =
      weekAppointments.find((a) => a.id === id)
    setUpdatingId(id)
    patchAppointment(id, { status })

    if (status === "no_show") {
      const { data, error: err } = await markAppointmentNoShow(id)
      setUpdatingId(null)
      if (err) {
        notify.error(err)
        if (appt) patchAppointment(id, { status: appt.status })
      } else {
        notify.success(t("appointments.noShowMarked", "Appointment marked as no-show"))
        const slotAt = data?.scheduled_at ?? appt?.scheduled_at
        if (slotAt) void tryNotifyWaitlist(slotAt)
      }
      return
    }

    const { error: err } = await updateAppointmentStatus(id, status)
    setUpdatingId(null)
    if (err) {
      notify.error(err)
      if (appt) patchAppointment(id, { status: appt.status })
    } else {
      notify.success(t("appointments.statusUpdated", "Appointment status updated"))
      if (status === "cancelled" && appt?.scheduled_at) {
        void tryNotifyWaitlist(appt.scheduled_at)
      }
    }
  }

  const handleCheckIn = async (
    appointmentId: string,
    forceBillingOverride = false,
    forceCheckin = false
  ) => {
    setCheckingInId(appointmentId)
    setError(null)
    setReminderNotice(null)
    const { data, error: err } = await checkInAppointment(appointmentId, {
      forceBillingOverride,
      forceCheckin,
    })
    setCheckingInId(null)
    if (err) {
      if (err.includes("Pending consents") && !forceCheckin) {
        const ok = await notify.confirm(
          t(
            "queue.consentOverrideConfirm",
            "Required consents are unsigned. Check in anyway? This will be logged in audit."
          )
        )
        if (ok) return handleCheckIn(appointmentId, forceBillingOverride, true)
      }
      if (err.includes("Billing clearance") && !forceBillingOverride) {
        const ok = await notify.confirm(
          t(
            "billing.gateConfirmCheckIn",
            "Patient has outstanding billing. Check in anyway? This will be logged in audit."
          )
        )
        if (ok) return handleCheckIn(appointmentId, true, forceCheckin)
      }
      notify.error(err)
    } else if (data) {
      notify.success(t("appointments.checkInSuccess", "Patient checked in and added to queue"))
      patchAppointment(appointmentId, { status: "checked_in" })
      setCheckInQueueNotice(true)
    }
  }

  const handleCallToServe = async (
    appointmentId: string,
    forceBillingOverride = false,
    forceCheckin = false
  ) => {
    setCallingToServeId(appointmentId)
    setError(null)
    setReminderNotice(null)
    const { data, error: err } = await callAppointmentToServe(appointmentId, {
      forceBillingOverride,
      forceCheckin,
    })
    setCallingToServeId(null)
    if (err) {
      if (err.includes("Pending consents") && !forceCheckin) {
        const ok = await notify.confirm(
          t(
            "queue.consentOverrideConfirm",
            "Required consents are unsigned. Check in anyway? This will be logged in audit."
          )
        )
        if (ok) return handleCallToServe(appointmentId, forceBillingOverride, true)
      }
      if (err.includes("Billing clearance") && !forceBillingOverride) {
        const ok = await notify.confirm(
          t(
            "billing.gateConfirmCheckIn",
            "Patient has outstanding billing. Check in anyway? This will be logged in audit."
          )
        )
        if (ok) return handleCallToServe(appointmentId, true, forceCheckin)
      }
      notify.error(err)
    } else if (data) {
      patchAppointment(appointmentId, { status: "checked_in" })
      const message = data.auto_checked_in
        ? t(
            "queue.autoCheckInAndCall",
            "Auto check-in — now serving #{code}. Patient is on the dentist board."
          ).replace("{code}", data.display_code)
        : t("queue.calledToServe", "Now serving #{code}").replace("{code}", data.display_code)
      notify.success(message)
      setCheckInQueueNotice(true)
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
    const todayAwaitingCheckin = todayAppts.filter(
      (a) => a.status === "scheduled" || a.status === "confirmed"
    ).length
    const todayUpcoming = todayAwaitingCheckin
    const todayCompleted = todayAppts.filter((a) => a.status === "completed").length
    const todayPortal = todayAppts.filter((a) => resolveBookingSource(a) === "portal").length
    const weekPortal = weekAppointments.filter((a) => resolveBookingSource(a) === "portal").length

    const items: MetricItem[] = [
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
        variant: todayAwaitingCheckin > 0 ? ("warning" as const) : ("default" as const),
      },
      {
        label: t("appointments.metricAwaitingCheckin", "Awaiting check-in"),
        value: loading ? "—" : todayAwaitingCheckin,
        hint: t("appointments.metricAwaitingCheckinHint", "Not yet checked in today"),
        icon: UserCheck,
        variant: todayAwaitingCheckin > 0 ? ("warning" as const) : ("default" as const),
        href: "/queue",
      },
      {
        label: t("appointments.metricDone", "Completed Today"),
        value: loading ? "—" : todayCompleted,
        hint: t("appointments.metricDoneHint", "Marked done today"),
        variant: "success" as const,
      },
    ]

    if (!loading && (todayPortal > 0 || weekPortal > 0)) {
      items.push({
        label: t("appointments.metricPortal", "Online bookings"),
        value: todayPortal,
        hint:
          weekPortal > todayPortal
            ? t("appointments.metricPortalWeekHint", "{week} this week — tap to filter").replace(
                "{week}",
                String(weekPortal)
              )
            : t("appointments.metricPortalHint", "Patient portal — tap to filter"),
        icon: Globe,
        variant: bookingSourceFilter === "portal" ? ("default" as const) : ("default" as const),
        onClick: () => setBookingSourceFilter(bookingSourceFilter === "portal" ? null : "portal"),
      })
    }

    return items
  }, [weekAppointments, today, loading, t, bookingSourceFilter, setBookingSourceFilter])

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

          {bookingSourceFilter === "portal" ? (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 px-4 py-3 text-sm text-sky-950 animate-fade-rise">
              <p className="font-medium">
                {t("appointments.portalFilterTitle", "Showing online portal bookings only")}
              </p>
              <p className="mt-1 text-sky-900/80">
                {t(
                  "appointments.portalFilterHint",
                  "New patient registrations from the portal appear under Patients → Pending registrations."
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setBookingSourceFilter(null)}
              >
                {t("billing.clearFilter", "Clear filter")}
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

        {error ? <PageErrorNotifier error={error} onRetry={reload} /> : null}
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
                  {selectedPatientId ? (
                    <div className="flex items-center justify-between p-2 border rounded-md bg-primary-50 border-primary-200">
                      <span className="text-sm font-medium text-primary-900">
                        {patientQuery || "Selected Patient"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-primary-700 hover:bg-primary-100"
                        onClick={() => {
                          setSelectedPatientId("")
                          setPatientQuery("")
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                        placeholder={t("appointments.searchPatientPlaceholder", "Name or phone…")}
                      />
                      {patients.length > 0 && (
                        <ul className="border rounded-md divide-y max-h-32 overflow-y-auto text-sm mt-1">
                          {patients.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                                onClick={() => {
                                  setSelectedPatientId(p.id)
                                  setPatientQuery(`${p.first_name} ${p.last_name} — ${p.phone || ""}`)
                                  setPatients([])
                                }}
                              >
                                <span className="font-medium">{p.first_name} {p.last_name}</span>
                                {p.phone && <span className="text-neutral-500 ml-1">— {p.phone}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Dentist</label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                    required
                  >
                    {providers.length === 0 ? (
                      <option value="">No dentists for this branch</option>
                    ) : (
                      providers.map((p) => (
                        <option key={p.profile_id} value={p.profile_id}>
                          {p.full_name ?? p.email ?? "Dentist"}
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
                    <p className="text-xs text-neutral-500">Select dentist and date.</p>
                  ) : slots.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-700">No slots — dentist may be closed this day or has no active clinic hours.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs h-8 gap-1.5 border-amber-300 hover:bg-amber-50"
                        onClick={async () => {
                          setSlotsLoading(true)
                          setError(null)
                          try {
                            const supabase = (await import("@/lib/supabase/client")).createClient()
                            // Triggers branch clinic hour provisioning & ensures provider defaults are set
                            const { error: err } = await supabase.rpc("ensure_provider_availability_defaults", {
                              p_branch_id: activeBranch!.id,
                              p_provider_id: selectedProviderId
                            })
                            if (err) throw err
                            
                            // Re-fetch slots
                            const { data: newSlots } = await fetchPreparedAppointmentSlots({
                              branchId: activeBranch!.id,
                              providerId: selectedProviderId,
                              date,
                            })
                            setSlots(newSlots)
                            setTime((prev) => pickDefaultSlotTime(newSlots, prev))
                            notify.success(t("appointments.slotsConfigured", "Working hours configured."))
                          } catch (err: unknown) {
                            notify.error(
                              err instanceof Error ? err.message : "Failed to configure slots"
                            )
                          } finally {
                            setSlotsLoading(false)
                          }
                        }}
                      >
                        ⚙️ Configure Working Hours & Slots Automatically
                      </Button>
                    </div>
                  ) : (
                    <AppointmentSlotButtons
                      slots={slots}
                      selectedTime={time}
                      onSelect={setTime}
                      loading={slotsLoading}
                      emptyMessage={t(
                        "appointments.noSlotsBook",
                        "No open slots — configure working hours or pick another day."
                      )}
                    />
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium">Purpose</label>
                  <select
                    value={purpose && ["General Checkup", "Dental Cleaning", "Tooth Filling", "Root Canal", "Tooth Extraction", "Orthodontic Consultation"].includes(purpose) ? purpose : (purpose ? "Other" : "General Checkup")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Other") {
                        setPurpose("");
                      } else {
                        setPurpose(val);
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="General Checkup">General Checkup</option>
                    <option value="Dental Cleaning">Dental Cleaning</option>
                    <option value="Tooth Filling">Tooth Filling</option>
                    <option value="Root Canal">Root Canal</option>
                    <option value="Tooth Extraction">Tooth Extraction</option>
                    <option value="Orthodontic Consultation">Orthodontic Consultation</option>
                    <option value="Other">Other</option>
                  </select>
                  {purpose !== "General Checkup" &&
                    purpose !== "Dental Cleaning" &&
                    purpose !== "Tooth Filling" &&
                    purpose !== "Root Canal" &&
                    purpose !== "Tooth Extraction" &&
                    purpose !== "Orthodontic Consultation" && (
                      <Input
                        required
                        placeholder="Please specify purpose"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="mt-1"
                      />
                    )}
                </div>
                {bookingBillingGate?.has_billing_gap ? (
                  <div className="sm:col-span-2 space-y-2">
                    <PatientBillingGateBanner
                      gate={bookingBillingGate}
                      patientId={selectedPatientId}
                      branchId={activeBranch?.id}
                      onBackfill={() => {
                        getPatientBillingGate(selectedPatientId).then(({ data }) => setBookingBillingGate(data))
                      }}
                    />
                    <label className="flex items-start gap-2 text-xs text-amber-900">
                      <input
                        type="checkbox"
                        checked={forceBillingOverride}
                        onChange={(e) => setForceBillingOverride(e.target.checked)}
                        className="mt-0.5"
                      />
                      {t(
                        "billing.gateOverrideBook",
                        "Override billing block for this booking (logged in audit)"
                      )}
                    </label>
                  </div>
                ) : null}
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={
                      booking ||
                      !selectedPatientId ||
                      !time ||
                      slots.length === 0 ||
                      (bookingBillingGate?.has_billing_gap && !forceBillingOverride)
                    }
                  >
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
          <>
        <AppointmentWeekCalendar
            appointments={filteredWeekAppointments}
            weekStart={weekStart}
            onWeekChange={(start) => {
              setWeekStart(start)
              setSelectedDate(toDateKey(start))
            }}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onStatusChange={handleStatus}
            onReschedule={canWriteAppts ? handleReschedule : undefined}
            onCheckIn={canCheckIn ? handleCheckIn : undefined}
            onCallToServe={canCheckIn ? handleCallToServe : undefined}
            onRemind={canWriteAppts ? handleSendReminder : undefined}
            onEdit={canWriteAppts ? openEditDialog : undefined}
            updatingId={updatingId}
            reschedulingId={reschedulingId}
            checkingInId={checkingInId}
            callingToServeId={callingToServeId}
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
          {activeBranch ? (
            <AppointmentEditDialog
              open={editDialogOpen}
              onOpenChange={(next) => {
                setEditDialogOpen(next)
                if (!next) setEditingAppt(null)
              }}
              appointment={editingAppt}
              providers={providers}
              branchId={activeBranch.id}
              onSaved={handleEditSaved}
              onFreedSlot={(freedAt) => void tryNotifyWaitlist(freedAt)}
            />
          ) : null}
          </>
        )}
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
