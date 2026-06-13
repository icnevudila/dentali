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
  fetchQueueEntries,
  updateQueueStatus,
  waitMinutes,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/queue/queue-service"
import {
  checkInAppointment,
  fetchAppointments,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import { toDateKey } from "@/lib/appointments/week-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Megaphone, Plus, Users, X, Link2, Copy, Check, UserCheck, Calendar, MapPin, Clock, FileText } from "lucide-react"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { generateBranchPublicToken } from "@/lib/kiosk/kiosk-service"
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

type Tab = "board" | "history"

const COLUMNS: { key: QueueStatus[]; title: string; borderClass: string }[] = [
  { key: ["waiting", "ready"], title: "Waiting", borderClass: "border-t-2 border-t-amber-500 bg-white" },
  { key: ["now_serving"], title: "Now Serving", borderClass: "border-t-2 border-t-blue-500 bg-white" },
  { key: ["in_chair"], title: "In Chair", borderClass: "border-t-2 border-t-emerald-500 bg-white" },
]

function QueueCard({
  entry,
  onAction,
  loading,
}: {
  entry: QueueEntry
  onAction: (status: QueueStatus, chair?: string) => void
  loading: boolean
}) {
  const mins = waitMinutes(entry.checked_in_at)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-lg font-bold text-primary-700">{entry.display_code}</span>
          <Link href={`/patients/${entry.patient_id}`} className="block text-sm font-medium text-neutral-900 hover:underline">
            {entry.patient_name ?? "Patient"}
          </Link>
        </div>
        <Badge variant={entry.status === "ready" ? "info" : "warning"}>{entry.status.replace("_", " ")}</Badge>
      </div>
      <p className="text-xs text-neutral-500 mt-1">{mins} min waiting</p>
      {entry.chair_label && <p className="text-xs text-neutral-600">Chair: {entry.chair_label}</p>}
      {entry.notes && <p className="text-xs text-neutral-400 mt-1 truncate">{entry.notes}</p>}
      <div className="flex flex-wrap gap-1 mt-2">
        {entry.status === "waiting" && (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => onAction("ready")}>
            Mark ready
          </Button>
        )}
        {(entry.status === "waiting" || entry.status === "ready") && (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => onAction("now_serving")}>
            Call
          </Button>
        )}
        {entry.status === "now_serving" && (
          <Button size="sm" disabled={loading} onClick={() => onAction("in_chair")}>
            In chair
          </Button>
        )}
        {entry.status === "in_chair" && (
          <Button size="sm" variant="default" disabled={loading} onClick={() => onAction("served")}>
            Complete
          </Button>
        )}
        {entry.status !== "served" && (
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => onAction("cancelled")}>
            Cancel
          </Button>
        )}
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
  const [generatingLink, setGeneratingLink] = React.useState<"kiosk" | "display" | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [todayAppointments, setTodayAppointments] = React.useState<AppointmentRecord[]>([])
  const [apptCheckInId, setApptCheckInId] = React.useState<string | null>(null)
  const [consentOverridePending, setConsentOverridePending] = React.useState(false)
  const [servedNotePrompt, setServedNotePrompt] = React.useState<{
    patientId: string
    patientName: string
  } | null>(null)

  const siteOrigin = typeof window !== "undefined" ? window.location.origin : ""
  const today = toDateKey(new Date())

  const handleGenerateLink = async (type: "kiosk" | "display") => {
    if (!activeBranch) return
    setGeneratingLink(type)
    const { data, error: err } = await generateBranchPublicToken(activeBranch.id, type)
    setGeneratingLink(null)
    if (err) setError(err)
    else if (data) {
      const url =
        type === "display"
          ? `${siteOrigin}/display?token=${data.token}&theme=light&names=1&voice=1`
          : `${siteOrigin}/${type}?token=${data.token}`
      if (type === "kiosk") setKioskUrl(url)
      else setDisplayUrl(url)
    }
  }

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const load = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    fetchQueueEntries(activeBranch.id, tab === "board").then(({ data, error: err }) => {
      setEntries(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch, branchRevision, tab])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!activeBranch) return
    fetchAppointments(activeBranch.id, today).then(({ data }) => {
      setTodayAppointments(data.filter((a) => a.status === "scheduled" || a.status === "confirmed"))
    })
  }, [activeBranch, today, entries])

  const queuedAppointmentIds = React.useMemo(
    () => new Set(entries.map((e) => e.appointment_id).filter(Boolean)),
    [entries]
  )

  const pendingAppointmentCheckIns = todayAppointments.filter((a) => !queuedAppointmentIds.has(a.id))

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
          load()
        }
      )
      .subscribe()

    const interval = setInterval(load, 60_000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load, tab, activeBranch])

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

  const handleAction = async (entryId: string, status: QueueStatus) => {
    const entry = entries.find((e) => e.id === entryId)
    setActionId(entryId)
    const { error: err } = await updateQueueStatus(entryId, status)
    setActionId(null)
    if (err) setError(err)
    else {
      if (status === "served" && entry?.patient_id) {
        setServedNotePrompt({
          patientId: entry.patient_id,
          patientName: entry.patient_name ?? "Patient",
        })
      }
      load()
    }
  }

  const handleCheckIn = async (e: React.FormEvent, forceCheckin = false) => {
    e.preventDefault()
    if (!activeBranch || !selectedPatientId) return
    setCheckingIn(true)
    const { error: err } = await checkInPatient({
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      notes: checkInNotes || undefined,
      forceCheckin,
    })
    setCheckingIn(false)
    if (err) {
      if (!forceCheckin && err.includes("Pending consents")) {
        setConsentOverridePending(true)
      }
      setError(err)
    } else {
      setConsentOverridePending(false)
      setShowCheckIn(false)
      setSelectedPatientId("")
      setPatientQuery("")
      setCheckInNotes("")
      load()
    }
  }

  const handleCallNext = async () => {
    if (!activeBranch) return
    setCallingNext(true)
    const { data, error: err } = await callNextPatient(activeBranch.id)
    setCallingNext(false)
    if (err) setError(err)
    else if (!data) setError("No patients waiting in queue")
    else load()
  }

  const handleAppointmentCheckIn = async (appointmentId: string) => {
    setApptCheckInId(appointmentId)
    setError(null)
    const { data, error: err } = await checkInAppointment(appointmentId)
    setApptCheckInId(null)
    if (err) setError(err)
    else if (data) load()
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
              "Check patients in from Appointments, move them to the Chair, and send to Billing."
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
                <Button className="gap-2 shadow-sm" onClick={() => setShowCheckIn(true)}>
                  <Plus className="h-4 w-4" /> {t("queue.checkIn", "Check in")}
                </Button>
              </>
            }
          />

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

          {activeBranch && tab === "board" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <QueueAnalyticsPanel branchId={activeBranch.id} />
                <KioskAnalyticsPanel branchId={activeBranch.id} />
              </div>
              <DisplayAnalyticsPanel branchId={activeBranch.id} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "board" ? "default" : "outline"} size="sm" onClick={() => setTab("board")}>
              {t("queue.liveBoard", "Live board")}
            </Button>
            <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")}>
              {t("queue.history", "History")}
            </Button>
          </div>

          {servedNotePrompt ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 animate-fade-rise">
              <p className="font-medium">
                {servedNotePrompt.patientName} — {t("queue.visitComplete", "visit marked complete")}
              </p>
              <p className="mt-1 text-emerald-800/90">
                {t("queue.notePrompt", "Add a clinical note while the visit is fresh.")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5" asChild>
                  <Link href={`/patients/${servedNotePrompt.patientId}?tab=clinical-notes`}>
                    <FileText className="h-3.5 w-3.5" />
                    {t("queue.createNote", "Create note")}
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setServedNotePrompt(null)}>
                  {t("common.dismiss", "Dismiss")}
                </Button>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={load}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}

        {tab === "board" && pendingAppointmentCheckIns.length > 0 && (
          <Card className="border-primary-200 bg-primary-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Today&apos;s appointments — check in
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingAppointmentCheckIns.map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-100 bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {new Date(appt.scheduled_at).toLocaleTimeString("en-PH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {" · "}
                    <Link href={`/patients/${appt.patient_id}`} className="text-primary-600 hover:underline">
                      {appt.patient_name ?? "Patient"}
                    </Link>
                    {appt.purpose && <span className="text-neutral-500"> · {appt.purpose}</span>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={apptCheckInId === appt.id}
                    onClick={() => handleAppointmentCheckIn(appt.id)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {apptCheckInId === appt.id ? "Checking in…" : "Check in"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {showCheckIn && (
          <Card className="border-primary-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                Check in patient
                <Button variant="ghost" size="icon" onClick={() => setShowCheckIn(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCheckIn} className="space-y-3 max-w-md">
                <div className="space-y-1 relative">
                  <label className="text-xs font-medium">Search patient</label>
                  <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Name or phone…" />
                  {patients.length > 0 && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg divide-y max-h-48 overflow-y-auto">
                      {patients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${selectedPatientId === p.id ? "bg-primary-50" : ""}`}
                            onClick={() => {
                              setSelectedPatientId(p.id)
                              setPatientQuery(`${p.first_name} ${p.last_name}`)
                              setPatients([])
                            }}
                          >
                            {p.first_name} {p.last_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Notes</label>
                  <Input value={checkInNotes} onChange={(e) => setCheckInNotes(e.target.value)} placeholder="Walk-in reason…" />
                </div>
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
                <div className="flex gap-2">
                  <Button type="submit" disabled={checkingIn || !selectedPatientId}>
                    {checkingIn ? "Checking in…" : "Check in"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCheckIn(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <PageLoadingSkeleton variant="grid3" />
        ) : tab === "board" ? (
          entries.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 border rounded-lg bg-neutral-50">
              <Users className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
              <p>No patients in queue.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCheckIn(true)}>
                <Plus className="h-4 w-4" /> Check in first patient
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {COLUMNS.map((col) => {
                const colEntries = entries.filter((e) => col.key.includes(e.status))
                return (
                  <div key={col.title} className={`rounded-lg border border-neutral-200 p-4 min-h-[200px] shadow-sm ${col.borderClass}`}>
                    <h2 className="font-semibold text-sm text-neutral-700 mb-3">
                      {col.title}
                      <span className="ml-2 text-neutral-400">({colEntries.length})</span>
                    </h2>
                    <div className="space-y-2">
                      {colEntries.map((entry) => (
                        <QueueCard
                          key={entry.id}
                          entry={entry}
                          loading={actionId === entry.id}
                          onAction={(status) => handleAction(entry.id, status)}
                        />
                      ))}
                      {colEntries.length === 0 && (
                        <p className="text-xs text-neutral-400 py-4 text-center">Empty</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
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
              <Link2 className="h-4 w-4" /> Kiosk & TV links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-500">
              Generate links for the patient tablet (kiosk) and waiting room TV display.
            </p>
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
          </CardContent>
        </Card>
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}
