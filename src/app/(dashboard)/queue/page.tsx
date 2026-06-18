"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { searchPatients } from "@/lib/patients/patient-service"
import { sendReviewRequestAfterServed } from "@/lib/notifications/review-request-service"
import { fetchPatientConsents } from "@/lib/patients/consent-service"
import {
  checkInConsentFormLabel,
  resolveCheckInConsentHref,
} from "@/lib/patients/checkin-consent"
import {
  callNextPatient,
  checkInPatient,
  fetchQueueEntriesForDay,
  updateQueueStatus,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/queue/queue-service"
import {
  checkInAppointment,
  fetchAppointments,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import {
  applyEncounterCheckInChoice,
  loadOpenEncounterPrompt,
  type EncounterCheckInChoice,
  type OpenEncounterPrompt,
} from "@/lib/clinical/encounter-check-in-flow"
import {
  classifyTodayArrivals,
} from "@/lib/queue/appointment-arrival"
import { filterPendingCheckInAppointments } from "@/lib/queue/pending-arrivals"
import { OpenEncounterCheckInDialog } from "@/components/queue/OpenEncounterCheckInDialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Megaphone, Plus, ShieldCheck, Users, MapPin, Clock, UserCheck } from "lucide-react"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { notify } from "@/lib/ui/notify"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { createClient } from "@/lib/supabase/client"
import { VisitCheckoutWizard } from "@/components/queue/VisitCheckoutWizard"
import { PatientArrivalDialog } from "@/components/queue/PatientArrivalDialog"
import { QueueBoard, type QueueBoardArrival } from "@/components/queue/QueueBoard"
import { QueueDaySummary, type QueueDayStats, type QueueDaySummaryKey } from "@/components/queue/QueueDaySummary"
import { CollapsibleGuide } from "@/components/layout/CollapsibleGuide"
import { QueueWorkflowGuide } from "@/components/queue/QueueWorkflowGuide"
import { computeQueueDayStats } from "@/lib/queue/queue-day-stats"
import {
  filterQueueBoardEntries,
  parseQueueBoardFilter,
  type QueueBoardFilter,
} from "@/lib/queue/queue-board-filter"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"
import { ClinicDayBar } from "@/components/layout/ClinicDayBar"
import { useClinicDay } from "@/hooks/use-clinic-day"
import { getPatientBillingGate, type PatientBillingGate } from "@/lib/billing/invoice-service"
import { WorkflowStatusBanner } from "@/components/layout/WorkflowStatusBanner"

type Tab = "board" | "history"

type PendingCheckInAction = {
  patientId: string
  patientName?: string
  mode: "walk_in" | "appointment_check_in"
  appointmentId?: string
  forceCheckin?: boolean
  forceBillingOverride?: boolean
}

type CheckInGate = {
  kind: "consent" | "billing"
  message: string
  action: PendingCheckInAction
  reuseEncounterId: string | null
  consentHref?: string
  consentButtonLabel?: string
}

function sortQueueEntries(data: QueueEntry[]): QueueEntry[] {
  return [...data].sort((a, b) => {
    const aHasAppt = !!a.appointment_id
    const bHasAppt = !!b.appointment_id
    if (aHasAppt && !bHasAppt) return -1
    if (!aHasAppt && bHasAppt) return 1
    return new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
  })
}

function isConsentGateError(message: string) {
  return message.includes("Intake consents") || message.includes("Pending consents")
}

export default function QueuePage() {
  return (
    <React.Suspense fallback={<PageLoadingSkeleton variant="list" />}>
      <QueuePageContent />
    </React.Suspense>
  )
}

function QueuePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const highlightAppointmentId = searchParams.get("appointment")
  const walkinPatientParam = searchParams.get("walkinPatient")
  const walkinNameParam = searchParams.get("walkinName")
  const focusParam = searchParams.get("focus")
  const urlBoardFilter = parseQueueBoardFilter(searchParams.get("filter"))
  const { activeBranch, branchRevision } = useBranch()
  const { t } = useLocale()
  const { clinicDay, isToday, formattedDay, previousDay } = useClinicDay()
  const [tab, setTab] = React.useState<Tab>(
    urlBoardFilter === "served" || urlBoardFilter === "cancelled" ? "history" : "board"
  )
  const [boardFilter, setBoardFilter] = React.useState<QueueBoardFilter>(urlBoardFilter)
  const [entries, setEntries] = React.useState<QueueEntry[]>([])
  const [dayEntries, setDayEntries] = React.useState<QueueEntry[]>([])
  const [prevDayServed, setPrevDayServed] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [showCheckIn, setShowCheckIn] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [selectedPatientName, setSelectedPatientName] = React.useState("")
  const [checkInNotes, setCheckInNotes] = React.useState("")
  const [checkingIn, setCheckingIn] = React.useState(false)
  const [callingNext, setCallingNext] = React.useState(false)
  const [todayAppointments, setTodayAppointments] = React.useState<AppointmentRecord[]>([])
  const [apptCheckInId, setApptCheckInId] = React.useState<string | null>(null)
  const [consentOverridePending, setConsentOverridePending] = React.useState(false)
  const [walkInConsentHref, setWalkInConsentHref] = React.useState<string | null>(null)
  const [walkInConsentLabel, setWalkInConsentLabel] = React.useState<string | null>(null)
  const [billingOverridePending, setBillingOverridePending] = React.useState(false)
  const [checkoutWizard, setCheckoutWizard] = React.useState<{
    patientId: string
    patientName: string
    billingGate: PatientBillingGate | null
    encounterId: string | null
  } | null>(null)
  const [encounterPrompt, setEncounterPrompt] = React.useState<OpenEncounterPrompt | null>(null)
  const [encounterDialogOpen, setEncounterDialogOpen] = React.useState(false)
  const [pendingCheckIn, setPendingCheckIn] = React.useState<PendingCheckInAction | null>(null)
  const [encounterResolving, setEncounterResolving] = React.useState(false)
  const [checkInGate, setCheckInGate] = React.useState<CheckInGate | null>(null)
  const seededWalkInRef = React.useRef(false)
  const queueBoardRef = React.useRef<HTMLDivElement>(null)

  const today = clinicDay

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setBoardFilter(urlBoardFilter)
      if (urlBoardFilter === "served" || urlBoardFilter === "cancelled") {
        setTab("history")
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [urlBoardFilter])

  const syncBoardFilterUrl = React.useCallback(
    (next: QueueBoardFilter) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "all") params.delete("filter")
      else params.set("filter", next)
      const qs = params.toString()
      router.replace(qs ? `/queue?${qs}` : "/queue", { scroll: false })
    },
    [router, searchParams]
  )

  const scrollToQueueSection = React.useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    queueBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [])

  const scrollForBoardFilter = React.useCallback((filter: QueueBoardFilter) => {
    switch (filter) {
      case "queue_waiting":
      case "waiting":
        scrollToQueueSection("queue-waiting")
        return
      case "now_serving":
      case "serving":
        scrollToQueueSection("queue-serving")
        return
      case "in_chair":
        scrollToQueueSection("queue-chair")
        return
      default:
        scrollToQueueSection("queue-waiting")
    }
  }, [scrollToQueueSection])

  const handleBoardFilterChange = React.useCallback(
    (next: QueueBoardFilter, options?: { scroll?: boolean; scrollTo?: string }) => {
      setBoardFilter(next)
      if (next === "served" || next === "cancelled") {
        setTab("history")
      } else {
        setTab("board")
      }
      syncBoardFilterUrl(next)
      if (options?.scrollTo) {
        scrollToQueueSection(options.scrollTo)
      } else if (options?.scroll !== false && next !== "served" && next !== "cancelled" && next !== "all" && next !== "day_all") {
        scrollForBoardFilter(next)
      }
    },
    [scrollForBoardFilter, scrollToQueueSection, syncBoardFilterUrl]
  )

  const summaryKeyFromFilter = React.useCallback(
    (current: QueueBoardFilter): QueueDaySummaryKey | null => {
      switch (current) {
        case "all":
          return "active"
        case "day_all":
          return "checked_in"
        case "queue_waiting":
        case "waiting":
          return "waiting"
        case "serving":
        case "in_chair":
        case "now_serving":
          return "serving"
        case "served":
          return "served"
        case "cancelled":
          return "cancelled"
        default:
          return null
      }
    },
    []
  )

  const handleSummaryClick = React.useCallback(
    (key: QueueDaySummaryKey) => {
      switch (key) {
        case "arrivals":
          handleBoardFilterChange("all", { scrollTo: "queue-arrivals" })
          return
        case "checked_in":
          handleBoardFilterChange("day_all", { scroll: false })
          return
        case "active":
          handleBoardFilterChange("all", { scroll: false })
          return
        case "waiting":
          handleBoardFilterChange("queue_waiting")
          return
        case "serving":
          handleBoardFilterChange("serving")
          return
        case "served":
          handleBoardFilterChange("served", { scroll: false })
          return
        case "cancelled":
          handleBoardFilterChange("cancelled", { scroll: false })
          return
      }
    },
    [handleBoardFilterChange]
  )

  const openCheckInModal = () => {
    setPatientQuery("")
    setPatients([])
    setSelectedPatientId("")
    setSelectedPatientName("")
    setCheckInNotes("")
    setConsentOverridePending(false)
    setWalkInConsentHref(null)
    setWalkInConsentLabel(null)
    setBillingOverridePending(false)
    setCheckInGate(null)
    setShowCheckIn(true)
  }

  React.useEffect(() => {
    if (seededWalkInRef.current || !walkinPatientParam) return
    const label = walkinNameParam ?? ""
    seededWalkInRef.current = true
    setSelectedPatientId(walkinPatientParam)
    setSelectedPatientName(label)
    setPatientQuery(label)
    setPatients([])
    setCheckInNotes("")
    setConsentOverridePending(false)
    setWalkInConsentHref(null)
    setWalkInConsentLabel(null)
    setBillingOverridePending(false)
    setShowCheckIn(true)
    router.replace("/queue", { scroll: false })
  }, [router, walkinNameParam, walkinPatientParam])

  const closeCheckInModal = () => {
    setPatientQuery("")
    setPatients([])
    setSelectedPatientId("")
    setSelectedPatientName("")
    setCheckInNotes("")
    setConsentOverridePending(false)
    setWalkInConsentHref(null)
    setWalkInConsentLabel(null)
    setBillingOverridePending(false)
    setCheckInGate(null)
    setShowCheckIn(false)
  }

  const applyOptimisticQueueAction = React.useCallback(
    (entryId: string, status: QueueStatus | "announce") => {
      setEntries((prev) => {
        if (status === "announce") {
          return prev.map((e) =>
            e.id === entryId ? { ...e, called_at: new Date().toISOString() } : e
          )
        }
        if (status === "served" || status === "cancelled") {
          return prev.filter((e) => e.id !== entryId)
        }
        return prev.map((e) => (e.id === entryId ? { ...e, status } : e))
      })
    },
    []
  )

  const load = React.useCallback(
    (silent = false) => {
      if (!activeBranch) return
      if (!silent) setLoading(true)

      void fetchQueueEntriesForDay(activeBranch.id, clinicDay).then(({ data: dayData, error: err }) => {
        const sortedDay = sortQueueEntries(dayData)
        setDayEntries(sortedDay)
        const filtered =
          tab === "board"
            ? sortedDay.filter((e) => !["served", "cancelled"].includes(e.status))
            : sortedDay.filter((e) => ["served", "cancelled"].includes(e.status))
        setEntries(filtered)
        setError(err)
        setLoading(false)
      })
    },
    [activeBranch, tab, clinicDay]
  )

  React.useEffect(() => {
    const id = window.setTimeout(() => load(), 0)
    return () => window.clearTimeout(id)
  }, [load, branchRevision])

  React.useEffect(() => {
    if (!activeBranch || !isToday) {
      const id = window.setTimeout(() => setPrevDayServed(null), 0)
      return () => window.clearTimeout(id)
    }
    void fetchQueueEntriesForDay(activeBranch.id, previousDay).then(({ data }) => {
      setPrevDayServed(data.filter((e) => e.status === "served").length)
    })
  }, [activeBranch, isToday, previousDay])

  React.useEffect(() => {
    if (!activeBranch || !isToday) return
    void (async () => {
      const { data, error: appointmentsError } = await fetchAppointments(activeBranch.id, today)
      if (appointmentsError) {
        setError(appointmentsError)
        setTodayAppointments([])
        return
      }
      setTodayAppointments(
        data.filter((a) =>
          a.status === "scheduled" || a.status === "confirmed" || a.status === "checked_in"
        )
      )
    })()
  }, [activeBranch, today, dayEntries, t, isToday])

  const pendingAppointmentCheckIns = React.useMemo(
    () => filterPendingCheckInAppointments(todayAppointments, dayEntries),
    [todayAppointments, dayEntries]
  )

  const arrivalBuckets = React.useMemo(
    () => classifyTodayArrivals(pendingAppointmentCheckIns),
    [pendingAppointmentCheckIns]
  )

  const boardArrivals = React.useMemo((): QueueBoardArrival[] => {
    const mapRow = (row: (typeof arrivalBuckets.overdue)[number], tone: QueueBoardArrival["tone"]) => ({
      appointment: row.appointment,
      tone,
      minutesUntil: row.minutesUntil,
    })
    return [
      ...arrivalBuckets.overdue.map((row) => mapRow(row, "overdue")),
      ...arrivalBuckets.dueNow.map((row) => mapRow(row, "due")),
      ...arrivalBuckets.upcoming.map((row) => mapRow(row, "upcoming")),
    ]
  }, [arrivalBuckets])

  React.useEffect(() => {
    if (!highlightAppointmentId || pendingAppointmentCheckIns.length === 0) return
    const el = document.getElementById("queue-arrivals")
    if (!el) return
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [highlightAppointmentId, pendingAppointmentCheckIns.length])

  React.useEffect(() => {
    if (tab !== "board" || !activeBranch || !isToday) return

    const supabase = createClient()
    const channel = supabase
      .channel(`queue-board-${activeBranch.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `branch_id=eq.${activeBranch.id}`,
        },
        () => {
          load(true)
        }
      )
      .subscribe()

    const interval = setInterval(() => load(true), 60_000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load, tab, activeBranch, isToday])

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

  const handleAction = async (entryId: string, status: QueueStatus | "announce") => {
    const entry = entries.find((e) => e.id === entryId)
    const entriesSnapshot = entries
    if (entry) applyOptimisticQueueAction(entryId, status)
    setActionId(entryId)
    let err: string | null = null
    if (status === "announce") {
      const { recallQueuePatient } = await import("@/lib/queue/queue-service")
      const res = await recallQueuePatient(entryId)
      err = res.error
    } else {
      const res = await updateQueueStatus(entryId, status)
      err = res.error
      if (!err && res.data) {
        if (status === "in_chair" && res.data.soap_draft_id) {
          notify.info(
            t(
              "queue.autoSoapDraft",
              "Draft SOAP note created from the last visit — open Clinical Notes to review."
            )
          )
        }
        if (status === "served" && res.data.invoice_draft_id) {
          notify.info(
            t(
              "queue.autoInvoiceDraft",
              "Invoice draft created from the approved treatment plan."
            )
          )
        }
      }
    }
    setActionId(null)
    if (err) {
      setEntries(entriesSnapshot)
      setError(err)
      notify.error(err)
    } else {
      if (status === "served" && entry?.patient_id) {
        void sendReviewRequestAfterServed(entryId).then((result) => {
          if (result.sent) {
            notify.success(t("queue.reviewSmsSent", "Review request SMS sent."))
          }
        })
        const { data: billingGate } = await getPatientBillingGate(entry.patient_id)
        setCheckoutWizard({
          patientId: entry.patient_id,
          patientName: entry.patient_name ?? "Patient",
          billingGate,
          encounterId: entry.encounter_id ?? null,
        })
      }
      const isRevert =
        entry &&
        status !== "announce" &&
        ((entry.status === "in_chair" && (status === "now_serving" || status === "waiting" || status === "ready")) ||
          (entry.status === "now_serving" && (status === "waiting" || status === "ready")) ||
          (entry.status === "ready" && status === "waiting"))

      const statusLabels: Partial<Record<QueueStatus | "announce", string>> = {
        waiting: isRevert
          ? t("queue.statusRevertedWaiting", "Returned to waiting")
          : t("queue.statusWaiting", "Moved to waiting"),
        ready: t("queue.statusReady", "Marked ready"),
        now_serving: isRevert
          ? t("queue.statusRevertedCall", "Returned to call area")
          : t("queue.statusServing", "Now serving"),
        in_chair: t("queue.statusInChair", "In chair"),
        served: t("queue.statusServed", "Marked as served"),
        cancelled: t("queue.statusCancelled", "Entry cancelled"),
        announce: t("queue.statusAnnounced", "Patient recalled"),
      }
      notify.success(statusLabels[status] ?? t("queue.statusUpdated", "Queue updated"))
      void load(true)
    }
  }

  const handleCheckInGateError = (
    err: string,
    action: PendingCheckInAction,
    reuseEncounterId: string | null
  ) => {
    if (!action.forceCheckin && isConsentGateError(err)) {
      setError(null)
      void fetchPatientConsents(action.patientId).then(({ data: consents }) => {
        const consentHref = resolveCheckInConsentHref(action.patientId, consents)
        const consentButtonLabel = checkInConsentFormLabel(consents, t)
        setCheckInGate({
          kind: "consent",
          message: t(
            "queue.consentGateFriendly",
            "Consent is required before check-in. Open the required form to sign, or override if clinic policy allows it."
          ),
          action,
          reuseEncounterId,
          consentHref,
          consentButtonLabel,
        })
        if (action.mode === "walk_in") {
          setConsentOverridePending(true)
          setWalkInConsentHref(consentHref)
          setWalkInConsentLabel(consentButtonLabel)
        }
      })
      notify.info(t("queue.consentGateShort", "Consent required before check-in."))
      return true
    }

    if (!action.forceBillingOverride && err.includes("Billing clearance")) {
      setError(null)
      setCheckInGate({
        kind: "billing",
        message: t(
          "billing.gateFriendly",
          "Outstanding billing must be reviewed before check-in. Collect payment or override if authorized."
        ),
        action,
        reuseEncounterId,
      })
      if (action.mode === "walk_in") setBillingOverridePending(true)
      notify.info(t("billing.gateShort", "Billing review required before check-in."))
      return true
    }

    return false
  }

  const executeCheckIn = async (
    action: PendingCheckInAction,
    reuseEncounterId?: string | null
  ) => {
    if (!activeBranch) return

    const options = {
      forceCheckin: action.forceCheckin,
      forceBillingOverride: action.forceBillingOverride,
      reuseEncounterId: reuseEncounterId ?? undefined,
    }

    if (action.mode === "walk_in") {
      setCheckingIn(true)
      const { data, error: err } = await checkInPatient({
        branchId: activeBranch.id,
        patientId: action.patientId,
        notes: checkInNotes || undefined,
        ...options,
      })
      setCheckingIn(false)
      if (err) {
        if (handleCheckInGateError(err, action, reuseEncounterId)) return
        setError(err)
        notify.error(err)
      } else {
        setCheckInGate(null)
        closeCheckInModal()
        notify.success(
          data?.display_code
            ? t("queue.checkInSuccess", "Checked in — queue #{code}").replace(
                "{code}",
                data.display_code
              )
            : t(
                "queue.walkInCheckInSuccess",
                "Walk-in checked in — patient is in Waiting."
              )
        )
        void load(true)
      }
      return
    }

    if (action.mode === "appointment_check_in") {
      if (!action.appointmentId) return
      setApptCheckInId(action.appointmentId)
      setError(null)
      const { data, error: err } = await checkInAppointment(action.appointmentId, options)
      setApptCheckInId(null)
      if (err) {
        if (handleCheckInGateError(err, action, reuseEncounterId)) return
        setError(err)
        notify.error(err)
      } else if (data) {
        setCheckInGate(null)
        notify.success(
          t("queue.checkInSuccess", "Checked in — queue #{code}").replace("{code}", data.display_code)
        )
        void load(true)
      }
      return
    }
  }

  const beginGatedCheckIn = async (action: PendingCheckInAction) => {
    if (!activeBranch) return
    if (action.mode === "walk_in") setCheckingIn(true)
    const { prompt, error: promptError } = await loadOpenEncounterPrompt(
      action.patientId,
      activeBranch.id
    )
    if (promptError) {
      if (action.mode === "walk_in") setCheckingIn(false)
      notify.error(promptError)
      return
    }
    if (prompt) {
      if (action.mode === "walk_in") setCheckingIn(false)
      setEncounterPrompt(prompt)
      setPendingCheckIn(action)
      setEncounterDialogOpen(true)
      return
    }
    await executeCheckIn(action, null)
  }

  const handleEncounterChoice = async (choice: EncounterCheckInChoice) => {
    if (!pendingCheckIn || !encounterPrompt) return
    if (choice === "cancel") {
      setEncounterDialogOpen(false)
      setEncounterPrompt(null)
      setPendingCheckIn(null)
      return
    }
    setEncounterResolving(true)
    const { reuseEncounterId, error: closeError } = await applyEncounterCheckInChoice(
      choice,
      encounterPrompt
    )
    if (closeError) {
      setEncounterResolving(false)
      notify.error(closeError)
      return
    }
    const action = pendingCheckIn
    setEncounterDialogOpen(false)
    setEncounterPrompt(null)
    setPendingCheckIn(null)
    setEncounterResolving(false)
    await executeCheckIn(action, reuseEncounterId)
  }

  const handleCheckIn = async (
    e: React.FormEvent,
    forceCheckin = false,
    forceBillingOverride = false
  ) => {
    e.preventDefault()
    if (!activeBranch || !selectedPatientId) return
    await beginGatedCheckIn({
      patientId: selectedPatientId,
      patientName: selectedPatientName || undefined,
      mode: "walk_in",
      forceCheckin,
      forceBillingOverride,
    })
  }

  const handleCallNext = async () => {
    if (!activeBranch) return
    setCallingNext(true)
    const { data, error: err } = await callNextPatient(activeBranch.id)
    setCallingNext(false)
    if (err) {
      setError(err)
      notify.error(err)
    } else if (!data) {
      notify.info(t("queue.emptyQueue", "No patients waiting in queue"))
    } else {
      notify.success(t("queue.calledNext", "Called next patient"))
      void load(true)
    }
  }

  const handleAppointmentCheckIn = async (
    appointmentId: string,
    forceBillingOverride = false,
    forceCheckin = false
  ) => {
    const appt = todayAppointments.find((a) => a.id === appointmentId)
    if (!appt) return
    await beginGatedCheckIn({
      patientId: appt.patient_id,
      patientName: appt.patient_name ?? undefined,
      mode: "appointment_check_in",
      appointmentId,
      forceBillingOverride,
      forceCheckin,
    })
  }

  const dayStats = React.useMemo(
    (): QueueDayStats => computeQueueDayStats(dayEntries),
    [dayEntries]
  )

  const boardDisplayEntries = React.useMemo(() => {
    if (tab === "history") {
      const historyBase = dayEntries.filter((e) => ["served", "cancelled"].includes(e.status))
      return filterQueueBoardEntries(
        historyBase,
        boardFilter === "all" ? "day_all" : boardFilter
      )
    }
    const activeFilter =
      boardFilter === "served" || boardFilter === "cancelled" ? "all" : boardFilter
    return filterQueueBoardEntries(entries, activeFilter)
  }, [boardFilter, dayEntries, entries, tab])

  const handledFocusRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!isToday || loading || !focusParam) return
    if (handledFocusRef.current === focusParam) return
    handledFocusRef.current = focusParam
    const id = window.setTimeout(() => {
      if (focusParam === "checkin" || focusParam === "arrivals") {
        handleBoardFilterChange("all", { scrollTo: "queue-arrivals" })
        return
      }
      if (focusParam === "waiting") {
        handleBoardFilterChange("queue_waiting")
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [focusParam, handleBoardFilterChange, isToday, loading])

  const handleTabChange = (next: Tab) => {
    setTab(next)
    if (next === "board" && (boardFilter === "served" || boardFilter === "cancelled")) {
      handleBoardFilterChange("all", { scroll: false })
    }
  }

  const metricItems =
    tab === "board" && isToday
      ? [
          {
            label: t("queue.metricInQueue", "Active now"),
            value: loading ? "—" : dayStats.active,
            hint: t("queue.metricInQueueHint", "Waiting through in-chair"),
            icon: Users,
            variant: dayStats.active > 0 ? ("warning" as const) : ("default" as const),
            active: boardFilter === "all",
            onClick: () => handleBoardFilterChange("all", { scroll: false }),
          },
          {
            label: t("queue.metricWaiting", "Waiting"),
            value: loading ? "—" : dayStats.waiting,
            hint: t("queue.metricWaitingHint", "Not yet called — tap to filter"),
            active: boardFilter === "queue_waiting" || boardFilter === "waiting",
            onClick: () => handleBoardFilterChange("queue_waiting"),
          },
          {
            label: t("queue.metricServing", "Called / chair"),
            value: loading ? "—" : dayStats.serving,
            hint: t("queue.metricServingHint", "Being seen — tap to filter"),
            icon: UserCheck,
            active: boardFilter === "serving",
            onClick: () => handleBoardFilterChange("serving"),
          },
          {
            label: t("queue.summaryServed", "Served today"),
            value: loading ? "—" : dayStats.served,
            hint: t("queue.metricServedHint", "Completed this clinic day"),
            variant: dayStats.served > 0 ? ("success" as const) : ("default" as const),
            active: boardFilter === "served",
            onClick: () => handleBoardFilterChange("served", { scroll: false }),
          },
        ]
      : tab === "history" || !isToday
        ? [
            {
              label: t("queue.summaryServed", "Served"),
              value: loading ? "—" : dayStats.served,
              hint: formattedDay,
              variant: dayStats.served > 0 ? ("success" as const) : ("default" as const),
              active: boardFilter === "served",
              onClick: () => handleBoardFilterChange("served", { scroll: false }),
            },
            {
              label: t("queue.summaryCancelled", "Cancelled"),
              value: loading ? "—" : dayStats.cancelled,
              active: boardFilter === "cancelled",
              onClick: () => handleBoardFilterChange("cancelled", { scroll: false }),
            },
            {
              label: t("queue.avgVisit", "Avg visit"),
              value: loading || dayStats.served === 0 ? "—" : `${dayStats.avgVisitMins} min`,
              hint: t("queue.summaryAvgVisitSub", "Check-in to complete"),
              icon: Clock,
            },
          ]
        : []

  return (
    <PermissionGate permission={PERMISSIONS.QUEUE_MANAGE}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="flex flex-col gap-6">
          <div className="order-1 space-y-6">
          <SectionEyebrow icon={Users} hideOnMobile>
            {t("queue.eyebrow", "Front desk")} · {t("queue.title", "Queue & Patient Flow")}
          </SectionEyebrow>

          <PageHeader
            compact
            title="Queue & Patient Flow"
            description={t(
              "queue.subtitle",
              "Scheduled patients check in here, become a Waiting queue entry, then move to Chair and checkout."
            )}
            actions={
              isToday ? (
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <WorkflowSettingsLink className="col-span-2 w-full sm:col-span-1 sm:w-auto" />
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 sm:w-auto"
                    disabled={callingNext}
                    onClick={handleCallNext}
                  >
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t("queue.callNext", "Call next")}</span>
                  </Button>
                  <Button variant="outline" className="w-full gap-1.5 sm:w-auto" asChild>
                    <Link href="/patients/new?returnTo=queue">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t("queue.newWalkInShort", "New patient")}</span>
                    </Link>
                  </Button>
                  <Button
                    className="col-span-2 w-full gap-2 shadow-sm sm:col-span-1 sm:w-auto"
                    onClick={openCheckInModal}
                  >
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t("queue.patientArrival", "Patient arrival")}</span>
                  </Button>
                </div>
              ) : (
                <WorkflowSettingsLink />
              )
            }
          />

          <ClinicDayBar
            compareHint={
              !isToday
                ? t(
                    "queue.pastDayHint",
                    "Viewing queue history for {day}. Switch to Today for live check-in and flow."
                  ).replace("{day}", formattedDay)
                : null
            }
          />

          <WorkflowStatusBanner
            title={t("queue.workflowBannerTitle", "Automation affecting queue flow")}
            description={t(
              "queue.workflowBannerDescription",
              "Check-in gates, linked appointment updates, and served follow-up can be different per branch."
            )}
            items={[
              {
                key: "consent_gate_checkin",
                label: t("queue.workflowConsentGate", "Consent gate"),
              },
              {
                key: "auto_checkin_updates_appointment",
                label: t("queue.workflowAppointmentSync", "Appointment sync"),
              },
              {
                key: "auto_served_completes_appointment",
                label: t("queue.workflowServed", "Served completes appointment"),
              },
            ]}
          />

          <QueueDaySummary
            stats={dayStats}
            isToday={isToday}
            formattedDay={formattedDay}
            prevDayServed={prevDayServed}
            arrivalsPending={isToday ? pendingAppointmentCheckIns.length : 0}
            activeKey={summaryKeyFromFilter(boardFilter)}
            onItemClick={handleSummaryClick}
          />
          </div>

          <div className="order-2 md:order-3">
          {activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              {pendingAppointmentCheckIns.length > 0 && tab === "board" && isToday ? (
                <Badge variant="warning" className="font-normal">
                  {pendingAppointmentCheckIns.length} {t("queue.apptCheckIn", "appointments to check in")}
                </Badge>
              ) : null}
            </div>
          ) : null}
          </div>

          <div className="order-3 md:order-5 flex flex-wrap gap-2">
            <Button variant={tab === "board" ? "default" : "outline"} size="sm" onClick={() => handleTabChange("board")}>
              {isToday ? t("queue.liveBoard", "Live board") : t("queue.dayBoard", "Day board")}
            </Button>
            <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => handleTabChange("history")}>
              {t("queue.history", "History")}
            </Button>
          </div>

          <div className="order-6 md:order-2">
          {tab === "board" && isToday ? (
            <CollapsibleGuide summary={t("queue.flowHowItWorks", "How queue check-in works")}>
              <QueueWorkflowGuide />
            </CollapsibleGuide>
          ) : null}
          </div>

          <div className="order-5 md:order-4">
          <MetricStrip items={metricItems} snapOnMobile desktopCols={4} />
          </div>

          <div className="order-4 md:order-6 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : null}

          {checkInGate ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950 animate-fade-rise">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700">
                    {checkInGate.kind === "consent" ? (
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                    ) : (
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {checkInGate.kind === "consent"
                        ? t("queue.consentGateTitle", "Consent required before check-in")
                        : t("billing.gateTitle", "Billing review required before check-in")}
                    </p>
                    <p className="mt-1 text-sm text-amber-900/90">{checkInGate.message}</p>
                    {checkInGate.action.patientName ? (
                      <p className="mt-1 text-xs text-amber-900/80">
                        {checkInGate.action.patientName}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="border-amber-300 bg-white" asChild>
                    <Link
                      href={
                        checkInGate.kind === "consent"
                          ? (checkInGate.consentHref ??
                              `/patients/${checkInGate.action.patientId}/consents/general-treatment`)
                          : `/billing?patient=${checkInGate.action.patientId}`
                      }
                    >
                      {checkInGate.kind === "consent"
                        ? (checkInGate.consentButtonLabel ??
                            t("queue.openRequiredConsent", "Sign required consent"))
                        : t("billing.openBilling", "Open billing")}
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-700 text-white hover:bg-amber-800"
                    disabled={checkingIn || apptCheckInId === checkInGate.action.appointmentId}
                    onClick={() => {
                      const overrideAction =
                        checkInGate.kind === "consent"
                          ? { ...checkInGate.action, forceCheckin: true }
                          : { ...checkInGate.action, forceBillingOverride: true }
                      void executeCheckIn(overrideAction, checkInGate.reuseEncounterId)
                    }}
                  >
                    {checkInGate.kind === "consent"
                      ? t("queue.consentOverride", "Check in anyway")
                      : t("billing.gateOverrideCheckIn", "Check in with billing override")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCheckInGate(null)}>
                    {t("common.dismiss", "Dismiss")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

        {loading && entries.length === 0 && boardArrivals.length === 0 ? (
          <PageLoadingSkeleton variant="grid3" />
        ) : tab === "board" ? (
          <div ref={queueBoardRef} className="space-y-4">
            {activeBranch ? (
              <QueueBoard
                entries={boardDisplayEntries}
                arrivals={isToday ? boardArrivals : []}
                highlightAppointmentId={highlightAppointmentId}
                apptCheckInId={apptCheckInId}
                onArrivalCheckIn={handleAppointmentCheckIn}
                branchId={activeBranch.id}
                actionId={actionId}
                onAction={handleAction}
                readOnly={!isToday}
                onReorderError={(msg) => {
                  setError(msg)
                  notify.error(msg)
                }}
                onReorderSuccess={() => {
                  notify.success(t("queue.reordered", "Queue order updated"))
                  void load(true)
                }}
              />
            ) : null}
            <ReportDrillLink
              title={t("queue.reportsQueueTitle", "Queue trends and wait analytics")}
              description={t(
                "queue.reportsQueueDescription",
                "Arrival speed, wait duration, and chair movement live in Reports — keep this screen for live flow only."
              )}
              href="/reports#operations"
              linkLabel={t("queue.openQueueReports", "Open queue reports")}
            />
            <ReportDrillLink
              title={t("queue.reportsDevicesTitle", "Kiosk, TV display, and portal links")}
              description={t(
                "queue.reportsDevicesDescription",
                "Generate public links and monitor waiting-room screens from Reports."
              )}
              href="/reports#devices"
              linkLabel={t("queue.openDeviceReports", "Manage patient-facing screens")}
            />
        </div>
      ) : boardDisplayEntries.length === 0 ? (
          <p className="text-center py-12 text-neutral-500">
            {isToday
              ? t("queue.noHistoryToday", "No completed queue entries today.")
              : t("queue.noHistoryDay", "No queue entries on this clinic day.")}
          </p>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-neutral-500">
                      <th className="pb-3 text-left font-medium">Code</th>
                      <th className="pb-3 text-left font-medium">Patient</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-left font-medium">Checked in</th>
                      <th className="pb-3 text-left font-medium">Completed</th>
                      <th className="pb-3 text-left font-medium">Wait time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {boardDisplayEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 font-mono font-bold">{e.display_code}</td>
                        <td className="py-2">
                          <Link href={`/patients/${e.patient_id}`} className="text-primary-600 hover:underline">
                            {e.patient_name}
                          </Link>
                        </td>
                        <td className="py-2"><Badge>{e.status}</Badge></td>
                        <td className="py-2 text-neutral-500 text-xs">{new Date(e.checked_in_at).toLocaleString("en-PH")}</td>
                        <td className="py-2 text-neutral-500 text-xs">
                          {e.completed_at ? new Date(e.completed_at).toLocaleString("en-PH") : "—"}
                        </td>
                        <td className="py-2 text-neutral-500 text-xs">
                          {e.completed_at
                            ? `${Math.round((new Date(e.completed_at).getTime() - new Date(e.checked_in_at).getTime()) / 60000)} min`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
          </div>

          <OpenEncounterCheckInDialog
            open={encounterDialogOpen}
            prompt={encounterPrompt}
            patientName={pendingCheckIn?.patientName}
            loading={encounterResolving || checkingIn}
            onChoose={(choice) => void handleEncounterChoice(choice)}
            onClose={() => {
              if (encounterResolving) return
              setEncounterDialogOpen(false)
              setEncounterPrompt(null)
              setPendingCheckIn(null)
            }}
          />

          {checkoutWizard ? (
            <VisitCheckoutWizard
              open
              onOpenChange={(open) => {
                if (!open) setCheckoutWizard(null)
              }}
              patientId={checkoutWizard.patientId}
              patientName={checkoutWizard.patientName}
              billingGate={checkoutWizard.billingGate}
              encounterId={checkoutWizard.encounterId}
            />
          ) : null}

        <PatientArrivalDialog
          open={showCheckIn}
          branchId={activeBranch?.id}
          branchName={activeBranch?.name}
          patientQuery={patientQuery}
          onPatientQueryChange={setPatientQuery}
          patients={patients}
          selectedPatientId={selectedPatientId}
          selectedPatientLabel={selectedPatientName || patientQuery}
          onSelectPatient={(p) => {
            setSelectedPatientId(p.id)
            setSelectedPatientName(`${p.first_name} ${p.last_name}`)
            setPatientQuery(`${p.first_name} ${p.last_name}`)
            setPatients([])
          }}
          onClearPatient={() => {
            setSelectedPatientId("")
            setSelectedPatientName("")
            setPatientQuery("")
            setPatients([])
          }}
          checkInNotes={checkInNotes}
          onCheckInNotesChange={setCheckInNotes}
          checkingIn={checkingIn}
          billingOverridePending={billingOverridePending}
          consentOverridePending={consentOverridePending}
          consentFormHref={walkInConsentHref}
          consentFormLabel={walkInConsentLabel}
          onSubmit={handleCheckIn}
          onBillingOverride={() => void handleCheckIn({ preventDefault: () => {} } as React.FormEvent, false, true)}
          onConsentOverride={() => void handleCheckIn({ preventDefault: () => {} } as React.FormEvent, true)}
          onClose={closeCheckInModal}
        />

        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
