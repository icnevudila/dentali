"use client"

import * as React from "react"
import Link from "next/link"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { searchPatients } from "@/lib/patients/patient-service"
import {
  callNextPatient,
  checkInPatient,
  callAppointmentToServe,
  fetchQueueEntries,
  updateQueueStatus,
  waitMinutes,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/queue/queue-service"
import {
  checkInAppointment,
  fetchAppointments,
  autoNoShowForBranch,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import { toDateKey } from "@/lib/appointments/week-calendar"
import {
  applyEncounterCheckInChoice,
  loadOpenEncounterPrompt,
  type EncounterCheckInChoice,
  type OpenEncounterPrompt,
} from "@/lib/clinical/encounter-check-in-flow"
import {
  classifyTodayArrivals,
  formatArrivalTime,
} from "@/lib/queue/appointment-arrival"
import { OpenEncounterCheckInDialog } from "@/components/queue/OpenEncounterCheckInDialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Megaphone, Plus, Users, X, Link2, Copy, Check, Calendar, MapPin, Clock, User, Bell, ScanFace, Stethoscope, UserCheck } from "lucide-react"
import { getPatientBillingGate, type PatientBillingGate } from "@/lib/billing/invoice-service"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { generateBranchPublicToken } from "@/lib/kiosk/kiosk-service"
import { notify } from "@/lib/ui/notify"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { createClient } from "@/lib/supabase/client"
import { QueueAnalyticsPanel } from "@/components/analytics/QueueAnalyticsPanel"
import { KioskAnalyticsPanel } from "@/components/analytics/KioskAnalyticsPanel"
import { DisplayAnalyticsPanel } from "@/components/analytics/DisplayAnalyticsPanel"
import { BranchPublicTokensPanel } from "@/components/analytics/BranchPublicTokensPanel"
import { QueueBoard } from "@/components/queue/QueueBoard"
import { VisitCheckoutWizard } from "@/components/queue/VisitCheckoutWizard"

type Tab = "board" | "history"

type PendingCheckInAction = {
  patientId: string
  patientName?: string
  mode: "walk_in" | "appointment_check_in" | "appointment_call"
  appointmentId?: string
  forceCheckin?: boolean
  forceBillingOverride?: boolean
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

// Legacy row kept only to avoid touching older encoded strings in this file.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ArrivalRow({
  appt,
  tone,
  apptCheckInId,
  apptCallId,
  t,
  onCheckIn,
  onCall,
}: {
  appt: AppointmentRecord
  tone: "overdue" | "due" | "upcoming"
  apptCheckInId: string | null
  apptCallId: string | null
  t: (key: string, fallback: string) => string
  onCheckIn: () => void
  onCall: () => void
}) {
  const rowClass =
    tone === "overdue"
      ? "border-red-200 bg-red-50/60"
      : tone === "due"
        ? "border-amber-200 bg-amber-50/50"
        : "border-primary-100 bg-white"

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${rowClass}`}
    >
      <div>
        <span className="font-medium">{formatArrivalTime(appt.scheduled_at)}</span>
        {" · "}
        <Link href={`/patients/${appt.patient_id}`} className="text-primary-600 hover:underline">
          {appt.patient_name ?? "Patient"}
        </Link>
        {appt.purpose ? <span className="text-neutral-500"> · {appt.purpose}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={apptCheckInId === appt.id || apptCallId === appt.id}
          onClick={onCheckIn}
        >
          <UserCheck className="h-3.5 w-3.5" />
          {apptCheckInId === appt.id
            ? t("queue.checkingIn", "Checking in…")
            : t("queue.checkIn", "Check in")}
        </Button>
        <Button
          size="sm"
          className="gap-1"
          disabled={apptCheckInId === appt.id || apptCallId === appt.id}
          onClick={onCall}
        >
          <Megaphone className="h-3.5 w-3.5" />
          {apptCallId === appt.id ? t("queue.calling", "Calling…") : t("queue.callToServe", "Call to chair")}
        </Button>
      </div>
    </div>
  )
}

function ArrivalCheckInRow({
  appt,
  tone,
  apptCheckInId,
  apptCallId,
  minutesUntil,
  t,
  onCheckIn,
  onCall,
}: {
  appt: AppointmentRecord
  tone: "overdue" | "due" | "upcoming"
  apptCheckInId: string | null
  apptCallId: string | null
  minutesUntil: number
  t: (key: string, fallback: string) => string
  onCheckIn: () => void
  onCall: () => void
}) {
  const rowClass =
    tone === "overdue"
      ? "border-red-200 bg-red-50/60"
      : tone === "due"
        ? "border-amber-200 bg-amber-50/50"
        : "border-primary-100 bg-white"
  const timingLabel =
    tone === "overdue"
      ? t("queue.arrivalLate", "{n} min late").replace("{n}", String(Math.abs(minutesUntil)))
      : tone === "due"
        ? t("queue.arrivalDue", "Due now")
        : t("queue.arrivalIn", "In {n} min").replace("{n}", String(minutesUntil))

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${rowClass}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{formatArrivalTime(appt.scheduled_at)}</span>
          <Badge variant={tone === "overdue" ? "danger" : tone === "due" ? "warning" : "outline"}>
            {timingLabel}
          </Badge>
          <Badge variant="outline">{t("queue.notCheckedIn", "Not checked in")}</Badge>
        </div>
        <div className="mt-1 truncate">
          <Link href={`/patients/${appt.patient_id}`} className="text-primary-600 hover:underline">
            {appt.patient_name ?? "Patient"}
          </Link>
          {appt.purpose ? <span className="text-neutral-500"> - {appt.purpose}</span> : null}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {t(
            "queue.arrivalRowHint",
            "Check-in opens today's visit and puts the patient in Waiting."
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={apptCheckInId === appt.id || apptCallId === appt.id}
          onClick={onCheckIn}
        >
          <UserCheck className="h-3.5 w-3.5" />
          {apptCheckInId === appt.id
            ? t("queue.checkingIn", "Checking in...")
            : t("queue.checkInToWaiting", "Check in to Waiting")}
        </Button>
        <Button
          size="sm"
          className="gap-1"
          disabled={apptCheckInId === appt.id || apptCallId === appt.id}
          onClick={onCall}
        >
          <Megaphone className="h-3.5 w-3.5" />
          {apptCallId === appt.id ? t("queue.calling", "Calling...") : t("queue.callDirect", "Call directly")}
        </Button>
      </div>
    </div>
  )
}

export default function QueuePage() {
  const { activeBranch, branchRevision } = useBranch()
  const { t } = useLocale()
  const [tab, setTab] = React.useState<Tab>("board")
  const [entries, setEntries] = React.useState<QueueEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [showCheckIn, setShowCheckIn] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [checkInNotes, setCheckInNotes] = React.useState("")
  const [checkingIn, setCheckingIn] = React.useState(false)
  const [callingNext, setCallingNext] = React.useState(false)
  const [kioskUrl, setKioskUrl] = React.useState<string | null>(null)
  const [displayUrl, setDisplayUrl] = React.useState<string | null>(null)
  const [portalUrl, setPortalUrl] = React.useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = React.useState<"kiosk" | "display" | "portal" | null>(null)
  const [tokenRevision, setTokenRevision] = React.useState(0)
  const [copied, setCopied] = React.useState<string | null>(null)
  const bumpTokenRevision = React.useCallback(() => {
    setTokenRevision((v) => v + 1)
  }, [])
  const [todayAppointments, setTodayAppointments] = React.useState<AppointmentRecord[]>([])
  const [apptCheckInId, setApptCheckInId] = React.useState<string | null>(null)
  const [apptCallId, setApptCallId] = React.useState<string | null>(null)
  const [consentOverridePending, setConsentOverridePending] = React.useState(false)
  const [billingOverridePending, setBillingOverridePending] = React.useState(false)
  const [checkoutWizard, setCheckoutWizard] = React.useState<{
    patientId: string
    patientName: string
    billingGate: PatientBillingGate | null
  } | null>(null)
  const [encounterPrompt, setEncounterPrompt] = React.useState<OpenEncounterPrompt | null>(null)
  const [encounterDialogOpen, setEncounterDialogOpen] = React.useState(false)
  const [pendingCheckIn, setPendingCheckIn] = React.useState<PendingCheckInAction | null>(null)
  const [encounterResolving, setEncounterResolving] = React.useState(false)

  const siteOrigin = typeof window !== "undefined" ? window.location.origin : ""
  const today = toDateKey(new Date())
  const queueFlowSteps = [
    {
      icon: ScanFace,
      title: t("queue.flowStep1", "1. Find patient"),
      description: t(
        "queue.flowStep1Hint",
        "Use today's appointment list for scheduled patients, or search a patient for walk-in."
      ),
    },
    {
      icon: UserCheck,
      title: t("queue.flowStep2", "2. Check in"),
      description: t(
        "queue.flowStep2Hint",
        "Check-in opens today's visit, creates the queue entry, and places the patient in Waiting."
      ),
    },
    {
      icon: Stethoscope,
      title: t("queue.flowStep3", "3. Call to chair"),
      description: t(
        "queue.flowStep3Hint",
        "Call moves the same visit to Now Serving, then In Chair, then checkout."
      ),
    },
  ]

  const openCheckInModal = () => {
    setPatientQuery("")
    setPatients([])
    setSelectedPatientId("")
    setCheckInNotes("")
    setConsentOverridePending(false)
    setBillingOverridePending(false)
    setShowCheckIn(true)
  }

  const closeCheckInModal = () => {
    setPatientQuery("")
    setPatients([])
    setSelectedPatientId("")
    setCheckInNotes("")
    setConsentOverridePending(false)
    setBillingOverridePending(false)
    setShowCheckIn(false)
  }

  const handleGenerateLink = async (type: "kiosk" | "display" | "portal") => {
    if (!activeBranch) return
    setGeneratingLink(type)
    const { data, error: err } = await generateBranchPublicToken(activeBranch.id, type)
    setGeneratingLink(null)
    if (err) setError(err)
    else if (data) {
      if (data.revokedPrevious > 0) {
        notify.info(
          t("display.replacedPreviousLinks", "{n} previous link(s) closed automatically.").replace(
            "{n}",
            String(data.revokedPrevious)
          )
        )
        bumpTokenRevision()
      }
      const url =
        type === "display"
          ? `${siteOrigin}/display?token=${data.token}&theme=light&names=1&voice=1`
          : `${siteOrigin}/${type}?token=${data.token}`
      if (type === "kiosk") setKioskUrl(url)
      else if (type === "portal") setPortalUrl(url)
      else setDisplayUrl(url)
    }
  }

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
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
      fetchQueueEntries(activeBranch.id, tab === "board").then(({ data, error: err }) => {
        setEntries(sortQueueEntries(data))
        setError(err)
        setLoading(false)
      })
    },
    [activeBranch, tab]
  )

  React.useEffect(() => {
    const id = window.setTimeout(() => load(), 0)
    return () => window.clearTimeout(id)
  }, [load, branchRevision])

  React.useEffect(() => {
    if (!activeBranch) return
    void (async () => {
      const { data: noShowResult } = await autoNoShowForBranch(activeBranch.id)
      if (noShowResult && noShowResult.marked > 0) {
        notify.info(
          t("queue.autoNoShowMarked", "{n} overdue appointment(s) marked no-show.").replace(
            "{n}",
            String(noShowResult.marked)
          )
        )
      }
      const { data } = await fetchAppointments(activeBranch.id, today)
      setTodayAppointments(
        data.filter((a) => a.status === "scheduled" || a.status === "confirmed")
      )
    })()
  }, [activeBranch, today, entries, t])

  const queuedAppointmentIds = React.useMemo(
    () => new Set(entries.map((e) => e.appointment_id).filter(Boolean)),
    [entries]
  )

  const pendingAppointmentCheckIns = todayAppointments.filter((a) => !queuedAppointmentIds.has(a.id))

  const arrivalBuckets = React.useMemo(
    () => classifyTodayArrivals(pendingAppointmentCheckIns),
    [pendingAppointmentCheckIns]
  )

  React.useEffect(() => {
    if (tab !== "board" || !activeBranch) return

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
  }, [load, tab, activeBranch])

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
        const { data: billingGate } = await getPatientBillingGate(entry.patient_id)
        setCheckoutWizard({
          patientId: entry.patient_id,
          patientName: entry.patient_name ?? "Patient",
          billingGate,
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
      const { error: err } = await checkInPatient({
        branchId: activeBranch.id,
        patientId: action.patientId,
        notes: checkInNotes || undefined,
        ...options,
      })
      setCheckingIn(false)
      if (err) {
        if (!action.forceCheckin && err.includes("Pending consents")) {
          setConsentOverridePending(true)
        }
        if (!action.forceBillingOverride && err.includes("Billing clearance")) {
          setBillingOverridePending(true)
        }
        setError(err)
        notify.error(err)
      } else {
        closeCheckInModal()
        notify.success(
          t(
            "queue.walkInCheckInSuccess",
            "Walk-in checked in - visit opened and patient is in Waiting."
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
        if (!action.forceCheckin && err.includes("Pending consents")) {
          const ok = await notify.confirm(t("queue.consentOverrideConfirm", "Required consents are unsigned. Check in anyway? This will be logged in audit."))
          if (ok) {
            return executeCheckIn({ ...action, forceCheckin: true }, reuseEncounterId)
          }
        }
        if (!action.forceBillingOverride && err.includes("Billing clearance")) {
          const ok = await notify.confirm(
            t(
              "billing.gateConfirmCheckIn",
              "Patient has outstanding billing. Check in anyway? This will be logged in audit."
            )
          )
          if (ok) {
            return executeCheckIn({ ...action, forceBillingOverride: true }, reuseEncounterId)
          }
        }
        setError(err)
        notify.error(err)
      } else if (data) {
        notify.success(
          t("queue.checkInSuccess", "Checked in — queue #{code}").replace("{code}", data.display_code)
        )
        void load(true)
      }
      return
    }

    if (action.mode === "appointment_call") {
      if (!action.appointmentId) return
      setApptCallId(action.appointmentId)
      setError(null)
      const { data, error: err } = await callAppointmentToServe(action.appointmentId, options)
      setApptCallId(null)
      if (err) {
        if (!action.forceCheckin && err.includes("Pending consents")) {
          const ok = await notify.confirm(t("queue.consentOverrideConfirm", "Required consents are unsigned. Check in anyway? This will be logged in audit."))
          if (ok) {
            return executeCheckIn({ ...action, forceCheckin: true }, reuseEncounterId)
          }
        }
        if (!action.forceBillingOverride && err.includes("Billing clearance")) {
          const ok = await notify.confirm(
            t(
              "billing.gateConfirmCheckIn",
              "Patient has outstanding billing. Check in anyway? This will be logged in audit."
            )
          )
          if (ok) {
            return executeCheckIn({ ...action, forceBillingOverride: true }, reuseEncounterId)
          }
        }
        setError(err)
        notify.error(err)
      } else if (data) {
        const message = data.auto_checked_in
          ? t(
              "queue.autoCheckInAndCall",
              "Auto check-in — now serving #{code}. Patient is on the dentist board."
            ).replace("{code}", data.display_code)
          : t("queue.calledToServe", "Now serving #{code}").replace("{code}", data.display_code)
        notify.success(message)
        void load(true)
      }
    }
  }

  const beginGatedCheckIn = async (action: PendingCheckInAction) => {
    if (!activeBranch) return
    const { prompt, error: promptError } = await loadOpenEncounterPrompt(
      action.patientId,
      activeBranch.id
    )
    if (promptError) {
      notify.error(promptError)
      return
    }
    if (prompt) {
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
    const patient = patients.find((p) => p.id === selectedPatientId)
    await beginGatedCheckIn({
      patientId: selectedPatientId,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
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

  const handleAppointmentCallToServe = async (
    appointmentId: string,
    forceBillingOverride = false,
    forceCheckin = false
  ) => {
    const appt = todayAppointments.find((a) => a.id === appointmentId)
    if (!appt) return
    await beginGatedCheckIn({
      patientId: appt.patient_id,
      patientName: appt.patient_name ?? undefined,
      mode: "appointment_call",
      appointmentId,
      forceBillingOverride,
      forceCheckin,
    })
  }

  const avgWait =
    entries.length > 0
      ? Math.round(entries.reduce((s, e) => s + waitMinutes(e.checked_in_at), 0) / entries.length)
      : 0

  const waitingCount = entries.filter((e) => e.status === "waiting").length
  const servingCount = entries.filter(
    (e) => e.status === "now_serving" || e.status === "in_chair" || e.status === "ready"
  ).length

  const metricItems =
    tab === "board"
      ? [
          {
            label: t("queue.metricInQueue", "In queue"),
            value: loading ? "—" : entries.length,
            hint: activeBranch?.name ?? t("queue.selectBranch", "Select a branch"),
            icon: Users,
          },
          {
            label: t("queue.metricWaiting", "Waiting"),
            value: loading ? "—" : waitingCount,
            hint: t("queue.metricWaitingHint", "Not yet called"),
            variant: waitingCount > 0 ? ("warning" as const) : ("default" as const),
          },
          {
            label: t("queue.metricServing", "Serving"),
            value: loading ? "—" : servingCount,
            hint: t("queue.metricServingHint", "Called or in chair"),
            icon: UserCheck,
          },
          {
            label: t("queue.avgWait", "Avg wait"),
            value: loading || entries.length === 0 ? "—" : `${avgWait} min`,
            hint: t("queue.metricAvgHint", "Since check-in"),
            icon: Clock,
          },
        ]
      : [
          {
            label: t("queue.history", "History"),
            value: loading ? "—" : entries.length,
            hint: t("queue.metricHistoryHint", "Completed today"),
            icon: Users,
          },
        ]

  return (
    <PermissionGate permission={PERMISSIONS.QUEUE_MANAGE}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Users}>
            {t("queue.eyebrow", "Front desk")} · {t("queue.title", "Queue & Patient Flow")}
          </SectionEyebrow>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[10px]">1</span>
              <span>Appointment</span>
            </div>
            <div className="h-0.5 w-8 bg-neutral-200 shrink-0" />
            <div className="flex items-center gap-2 text-primary-600 shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px]">2</span>
              <span>Waiting Room (Queue)</span>
            </div>
            <div className="h-0.5 w-8 bg-neutral-200 shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[10px]">3</span>
              <span>In Chair (Treatment)</span>
            </div>
            <div className="h-0.5 w-8 bg-neutral-200 shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[10px]">4</span>
              <span>Billing & Exit</span>
            </div>
          </div>

          <PageHeader
            title="Queue & Patient Flow"
            description={t(
              "queue.subtitle",
              "Scheduled patients check in here, become a Waiting queue entry, then move to Chair and checkout."
            )}
            actions={
              <>
                <WorkflowSettingsLink />
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={callingNext}
                  onClick={handleCallNext}
                >
                  <Megaphone className="h-4 w-4" /> {t("queue.callNext", "Call next")}
                </Button>
                <Button className="gap-2 shadow-sm" onClick={openCheckInModal}>
                  <Plus className="h-4 w-4" /> {t("queue.checkIn", "Check in")}
                </Button>
              </>
            }
          />

          <div className="grid gap-3 md:grid-cols-3">
            {queueFlowSteps.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.title}
                  className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950">{step.title}</p>
                      <p className="mt-1 text-xs text-neutral-500">{step.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
            <div className="flex flex-wrap items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-medium">
                {t(
                  "queue.flowHintTitle",
                  "Today's patients enter the queue only after check-in."
                )}
              </span>
            </div>
            <p className="mt-1 text-sky-900/80">
              {t(
                "queue.flowHintBody",
                "Appointment check-in and walk-in check-in both open a visit and create a Waiting entry. Call directly skips Waiting only when the patient is ready for the chair."
              )}
            </p>
          </div>

          {activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              {pendingAppointmentCheckIns.length > 0 && tab === "board" ? (
                <Badge variant="warning" className="font-normal">
                  {pendingAppointmentCheckIns.length} {t("queue.apptCheckIn", "appointments to check in")}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <MetricStrip items={metricItems} className={tab === "history" ? "lg:grid-cols-1" : undefined} />

          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "board" ? "default" : "outline"} size="sm" onClick={() => setTab("board")}>
              {t("queue.liveBoard", "Live board")}
            </Button>
            <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")}>
              {t("queue.history", "History")}
            </Button>
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
            />
          ) : null}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}

        {tab === "board" && (
          <Card className="border-primary-200 bg-primary-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t("queue.arrivalsTitle", "Today's arrivals — check in")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingAppointmentCheckIns.length === 0 ? (
                <div className="rounded-md border border-dashed border-primary-200 bg-white/70 px-3 py-4 text-sm text-neutral-600">
                  <p className="font-medium text-neutral-900">
                    {t("queue.arrivalsClearTitle", "No scheduled patients waiting for check-in.")}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t(
                      "queue.arrivalsClearHint",
                      "New arrivals can still be added with walk-in check-in."
                    )}
                  </p>
                </div>
              ) : null}
              {arrivalBuckets.overdue.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                    {t("queue.arrivalsOverdue", "Overdue — may auto no-show")}
                  </p>
                  {arrivalBuckets.overdue.map(({ appointment: appt, minutesUntil }) => (
                    <ArrivalCheckInRow
                      key={appt.id}
                      appt={appt}
                      tone="overdue"
                      apptCheckInId={apptCheckInId}
                      apptCallId={apptCallId}
                      minutesUntil={minutesUntil}
                      t={t}
                      onCheckIn={() => handleAppointmentCheckIn(appt.id)}
                      onCall={() => handleAppointmentCallToServe(appt.id)}
                    />
                  ))}
                </div>
              ) : null}
              {arrivalBuckets.dueNow.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    {t("queue.arrivalsDueNow", "Due now")}
                  </p>
                  {arrivalBuckets.dueNow.map(({ appointment: appt, minutesUntil }) => (
                    <ArrivalCheckInRow
                      key={appt.id}
                      appt={appt}
                      tone="due"
                      apptCheckInId={apptCheckInId}
                      apptCallId={apptCallId}
                      minutesUntil={minutesUntil}
                      t={t}
                      onCheckIn={() => handleAppointmentCheckIn(appt.id)}
                      onCall={() => handleAppointmentCallToServe(appt.id)}
                    />
                  ))}
                </div>
              ) : null}
              {arrivalBuckets.upcoming.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {t("queue.arrivalsUpcoming", "Upcoming")}
                  </p>
                  {arrivalBuckets.upcoming.map(({ appointment: appt, minutesUntil }) => (
                    <ArrivalCheckInRow
                      key={appt.id}
                      appt={appt}
                      tone="upcoming"
                      apptCheckInId={apptCheckInId}
                      apptCallId={apptCallId}
                      minutesUntil={minutesUntil}
                      t={t}
                      onCheckIn={() => handleAppointmentCheckIn(appt.id)}
                      onCall={() => handleAppointmentCallToServe(appt.id)}
                    />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {showCheckIn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-md bg-white border-primary-200 shadow-xl animate-fade-rise">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-base flex items-center justify-between">
                  Walk-in check-in
                  <Button variant="ghost" size="icon" onClick={closeCheckInModal}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleCheckIn} className="space-y-4">
                  <div className="space-y-1 relative">
                    <label className="text-xs font-medium">Search patient</label>
                    {selectedPatientId ? (
                      <div className="flex items-center justify-between rounded-md border border-primary-200 bg-primary-50/50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary-600" />
                          <span className="font-medium text-primary-900">{patientQuery}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-neutral-500 hover:text-neutral-700 hover:bg-transparent"
                          onClick={() => {
                            setSelectedPatientId("")
                            setPatientQuery("")
                            setPatients([])
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          value={patientQuery}
                          onChange={(e) => setPatientQuery(e.target.value)}
                          placeholder="Name or phone…"
                          autoFocus
                        />
                        {patients.length > 0 && (
                          <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg divide-y max-h-48 overflow-y-auto">
                            {patients.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50"
                                  onClick={() => {
                                    setSelectedPatientId(p.id)
                                    setPatientQuery(`${p.first_name} ${p.last_name}`)
                                    setPatients([])
                                  }}
                                >
                                  <div className="font-medium">{p.first_name} {p.last_name}</div>
                                  {p.phone && <div className="text-xs text-neutral-500">{p.phone}</div>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Visit note</label>
                    <Input value={checkInNotes} onChange={(e) => setCheckInNotes(e.target.value)} placeholder="Walk-in reason…" />
                  </div>
                  {billingOverridePending ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                      <p>{t("billing.gateBlockCheckIn", "Outstanding billing must be collected or overridden.")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={checkingIn}
                        onClick={(e) => void handleCheckIn(e as unknown as React.FormEvent, false, true)}
                      >
                        {t("billing.gateOverrideCheckIn", "Check in with billing override")}
                      </Button>
                    </div>
                  ) : null}
                  {consentOverridePending ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                      <p>{t("queue.consentGate", "Patient has unsigned consents. Override is logged in audit.")}</p>
                      {selectedPatientId ? (
                        <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-amber-900" asChild>
                          <Link href={`/patients/${selectedPatientId}?tab=consents`}>
                            {t("queue.openConsents", "Open consents")}
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={checkingIn}
                        onClick={(e) => void handleCheckIn(e as unknown as React.FormEvent, true)}
                      >
                        {t("queue.consentOverride", "Check in anyway")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button type="submit" disabled={checkingIn || !selectedPatientId} className="w-full">
                      {checkingIn ? "Checking in…" : "Check in"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {loading && entries.length === 0 ? (
          <PageLoadingSkeleton variant="grid3" />
        ) : tab === "board" ? (
          <div className="space-y-4">
            {entries.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 border rounded-lg bg-neutral-50">
              <Users className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
              <p>No patients in queue.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={openCheckInModal}>
                <Plus className="h-4 w-4" /> Check in first patient
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {activeBranch ? (
                <div className="md:col-span-3">
                  <QueueBoard
                    entries={entries}
                    branchId={activeBranch.id}
                    actionId={actionId}
                    onAction={handleAction}
                    onReorderError={(msg) => {
                      setError(msg)
                      notify.error(msg)
                    }}
                    onReorderSuccess={() => {
                      notify.success(t("queue.reordered", "Queue order updated"))
                      void load(true)
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}
          {activeBranch ? (
            <div className="space-y-4 mt-8">
              <div className="grid gap-4 lg:grid-cols-2">
                <QueueAnalyticsPanel branchId={activeBranch.id} />
                <KioskAnalyticsPanel branchId={activeBranch.id} />
              </div>
              <DisplayAnalyticsPanel branchId={activeBranch.id} refreshKey={tokenRevision} />
            </div>
          ) : null}
        </div>
      ) : entries.length === 0 ? (
          <p className="text-center py-12 text-neutral-500">No completed queue entries today.</p>
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
                    {entries.map((e) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Kiosk, TV & Portal links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-500">
              Generate links for the patient tablet (kiosk), waiting room TV display, and online patient portal.
              {t(
                "display.generateReplaceHint",
                " New links automatically close older links of the same type."
              )}
            </p>
            {activeBranch ? (
              <BranchPublicTokensPanel branchId={activeBranch.id} onChanged={bumpTokenRevision} />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!activeBranch || generatingLink === "kiosk"}
                onClick={() => handleGenerateLink("kiosk")}
              >
                {generatingLink === "kiosk" ? "Generating…" : "Generate kiosk link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!activeBranch || generatingLink === "display"}
                onClick={() => handleGenerateLink("display")}
              >
                {generatingLink === "display" ? "Generating…" : "Generate TV link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                disabled={!activeBranch || generatingLink === "portal"}
                onClick={() => handleGenerateLink("portal")}
              >
                {generatingLink === "portal" ? "Generating…" : "🌐 Generate portal link"}
              </Button>
            </div>
            {kioskUrl && (
              <div className="flex items-center gap-2 text-sm bg-neutral-50 rounded-md px-3 py-2">
                <span className="truncate flex-1 font-mono text-xs">{kioskUrl}</span>
                <Button variant="ghost" size="icon" onClick={() => copyUrl(kioskUrl, "kiosk")}>
                  {copied === "kiosk" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            {displayUrl && (
              <div className="flex items-center gap-2 text-sm bg-neutral-50 rounded-md px-3 py-2">
                <span className="truncate flex-1 font-mono text-xs">{displayUrl}</span>
                <Button variant="ghost" size="icon" onClick={() => copyUrl(displayUrl, "display")}>
                  {copied === "display" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            {portalUrl && (
              <div className="flex items-center gap-2 text-sm bg-blue-50 rounded-md px-3 py-2 border border-blue-100">
                <span className="truncate flex-1 font-mono text-xs text-blue-800">{portalUrl}</span>
                <Button variant="ghost" size="icon" onClick={() => copyUrl(portalUrl, "portal")}>
                  {copied === "portal" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
