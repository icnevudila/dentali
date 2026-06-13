"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  FileText,
  Plus,
  Save,
  PenLine,
  Stethoscope,
  Maximize2,
  Users,
} from "lucide-react"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import {
  createClinicalNote,
  fetchPatientTimeline,
  getClinicalNote,
  signClinicalNote,
  updateClinicalNote,
  type ClinicalNote,
  type TimelineEvent,
} from "@/lib/clinical/clinical-notes-service"

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const map = new Map<string, TimelineEvent[]>()
  for (const ev of events) {
    const key = new Date(ev.occurred_at).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const list = map.get(key) ?? []
    list.push(ev)
    map.set(key, list)
  }
  return map
}

function NoteEditor({
  note,
  onSaved,
  onSigned,
}: {
  note: ClinicalNote
  onSaved: () => void
  onSigned: () => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = React.useState(note.title)
  const [subjective, setSubjective] = React.useState(note.subjective ?? "")
  const [objective, setObjective] = React.useState(note.objective ?? "")
  const [assessment, setAssessment] = React.useState(note.assessment ?? "")
  const [plan, setPlan] = React.useState(note.plan ?? "")
  const [saving, setSaving] = React.useState(false)
  const [signing, setSigning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const readOnly = note.status === "signed"

  const save = async () => {
    if (!user || readOnly) return
    setSaving(true)
    setError(null)
    const { error: err } = await updateClinicalNote(note.id, user.id, {
      title,
      subjective,
      objective,
      assessment,
      plan,
    })
    if (err) setError(err)
    else onSaved()
    setSaving(false)
  }

  const sign = async () => {
    if (!user || readOnly) return
    setSigning(true)
    setError(null)
    await updateClinicalNote(note.id, user.id, { title, subjective, objective, assessment, plan })
    const { error: err } = await signClinicalNote(note.id)
    if (err) {
      setError(err)
    } else {
      const org = await fetchOrganization()
      if (org) {
        await logAuditEvent({
          organizationId: org.id,
          branchId: note.branch_id,
          action: "patient.update",
          entityType: "clinical_note",
          entityId: note.id,
          metadata: { op: "signed" },
        })
      }
      onSigned()
    }
    setSigning(false)
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    rows = 3
  ) => (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</label>
      {readOnly ? (
        <p className="text-sm text-neutral-800 whitespace-pre-wrap min-h-[2rem]">{value || "—"}</p>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      )}
    </div>
  )

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          {readOnly ? (
            <CardTitle className="text-base">{title}</CardTitle>
          ) : (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-semibold" />
          )}
          <CardDescription>
            {readOnly ? "Signed — read only" : "Draft — save or sign to lock"}
          </CardDescription>
        </div>
        <Badge variant={readOnly ? "success" : "info"} className="shrink-0">
          {note.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
        ) : null}
        {field("Subjective", subjective, setSubjective)}
        {field("Objective", objective, setObjective)}
        {field("Assessment", assessment, setAssessment)}
        {field("Plan", plan, setPlan, 4)}
        {!readOnly ? (
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={save} disabled={saving || signing} variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button onClick={sign} disabled={saving || signing} className="gap-2">
              <PenLine className="h-4 w-4" />
              {signing ? "Signing…" : "Sign & Lock"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ClinicalNotesWorkspace({
  patientId,
  patientName: patientNameProp,
  embedded = false,
}: {
  patientId: string
  patientName?: string
  embedded?: boolean
}) {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const [patientName, setPatientName] = React.useState(patientNameProp ?? "")
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([])
  const [selectedNote, setSelectedNote] = React.useState<ClinicalNote | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<"all" | "notes" | "appointments">("all")

  const load = React.useCallback(async () => {
    setLoading(true)
    const timelineResult = await fetchPatientTimeline(patientId)
    setTimeline(timelineResult.data)
    setError(timelineResult.error)
    setLoading(false)
  }, [patientId])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (patientNameProp) setPatientName(patientNameProp)
  }, [patientNameProp])

  const openNote = async (noteId: string) => {
    const { data, error: noteError } = await getClinicalNote(noteId)
    if (noteError) setError(noteError)
    else setSelectedNote(data)
  }

  const handleNewNote = async () => {
    if (!user || !activeBranch) return
    setCreating(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setCreating(false)
      return
    }
    const { data, error: createError } = await createClinicalNote({
      patientId,
      organizationId: org.id,
      branchId: activeBranch.id,
      userId: user.id,
    })
    if (createError || !data) {
      setError(createError ?? "Failed to create note")
    } else {
      await load()
      await openNote(data.id)
    }
    setCreating(false)
  }

  const filtered = timeline.filter((ev) => {
    if (filter === "notes") return ev.event_type === "clinical_note"
    if (filter === "appointments") return ev.event_type === "appointment"
    return true
  })
  const grouped = groupByDate(filtered)

  if (loading) {
    return (
      <PageLoadingSkeleton
        variant="detail"
        className={embedded ? "max-w-full py-4" : "max-w-6xl px-4 sm:px-6 py-6"}
      />
    )
  }

  const inner = (
    <>
      {!embedded ? (
        <div className="space-y-4 animate-page-enter">
          <SectionEyebrow icon={Users}>Clinical · Notes</SectionEyebrow>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button variant="ghost" size="icon" className="shrink-0 self-start" asChild>
              <Link href={`/patients/${patientId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950">Clinical notes</h1>
              <p className="text-sm text-neutral-500 truncate">
                {patientName ? `${patientName} — ` : ""}visit timeline & SOAP notes
              </p>
            </div>
            <PermissionGate permission={PERMISSIONS.DENTAL_CHART_WRITE}>
              <Button onClick={handleNewNote} disabled={creating || !activeBranch} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                {creating ? "Creating…" : "New Note"}
              </Button>
            </PermissionGate>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "notes", "appointments"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "notes" ? "Notes" : "Appointments"}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <PermissionGate permission={PERMISSIONS.DENTAL_CHART_WRITE}>
              <Button
                size="sm"
                onClick={handleNewNote}
                disabled={creating || !activeBranch}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Creating…" : "New Note"}
              </Button>
            </PermissionGate>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href={`/patients/${patientId}/notes`}>
                <Maximize2 className="h-3.5 w-3.5" />
                Full screen
              </Link>
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!embedded ? (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {(["all", "notes", "appointments"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="shrink-0"
            >
              {f === "all" ? "All" : f === "notes" ? "Notes" : "Appointments"}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
          {grouped.size === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-neutral-500">
                <Stethoscope className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
                <p>No timeline events yet.</p>
                <p className="text-sm mt-1">Create a clinical note or book an appointment.</p>
              </CardContent>
            </Card>
          ) : (
            Array.from(grouped.entries()).map(([date, events]) => (
              <div key={date}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2 sticky top-0 bg-white/95 py-1 z-10">
                  {date}
                </h3>
                <ul className="space-y-2">
                  {events.map((ev) => (
                    <li key={`${ev.event_type}-${ev.event_id}`}>
                      <button
                        type="button"
                        onClick={() =>
                          ev.event_type === "clinical_note" ? openNote(ev.event_id) : undefined
                        }
                        className={`w-full text-left rounded-lg border p-3 sm:p-4 transition-colors ${
                          ev.event_type === "clinical_note"
                            ? "hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer"
                            : "bg-neutral-50 cursor-default"
                        } ${
                          selectedNote?.id === ev.event_id
                            ? "border-primary-400 bg-primary-50/50"
                            : "border-neutral-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {ev.event_type === "clinical_note" ? (
                            <FileText className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" />
                          ) : (
                            <Calendar className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-neutral-900">{ev.title}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {ev.status}
                              </Badge>
                            </div>
                            {ev.subtitle ? (
                              <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{ev.subtitle}</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="min-h-[280px]">
          {selectedNote ? (
            <NoteEditor
              note={selectedNote}
              onSaved={async () => {
                await load()
                await openNote(selectedNote.id)
              }}
              onSigned={async () => {
                setSelectedNote(null)
                await load()
              }}
            />
          ) : (
            <Card className="border-dashed h-full min-h-[280px]">
              <CardContent className="py-12 sm:py-16 text-center text-neutral-500 text-sm flex flex-col items-center justify-center h-full">
                <FileText className="h-8 w-8 text-neutral-300 mb-3" />
                Select a clinical note from the timeline to view or edit.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <div className={embedded ? "space-y-4" : "max-w-5xl mx-auto pb-10 space-y-6"}>{inner}</div>
    </PermissionGate>
  )
}
