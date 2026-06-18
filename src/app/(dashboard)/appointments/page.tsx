"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import {
  createAppointment,
  fetchAppointmentScheduledAt,
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
  isPastManilaSlot,
  manilaScheduledAtIso,
  pickDefaultSlotTime,
} from "@/lib/appointments/appointment-slots"
import {
  ensureProviderAvailabilityDefaults,
  type AppointmentSlot,
} from "@/lib/appointments/provider-availability-service"
import {
  logManualWhatsAppNotification,
  sendAppointmentReminder,
} from "@/lib/notifications/notification-service"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"
import { notifyWaitlistOnSlotOpen } from "@/lib/waitlist/waitlist-service"
import { fetchQueueEntriesForDay, type QueueEntry } from "@/lib/queue/queue-service"
import { filterPendingCheckInAppointments } from "@/lib/queue/pending-arrivals"
import { usePermission } from "@/hooks/use-permission"
import { fetchOrgStaff, type StaffMember } from "@/lib/staff/staff-service"
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
  appointmentDateKey,
} from "@/lib/appointments/week-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Calendar, Plus, UserCheck, MapPin, Globe, X } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { AppointmentsDaySummary } from "@/components/appointments/AppointmentsDaySummary"
import { MetricStrip, type MetricItem } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { useOperationalRefresh } from "@/hooks/use-operational-refresh"
import { resolveBookingSource } from "@/lib/appointments/booking-source"
import type { BookingSource } from "@/lib/appointments/booking-source"
import { WorkflowStatusBanner } from "@/components/layout/WorkflowStatusBanner"

const APPOINTMENT_PURPOSE_PRESETS = [
  "General Checkup",
  "Dental Cleaning",
  "Tooth Filling",
  "Root Canal",
  "Tooth Extraction",
  "Orthodontic Consultation",
] as const

const APPOINTMENT_STATUS_FILTERS = new Set([
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
])

type AppointmentPurposePreset = (typeof APPOINTMENT_PURPOSE_PRESETS)[number] | "Other"

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
  const viewToday = searchParams.get("view") === "today"
  const dateParam = searchParams.get("date")
  const appointmentParam = searchParams.get("appointment")
  const patientParam = searchParams.get("patient")
  const patientNameParam = searchParams.get("patientName")
  const sourceParam = searchParams.get("source")
  const statusParam = searchParams.get("status")
  const statusFilter = statusParam && APPOINTMENT_STATUS_FILTERS.has(statusParam) ? statusParam : null
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
  const initialDateKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toDateKey(new Date())
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekMonday(parseDateKey(initialDateKey)))
  const [selectedDate, setSelectedDate] = React.useState(initialDateKey)
  const [weekAppointments, setWeekAppointments] = React.useState<Awaited<ReturnType<typeof fetchAppointmentsRange>>["data"]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showBook, setShowBook] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [purposePreset, setPurposePreset] = React.useState<AppointmentPurposePreset>("General Checkup")
  const [purposeOther, setPurposeOther] = React.useState("")
  const [booking, setBooking] = React.useState(false)
  const [portalReady, setPortalReady] = React.useState(false)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const [reschedulingId, setReschedulingId] = React.useState<string | null>(null)
  const [remindingId, setRemindingId] = React.useState<string | null>(null)
  const [reminderNotice, setReminderNotice] = React.useState<string | null>(null)
  const [waitlistNotice, setWaitlistNotice] = React.useState<string | null>(null)
  const [providers, setProviders] = React.useState<StaffMember[]>([])
  const [selectedProviderId, setSelectedProviderId] = React.useState("")
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingAppt, setEditingAppt] = React.useState<AppointmentRecord | null>(null)
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [bookingBillingGate, setBookingBillingGate] = React.useState<PatientBillingGate | null>(null)
  const [forceBillingOverride, setForceBillingOverride] = React.useState(false)
  const [todayQueueEntries, setTodayQueueEntries] = React.useState<QueueEntry[]>([])

  const today = toDateKey(new Date())

  const resolvedPurpose =
    purposePreset === "Other" ? purposeOther.trim() : purposePreset

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setPortalReady(true)
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  React.useEffect(() => {
    if (!showBook) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showBook])

  const resetBookForm = React.useCallback(() => {
    setPurposePreset("General Checkup")
    setPurposeOther("")
    setTime("")
    setForceBillingOverride(false)
    setBookingBillingGate(null)
  }, [])

  const openBookModal = React.useCallback(() => {
    setShowBook(true)
    setDate(selectedDate)
    resetBookForm()
  }, [resetBookForm, selectedDate])

  const closeBookModal = React.useCallback(() => {
    setShowBook(false)
    resetBookForm()
  }, [resetBookForm])

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
    return weekAppointments.filter((appointment) => {
      if (bookingSourceFilter && resolveBookingSource(appointment) !== bookingSourceFilter) return false
      if (statusFilter && appointment.status !== statusFilter) return false
      return true
    })
  }, [weekAppointments, bookingSourceFilter, statusFilter])

  const loadWeek = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    const start = toDateKey(addDays(weekStart, -15))
    const end = toDateKey(addDays(weekStart, 30))
    void Promise.all([
      fetchAppointmentsRange(activeBranch.id, start, end),
      fetchQueueEntriesForDay(activeBranch.id, today),
    ]).then(([weekRes, queueRes]) => {
      setWeekAppointments(weekRes.data)
      setTodayQueueEntries(queueRes.data)
      setError(weekRes.error ?? queueRes.error)
      setLoading(false)
    })
  }, [activeBranch, weekStart, today])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      loadWeek()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadWeek])

  React.useEffect(() => {
    if (!viewToday) return
    const id = window.setTimeout(() => {
      setSelectedDate(today)
      setWeekStart(startOfWeekMonday(parseDateKey(today)))
    }, 0)
    return () => window.clearTimeout(id)
  }, [viewToday, today])

  React.useEffect(() => {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return
    const id = window.setTimeout(() => {
      setSelectedDate(dateParam)
      setWeekStart(startOfWeekMonday(parseDateKey(dateParam)))
    }, 0)
    return () => window.clearTimeout(id)
  }, [dateParam])

  React.useEffect(() => {
    if (!patientParam) return
    const id = window.setTimeout(() => {
      const bookingDate =
        dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : selectedDate
      setSelectedPatientId(patientParam)
      setPatientQuery(patientNameParam ?? "Selected Patient")
      setPatients([])
      setShowBook(true)
      setDate(bookingDate)
      setPurposePreset("General Checkup")
      setPurposeOther("")
      setTime("")
    }, 0)
    return () => window.clearTimeout(id)
  }, [dateParam, patientNameParam, patientParam, selectedDate])

  React.useEffect(() => {
    if (!appointmentParam || !activeBranch) return
    void fetchAppointmentScheduledAt(appointmentParam).then(({ data, error: scheduledError }) => {
      if (scheduledError || !data) return
      const dateKey = appointmentDateKey(data.scheduled_at)
      setSelectedDate(dateKey)
      setWeekStart(startOfWeekMonday(parseDateKey(dateKey)))
    })
  }, [appointmentParam, activeBranch])

  useOperationalRefresh(["appointments", "queue_entries"], loadWeek)

  React.useEffect(() => {
    if (!activeBranch) return
    const id = window.setTimeout(() => {
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
      })
    }, 0)
    return () => window.clearTimeout(id)
  }, [activeBranch])

  React.useEffect(() => {
    if (!activeBranch || !selectedProviderId || !date) {
      const id = window.setTimeout(() => setSlots([]), 0)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => {
      setSlotsLoading(true)
      void fetchPreparedAppointmentSlots({
        branchId: activeBranch.id,
        providerId: selectedProviderId,
        date,
      }).then(({ data, error: slotError }) => {
        setSlots(data)
        setSlotsLoading(false)
        if (slotError) notify.error(slotError)
        setTime((prev) => pickDefaultSlotTime(data, prev, undefined, date))
      })
    }, 0)
    return () => window.clearTimeout(id)
  }, [activeBranch, selectedProviderId, date])

  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) {
      const id = window.setTimeout(() => setPatients([]), 0)
      return () => window.clearTimeout(id)
    }
    const t = setTimeout(() => {
      searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data))
    }, 300)
    return () => clearTimeout(t)
  }, [patientQuery, activeBranch])

  React.useEffect(() => {
    if (!selectedPatientId) {
      const id = window.setTimeout(() => {
        setBookingBillingGate(null)
        setForceBillingOverride(false)
      }, 0)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => {
      getPatientBillingGate(selectedPatientId).then(({ data }) => setBookingBillingGate(data))
      setForceBillingOverride(false)
    }, 0)
    return () => window.clearTimeout(id)
  }, [selectedPatientId])

  const patchAppointment = React.useCallback((id: string, patch: Partial<AppointmentRecord>) => {
    setWeekAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }, [])

  const reload = () => {
    loadWeek()
  }

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
    if (!user || !activeBranch || !date) return
    if (!selectedPatientId) {
      notify.error(t("appointments.selectPatientFirst", "Select a patient before booking."))
      return
    }
    if (!time) {
      notify.error(t("appointments.selectValidSlot", "Pick an available time slot."))
      return
    }
    const slot = slots.find((s) => s.time === time)
    if (!slot?.available || isPastManilaSlot(date, time)) {
      notify.error(t("appointments.selectValidSlot", "Pick an available time slot."))
      return
    }
    if (!resolvedPurpose) {
      notify.error(t("appointments.purposeRequired", "Enter a purpose for this visit."))
      return
    }
    if (bookingBillingGate?.has_billing_gap && !forceBillingOverride) {
      notify.error(t("billing.gateBlocked", "Resolve billing before booking or use override."))
      return
    }
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
      purpose: resolvedPurpose,
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
      closeBookModal()
      setSelectedPatientId("")
      setPatientQuery("")
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

  const handleOpenWhatsAppReminder = async (appointment: AppointmentRecord) => {
    if (!activeBranch || !appointment.patient_phone) return
    const scheduled = new Date(appointment.scheduled_at)
    const appointmentDate = scheduled.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    })
    const appointmentTime = scheduled.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    })
    const body = t(
      "appointments.whatsAppReminderBody",
      "Hello {patient}, this is a reminder for your dental appointment at {clinic} on {date} at {time}."
    )
      .replace("{patient}", appointment.patient_name ?? "patient")
      .replace("{clinic}", activeBranch.name)
      .replace("{date}", appointmentDate)
      .replace("{time}", appointmentTime)

    const { error: logError } = await logManualWhatsAppNotification({
      phone: appointment.patient_phone,
      body,
      branchId: activeBranch.id,
      templateKey: "appointment_reminder",
      patientId: appointment.patient_id,
    })
    if (logError) {
      notify.error(logError)
      return
    }

    const win = window.open(buildWhatsAppSendUrl(appointment.patient_phone, body), "_blank", "noopener,noreferrer")
    if (!win) {
      notify.error(t("settings.notificationsPopupBlocked", "WhatsApp popup was blocked by the browser."))
    }
  }

  const todayAwaitingCheckinCount = React.useMemo(() => {
    const todayAppts = weekAppointments.filter(
      (a) => appointmentDateKey(a.scheduled_at) === today
    )
    return filterPendingCheckInAppointments(todayAppts, todayQueueEntries).length
  }, [weekAppointments, today, todayQueueEntries])

  const metricItems = React.useMemo(() => {
    const todayAppts = weekAppointments.filter((a) => appointmentDateKey(a.scheduled_at) === selectedDate)
    const todayAwaitingCheckin = filterPendingCheckInAppointments(
      todayAppts,
      selectedDate === today ? todayQueueEntries : []
    ).length
    const todayPortal = todayAppts.filter((a) => resolveBookingSource(a) === "portal").length
    const weekPortal = weekAppointments.filter((a) => resolveBookingSource(a) === "portal").length
    const isSelectedToday = selectedDate === today

    const items: MetricItem[] = []

    if (isSelectedToday && canCheckIn) {
      items.push({
        label: t("appointments.metricAwaitingCheckin", "Awaiting check-in"),
        value: loading ? "—" : todayAwaitingCheckin,
        hint: t("appointments.metricAwaitingCheckinHint", "Not yet checked in today"),
        icon: UserCheck,
        variant: todayAwaitingCheckin > 0 ? ("warning" as const) : ("default" as const),
        href: "/queue?focus=checkin",
      })
    }

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
        onClick: () => setBookingSourceFilter(bookingSourceFilter === "portal" ? null : "portal"),
      })
    }

    return items
  }, [
    weekAppointments,
    selectedDate,
    today,
    todayQueueEntries,
    loading,
    t,
    bookingSourceFilter,
    setBookingSourceFilter,
    canCheckIn,
  ])

  return (
    <PermissionGate permission={PERMISSIONS.APPOINTMENTS_READ}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Calendar} hideOnMobile>
            {t("appointments.eyebrow", "Scheduling")} · {t("appointments.title", "Appointments")}
          </SectionEyebrow>

          <PageHeader
            compact
            title={t("appointments.title", "Appointments")}
            description={t(
              "appointments.registrySubtitle",
              "Week calendar for booking and status — check-in happens on the Queue board."
            )}
            actions={
            <>
              <WorkflowSettingsLink />
              <Button className="gap-2" onClick={openBookModal}>
                <Plus className="h-4 w-4" />
                {t("appointments.book", "Book")}
              </Button>
            </>
          }
          />

          {canCheckIn && todayAwaitingCheckinCount > 0 ? (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 animate-fade-rise">
              <p className="font-medium">
                {t(
                  "appointments.awaitingCheckinBannerTitle",
                  "{n} patient(s) need check-in on Queue"
                ).replace("{n}", String(todayAwaitingCheckinCount))}
              </p>
              <p className="mt-1 text-amber-900/80">
                {t(
                  "appointments.awaitingCheckinBannerHint",
                  "Open Queue — first column is Check-in. Tap Check in to Waiting for each patient who arrived."
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-2 border-amber-300 bg-white" asChild>
                <Link href="/queue">{t("appointments.openQueueCheckIn", "Open Queue to check in")}</Link>
              </Button>
            </div>
          ) : canCheckIn ? (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 px-4 py-3 text-sm text-sky-950 animate-fade-rise">
              <p className="font-medium">
                {t("appointments.checkInOnQueueTitle", "Patient check-in is on the Queue board")}
              </p>
              <p className="mt-1 text-sky-900/80">
                {t(
                  "appointments.checkInOnQueueHint",
                  "Open Queue — first column lists today's arrivals. Check in there; everyone enters Waiting first."
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/queue">{t("appointments.openQueue", "Open queue board")}</Link>
              </Button>
            </div>
          ) : null}

          {viewToday ? (
            <div className="rounded-xl border border-primary-200/80 bg-primary-50/50 px-4 py-3 text-sm text-primary-950 animate-fade-rise">
              <p className="font-medium">{t("appointments.viewTodayTitle", "Showing today")}</p>
              <p className="mt-1 text-primary-900/80">
                {t("appointments.viewTodayHint", "Calendar focused on today's schedule.")}
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/appointments">{t("billing.clearFilter", "Clear filter")}</Link>
              </Button>
            </div>
          ) : null}

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

          {statusFilter ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-950 animate-fade-rise">
              <p className="font-medium">
                {t("appointments.statusFilterTitle", "Showing {status} appointments").replace(
                  "{status}",
                  statusFilter.replace(/_/g, " ")
                )}
              </p>
              <p className="mt-1 text-amber-900/80">
                {t(
                  "appointments.statusFilterHint",
                  "Opened from a dashboard or report KPI. Clear the filter to return to the full schedule."
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete("status")
                  const qs = params.toString()
                  router.replace(qs ? `/appointments?${qs}` : "/appointments", { scroll: false })
                }}
              >
                {t("billing.clearFilter", "Clear filter")}
              </Button>
            </div>
          ) : null}

          <WorkflowStatusBanner
            title={t("appointments.workflowBannerTitle", "Automation affecting appointments")}
            description={t(
              "appointments.workflowBannerDescription",
              "Check-in handoff, no-show handling, and waitlist follow-up depend on branch workflow toggles."
            )}
            items={[
              {
                key: "auto_checkin_updates_appointment",
                label: t("appointments.workflowCheckinSync", "Queue check-in sync"),
              },
              {
                key: "auto_waitlist_on_slot_open",
                label: t("appointments.workflowWaitlist", "Waitlist slot alerts"),
              },
              {
                key: "auto_no_show_after_grace",
                label: t("appointments.workflowNoShow", "Auto no-show rule"),
              },
            ]}
          />

          {activeBranch ? (
            <AppointmentsDaySummary
              appointments={filteredWeekAppointments}
              selectedDate={selectedDate}
              isToday={selectedDate === today}
              loading={loading}
            />
          ) : null}

          {activeBranch ? (
            <Badge variant="info" className="gap-1 w-fit font-normal">
              <MapPin className="h-3 w-3" aria-hidden />
              {activeBranch.name}
            </Badge>
          ) : null}

          {metricItems.length > 0 ? (
            <MetricStrip items={metricItems} snapOnMobile desktopCols={2} />
          ) : null}

        {error ? <PageErrorNotifier error={error} onRetry={reload} /> : null}
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

        {loading ? (
          <PageLoadingSkeleton variant="block" />
        ) : (
          <>
        <AppointmentWeekCalendar
            appointments={filteredWeekAppointments}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onStatusChange={handleStatus}
            onReschedule={canWriteAppts ? handleReschedule : undefined}
            onRemind={canWriteAppts ? handleSendReminder : undefined}
            onWhatsAppRemind={canWriteAppts ? handleOpenWhatsAppReminder : undefined}
            onEdit={canWriteAppts ? openEditDialog : undefined}
            updatingId={updatingId}
            reschedulingId={reschedulingId}
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
      {portalReady && showBook
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label={t("common.close", "Close")}
                onClick={closeBookModal}
              />
              <div
                role="dialog"
                aria-modal="true"
                className="relative z-[201] flex max-h-[min(92vh,100dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[30px] border border-neutral-200 bg-white shadow-xl animate-fade-rise sm:max-h-[90vh] sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-300 sm:hidden" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        {t("appointments.newAppointment", "New Appointment")}
                      </h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        {t(
                          "appointments.bookModalHint",
                          "Booking schedules a future arrival. Use Queue > Patient arrival if the patient is already in clinic."
                        )}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={closeBookModal}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <form onSubmit={handleBook} className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-xs font-medium">{t("appointments.searchPatient", "Search patient")}</label>
                        {selectedPatientId ? (
                          <div className="flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 p-2">
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
                              required
                            />
                            <p className="text-[11px] text-neutral-500">
                              {t(
                                "appointments.searchPatientHint",
                                "Type at least 2 characters, then pick a patient from the list."
                              )}
                            </p>
                            {patients.length > 0 ? (
                              <ul className="mt-1 max-h-32 divide-y overflow-y-auto rounded-md border text-sm">
                                {patients.map((p) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      className="w-full px-3 py-2 text-left hover:bg-neutral-50"
                                      onClick={() => {
                                        setSelectedPatientId(p.id)
                                        setPatientQuery(`${p.first_name} ${p.last_name} — ${p.phone || ""}`)
                                        setPatients([])
                                      }}
                                    >
                                      <span className="font-medium">
                                        {p.first_name} {p.last_name}
                                      </span>
                                      {p.phone ? <span className="ml-1 text-neutral-500">— {p.phone}</span> : null}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
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
                        {providers.length === 0 ? (
                          <div className="mt-1 space-y-1">
                            <p className="text-[11px] font-medium text-amber-700">
                              No doctors assigned to this branch yet.
                            </p>
                            <Button type="button" variant="outline" className="h-7 px-2 text-[10px]" asChild>
                              <Link href="/settings/staff">Assign dentist in staff settings</Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Date</label>
                        <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-xs font-medium">Available slots</label>
                        {slotsLoading ? (
                          <p className="text-xs text-neutral-500">Loading slots…</p>
                        ) : !date || !selectedProviderId ? (
                          <p className="text-xs text-neutral-500">Select dentist and date.</p>
                        ) : slots.length === 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-700">
                              No slots — dentist may be closed this day or has no active clinic hours.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 gap-1.5 border-amber-300 text-xs hover:bg-amber-50"
                              onClick={async () => {
                                setSlotsLoading(true)
                                setError(null)
                                try {
                                  const supabase = (await import("@/lib/supabase/client")).createClient()
                                  const { error: err } = await supabase.rpc("ensure_provider_availability_defaults", {
                                    p_branch_id: activeBranch!.id,
                                    p_provider_id: selectedProviderId,
                                  })
                                  if (err) throw err
                                  const { data: newSlots } = await fetchPreparedAppointmentSlots({
                                    branchId: activeBranch!.id,
                                    providerId: selectedProviderId,
                                    date,
                                  })
                                  setSlots(newSlots)
                                  setTime((prev) => pickDefaultSlotTime(newSlots, prev, undefined, date))
                                  notify.success(t("appointments.slotsConfigured", "Working hours configured."))
                                } catch (err: unknown) {
                                  notify.error(err instanceof Error ? err.message : "Failed to configure slots")
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
                            date={date}
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
                          value={purposePreset}
                          onChange={(e) => {
                            const val = e.target.value as AppointmentPurposePreset
                            setPurposePreset(val)
                            if (val !== "Other") setPurposeOther("")
                          }}
                          className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {APPOINTMENT_PURPOSE_PRESETS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value="Other">Other</option>
                        </select>
                        {purposePreset === "Other" ? (
                          <Input
                            required
                            placeholder="Please specify purpose"
                            value={purposeOther}
                            onChange={(e) => setPurposeOther(e.target.value)}
                            className="mt-1"
                          />
                        ) : null}
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
                    </div>
                  </div>
                  <div className="shrink-0 border-t border-neutral-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="submit"
                        className="h-11 w-full sm:w-auto"
                        disabled={
                          booking ||
                          !selectedPatientId ||
                          !date ||
                          !time ||
                          !resolvedPurpose ||
                          slots.length === 0 ||
                          (bookingBillingGate?.has_billing_gap && !forceBillingOverride)
                        }
                      >
                        {booking
                          ? t("appointments.booking", "Booking…")
                          : t("appointments.confirmBooking", "Confirm Booking")}
                      </Button>
                      <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={closeBookModal}>
                        {t("common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </PermissionGate>
  )
}
