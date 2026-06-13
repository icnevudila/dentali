"use client"

import * as React from "react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import {
  bookFromWaitlist,
  cancelWaitlistEntry,
  createWaitlistEntry,
  fetchContactAttempts,
  fetchWaitlistEntries,
  markWaitlistContacted,
  type ContactAttempt,
  type ContactOutcome,
  type WaitlistEntry,
  type WaitlistUrgency,
} from "@/lib/waitlist/waitlist-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Clock, Plus, X, MapPin } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { StatusPipeline, waitlistPipelineSteps } from "@/components/visual/StatusPipeline"
import { WaitlistEntryList } from "@/components/waitlist/WaitlistEntryList"
import { WaitlistAnalyticsPanel } from "@/components/analytics/WaitlistAnalyticsPanel"

type TabFilter = "active" | "history"

export default function WaitlistPage() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()
  const [tab, setTab] = React.useState<TabFilter>("active")
  const [entries, setEntries] = React.useState<WaitlistEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showAdd, setShowAdd] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [urgency, setUrgency] = React.useState<WaitlistUrgency>("normal")
  const [preferredDate, setPreferredDate] = React.useState("")
  const [timeStart, setTimeStart] = React.useState("")
  const [timeEnd, setTimeEnd] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [contactEntry, setContactEntry] = React.useState<WaitlistEntry | null>(null)
  const [contactNote, setContactNote] = React.useState("")
  const [contactOutcome, setContactOutcome] = React.useState<ContactOutcome>("reached")
  const [contactHistory, setContactHistory] = React.useState<ContactAttempt[]>([])
  const [bookEntry, setBookEntry] = React.useState<WaitlistEntry | null>(null)
  const [bookDate, setBookDate] = React.useState("")
  const [bookTime, setBookTime] = React.useState("09:00")
  const [bookPurpose, setBookPurpose] = React.useState("")
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    fetchWaitlistEntries(activeBranch.id, tab).then(({ data, error: err }) => {
      setEntries(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch, tab])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) {
      setPatients([])
      return
    }
    const timer = setTimeout(() => {
      searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data))
    }, 300)
    return () => clearTimeout(timer)
  }, [patientQuery, activeBranch])

  React.useEffect(() => {
    if (!contactEntry) {
      setContactHistory([])
      return
    }
    fetchContactAttempts(contactEntry.id).then(({ data }) => setContactHistory(data))
  }, [contactEntry])

  const waitingCount = entries.filter((e) => e.status === "waiting").length
  const contactedCount = entries.filter((e) => e.status === "contacted").length

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId) return
    setSaving(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }
    const { error: err } = await createWaitlistEntry({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      urgency,
      preferredDate: preferredDate || undefined,
      preferredTimeStart: timeStart || undefined,
      preferredTimeEnd: timeEnd || undefined,
      notes: notes || undefined,
      userId: user.id,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setShowAdd(false)
      setSelectedPatientId("")
      setPatientQuery("")
      setNotes("")
      load()
    }
  }

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactEntry) return
    setActionLoading(contactEntry.id)
    const { error: err } = await markWaitlistContacted(contactEntry.id, contactNote, contactOutcome)
    setActionLoading(null)
    if (err) setError(err)
    else {
      setContactEntry(null)
      setContactNote("")
      load()
    }
  }

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookEntry || !bookDate) return
    setActionLoading(bookEntry.id)
    const scheduledAt = new Date(`${bookDate}T${bookTime}:00`).toISOString()
    const { error: err } = await bookFromWaitlist(bookEntry.id, scheduledAt, bookPurpose || bookEntry.notes || undefined)
    setActionLoading(null)
    if (err) setError(err)
    else {
      setBookEntry(null)
      setBookDate("")
      load()
    }
  }

  const handleCancel = async (entryId: string) => {
    setActionLoading(entryId)
    const { error: err } = await cancelWaitlistEntry(entryId)
    setActionLoading(null)
    if (err) setError(err)
    else load()
  }

  const metricItems =
    tab === "active"
      ? [
          {
            label: t("waitlist.active", "Active"),
            value: loading ? "—" : entries.length,
            hint: t("waitlist.metricActiveHint", "On waitlist now"),
            icon: Clock,
          },
          {
            label: t("waitlist.metricWaiting", "Waiting"),
            value: loading ? "—" : waitingCount,
            hint: t("waitlist.metricWaitingHint", "Not yet contacted"),
            variant: waitingCount > 0 && !loading ? ("warning" as const) : ("default" as const),
          },
          {
            label: t("waitlist.metricContacted", "Contacted"),
            value: loading ? "—" : contactedCount,
            hint: t("waitlist.metricContactedHint", "Follow-up in progress"),
            icon: Clock,
          },
        ]
      : [
          {
            label: t("waitlist.history", "History"),
            value: loading ? "—" : entries.length,
            hint: t("waitlist.metricHistoryHint", "Booked, cancelled, expired"),
            icon: Clock,
          },
        ]

  return (
    <PermissionGate permission={PERMISSIONS.APPOINTMENTS_READ}>
      <ModulePageShell
        eyebrow={`${t("waitlist.eyebrow", "Scheduling")} · ${t("waitlist.title", "Waitlist")}`}
        icon={Clock}
        title={t("waitlist.title", "Waitlist")}
        description={t(
          "waitlist.registrySubtitle",
          "First-in-first-served queue with urgency priority when slots open."
        )}
        actions={
          <Button className="gap-2 shadow-sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> {t("waitlist.addPatient", "Add to waitlist")}
          </Button>
        }
        badges={
          activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              <Badge variant="outline" className="font-normal capitalize">
                {tab === "active" ? t("waitlist.active", "Active") : t("waitlist.history", "History")}
              </Badge>
            </div>
          ) : null
        }
        metrics={metricItems}
        metricsClassName={tab === "history" ? "lg:grid-cols-1" : "lg:grid-cols-3"}
        error={error && !loading ? error : null}
        onRetry={load}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "active" ? "default" : "outline"} size="sm" onClick={() => setTab("active")}>
            {t("waitlist.active", "Active")}
          </Button>
          <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")}>
            {t("waitlist.history", "History")}
          </Button>
        </div>

        {activeBranch && tab === "active" ? (
          <WaitlistAnalyticsPanel branchId={activeBranch.id} />
        ) : null}

        {showAdd && (
          <Card className="border-primary-200 animate-fade-rise">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {t("waitlist.addFormTitle", "Add patient to waitlist")}
                <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-medium">{t("appointments.searchPatient", "Search patient")}</label>
                  <Input
                    placeholder={t("appointments.searchPatientPlaceholder", "Name or phone…")}
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                  />
                  {patients.length > 0 && (
                    <ul className="border rounded-md divide-y max-h-40 overflow-y-auto">
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
                            {p.phone ? ` · ${p.phone}` : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t("waitlist.urgency", "Urgency")}</label>
                  <select
                    className="w-full h-9 rounded-md border border-neutral-200 px-3 text-sm"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as WaitlistUrgency)}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t("waitlist.preferredDate", "Preferred date")}</label>
                  <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t("waitlist.timeFrom", "Time from")}</label>
                  <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t("waitlist.timeTo", "Time to")}</label>
                  <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium">{t("waitlist.notes", "Notes")}</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Procedure or preference…" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving || !selectedPatientId}>
                    {saving ? t("common.saving", "Saving…") : t("waitlist.addPatient", "Add to waitlist")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                    {t("common.cancel", "Cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <SectionEyebrow icon={Clock}>
            {tab === "active"
              ? t("waitlist.listActive", "Active queue")
              : t("waitlist.listHistory", "History")}{" "}
            · {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </SectionEyebrow>

          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {loading ? (
              <PageLoadingSkeleton variant="inline" />
            ) : entries.length === 0 ? (
              <div className="py-8">
                <div className="text-center">
                  <Clock className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
                  <p className="mt-3 font-semibold text-neutral-900">
                    {tab === "active" ? t("waitlist.emptyActiveTitle", "No active entries") : t("waitlist.emptyHistoryTitle", "No history")}
                  </p>
                  <p className="text-sm mt-1 max-w-md mx-auto">
                    {tab === "active"
                      ? t("waitlist.emptyActiveHint", "Each row shows urgency, contact progress, and quick actions.")
                      : t("waitlist.emptyHistoryHint", "Booked, cancelled, and expired entries appear here.")}
                  </p>
                  {tab === "active" && (
                    <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAdd(true)}>
                      <Plus className="h-4 w-4" /> {t("waitlist.addFirst", "Add first entry")}
                    </Button>
                  )}
                </div>
                {tab === "active" ? (
                  <div className="mt-12 mx-auto max-w-xl rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-4 pointer-events-none select-none">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                      {t("waitlist.previewLabel", "Preview — how entries will look")}
                    </p>
                    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm border-l-4 border-l-amber-500">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-neutral-900">Maria Santos</p>
                          <p className="text-sm text-neutral-500">+63 917 123 4567 · Any available slot</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              waiting
                            </span>
                            <span className="inline-flex rounded-md border px-2 py-0.5 text-xs text-neutral-600">
                              Urgent
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 max-w-[220px]">
                        <StatusPipeline steps={waitlistPipelineSteps("waiting")} compact />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <WaitlistEntryList
                entries={entries}
                tab={tab}
                actionLoading={actionLoading}
                slotAlertLabel={t("waitlist.slotAlertSent", "Slot alert sent")}
                onContact={(entry) => {
                  setContactEntry(entry)
                  setContactOutcome("reached")
                  setContactNote("")
                }}
                onBook={(entry) => {
                  setBookEntry(entry)
                  setBookDate(entry.preferred_date ?? "")
                  setBookTime(entry.preferred_time_start?.slice(0, 5) ?? "09:00")
                  setBookPurpose(entry.notes ?? "")
                }}
                onCancel={handleCancel}
              />
            )}
          </div>
        </div>

        {contactEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md animate-fade-rise">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("waitlist.contactTitle", "Contact")} — {contactEntry.patient_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contactHistory.length > 0 && (
                  <div className="mb-4 space-y-2 max-h-32 overflow-y-auto">
                    <p className="text-xs font-medium text-neutral-500">{t("waitlist.previousAttempts", "Previous attempts")}</p>
                    {contactHistory.map((a) => (
                      <div key={a.id} className="text-xs border rounded px-2 py-1">
                        <span className="font-medium">{a.outcome}</span>
                        {a.note && ` — ${a.note}`}
                        <span className="text-neutral-400 ml-2">
                          {new Date(a.created_at).toLocaleString("en-PH")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleContact} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("waitlist.outcome", "Outcome")}</label>
                    <select
                      className="w-full h-9 rounded-md border border-neutral-200 px-3 text-sm"
                      value={contactOutcome}
                      onChange={(e) => setContactOutcome(e.target.value as ContactOutcome)}
                    >
                      <option value="reached">Reached</option>
                      <option value="no_answer">No answer</option>
                      <option value="voicemail">Voicemail</option>
                      <option value="declined">Declined — remove</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("waitlist.note", "Note")}</label>
                    <Input value={contactNote} onChange={(e) => setContactNote(e.target.value)} placeholder="Call summary…" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={actionLoading === contactEntry.id}>
                      {actionLoading === contactEntry.id ? t("common.saving", "Saving…") : t("waitlist.logContact", "Log contact")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setContactEntry(null)}>
                      {t("common.close", "Close")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {bookEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md animate-fade-rise">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("waitlist.bookTitle", "Book appointment")} — {bookEntry.patient_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBook} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("appointments.date", "Date")}</label>
                    <Input type="date" required value={bookDate} onChange={(e) => setBookDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("appointments.time", "Time")}</label>
                    <Input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium">{t("appointments.purpose", "Purpose")}</label>
                    <Input value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="submit" disabled={actionLoading === bookEntry.id}>
                      {actionLoading === bookEntry.id
                        ? t("appointments.booking", "Booking…")
                        : t("waitlist.createAppointment", "Create appointment")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setBookEntry(null)}>
                      {t("common.cancel", "Cancel")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
