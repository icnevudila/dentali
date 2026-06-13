"use client"

import { maskPatientFullName } from "@/lib/display/mask-patient-name"
import type { QueueEntry } from "@/lib/queue/queue-service"
import { QueueDisplayBoard } from "@/components/display/QueueDisplayBoard"

type DisplayShowcasePanelProps = {
  branchName: string
  entries: QueueEntry[]
}

/** Same board layout as `/display` — fed from live showcase queue data. */
export function DisplayShowcasePanel({ branchName, entries }: DisplayShowcasePanelProps) {
  const nowServing = entries
    .filter((e) => e.status === "now_serving")
    .map((e) => ({
      display_code: e.display_code,
      masked_name: maskPatientFullName(e.patient_name),
    }))
  const waiting = entries
    .filter((e) => ["waiting", "ready"].includes(e.status))
    .map((e) => ({
      display_code: e.display_code,
      masked_name: maskPatientFullName(e.patient_name),
    }))

  return (
    <QueueDisplayBoard
      branchName={branchName}
      nowServing={nowServing}
      waiting={waiting}
      theme="light"
      updatedAt={new Date().toISOString()}
      className="min-h-full"
    />
  )
}
