"use client"

import Link from "next/link"
import { Stethoscope } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"

export function ClinicalNotesPreview({
  patientId,
  events,
  error,
  limit = 5,
}: {
  patientId: string
  events: TimelineEvent[]
  error: string | null
  limit?: number
}) {
  const noteEvents = events.filter((e) => e.event_type === "clinical_note").slice(0, limit)

  if (error) {
    return <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</p>
  }

  if (noteEvents.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-neutral-500">
        <Stethoscope className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
        No clinical notes yet.
        <div className="mt-3">
          <Button size="sm" asChild>
            <Link href={`/patients/${patientId}/notes`}>Create first note</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {noteEvents.map((ev) => (
        <li key={ev.event_id} className="border-l-2 border-primary-500 pl-4">
          <div className="flex justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-900">{ev.title}</span>
            <span className="text-xs text-neutral-500 shrink-0">
              {new Date(ev.occurred_at).toLocaleDateString("en-PH")}
            </span>
          </div>
          {ev.subtitle ? (
            <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{ev.subtitle}</p>
          ) : null}
          <Badge variant={ev.status === "signed" ? "success" : "warning"} className="mt-2 text-[10px]">
            {ev.status}
          </Badge>
        </li>
      ))}
      <li className="pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/patients/${patientId}/notes`}>Open full timeline</Link>
        </Button>
      </li>
    </ul>
  )
}
