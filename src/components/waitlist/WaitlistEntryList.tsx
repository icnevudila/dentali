"use client"

import Link from "next/link"
import { Calendar, Phone, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RecordRow, patientInitials } from "@/components/layout/RecordRow"
import { StatusPipeline, waitlistPipelineSteps } from "@/components/visual/StatusPipeline"
import type { WaitlistEntry, WaitlistUrgency } from "@/lib/waitlist/waitlist-service"
import { cn } from "@/lib/utils"

const URGENCY_LABEL: Record<WaitlistUrgency, string> = {
  normal: "Normal",
  urgent: "Urgent",
  high: "High",
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info" | "outline"> = {
  waiting: "warning",
  contacted: "info",
  booked: "success",
  cancelled: "outline",
  expired: "danger",
}

function urgencyStripe(urgency: WaitlistUrgency) {
  if (urgency === "high") return "border-l-red-500"
  if (urgency === "urgent") return "border-l-amber-500"
  return "border-l-neutral-200"
}

export function WaitlistEntryList({
  entries,
  tab,
  actionLoading,
  slotAlertLabel,
  canWrite = true,
  onContact,
  onBook,
  onCancel,
}: {
  entries: WaitlistEntry[]
  tab: "active" | "history"
  actionLoading: string | null
  slotAlertLabel: string
  canWrite?: boolean
  onContact: (entry: WaitlistEntry) => void
  onBook: (entry: WaitlistEntry) => void
  onCancel: (entryId: string) => void
}) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const name = entry.patient_name ?? "Patient"
        const parts = name.split(" ")
        const preference = entry.preferred_date
          ? `${entry.preferred_date}${entry.preferred_time_start ? ` · ${entry.preferred_time_start.slice(0, 5)}` : ""}`
          : "Any available slot"

        return (
          <RecordRow
            key={entry.id}
            href={tab === "history" ? `/patients/${entry.patient_id}` : undefined}
            initials={patientInitials(parts[0] ?? "P", parts.slice(1).join(" ") || "?")}
            className={cn("border-l-4", urgencyStripe(entry.urgency))}
            primary={
              tab === "active" ? (
                <Link
                  href={`/patients/${entry.patient_id}`}
                  className="font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {name}
                </Link>
              ) : (
                name
              )
            }
            secondary={[entry.patient_phone, preference].filter(Boolean).join(" · ")}
            meta={
              <>
                <Badge variant={STATUS_VARIANT[entry.status] ?? "default"}>{entry.status}</Badge>
                <Badge variant="outline" className="font-normal">
                  {URGENCY_LABEL[entry.urgency]}
                </Badge>
                {entry.slot_alert_sent_at ? (
                  <Badge variant="info" className="text-[10px] font-normal">
                    {slotAlertLabel}
                  </Badge>
                ) : null}
                <div className="w-full min-w-[120px] max-w-[200px] pt-1 sm:w-auto">
                  <StatusPipeline
                    steps={waitlistPipelineSteps(
                      entry.status as "waiting" | "contacted" | "booked" | "cancelled" | "expired"
                    )}
                    compact
                  />
                </div>
              </>
            }
            trailing={
              tab === "active" && canWrite ? (
                <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={actionLoading === entry.id}
                    onClick={() => onContact(entry)}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Contact
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={actionLoading === entry.id}
                    onClick={() => onBook(entry)}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Book
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionLoading === entry.id}
                    onClick={() => onCancel(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
                  </Button>
                </div>
              ) : tab === "active" ? (
                <span className="text-xs text-neutral-400">
                  {new Date(entry.created_at).toLocaleDateString("en-PH")}
                </span>
              ) : entry.appointment_id ? (
                <Button size="sm" variant="link" asChild onClick={(e) => e.stopPropagation()}>
                  <Link href="/appointments">View appointment</Link>
                </Button>
              ) : (
                <span className="text-xs text-neutral-400">
                  {new Date(entry.created_at).toLocaleDateString("en-PH")}
                </span>
              )
            }
          />
        )
      })}
    </div>
  )
}
