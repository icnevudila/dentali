"use client"

import { WalkInCheckInDialog, type WalkInCheckInDialogProps } from "@/components/queue/WalkInCheckInDialog"

export type PatientArrivalDialogProps = WalkInCheckInDialogProps

export function PatientArrivalDialog(props: PatientArrivalDialogProps) {
  return <WalkInCheckInDialog {...props} />
}
