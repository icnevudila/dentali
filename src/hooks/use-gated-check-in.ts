"use client"

import * as React from "react"
import { checkInAppointment } from "@/lib/appointments/appointment-service"
import {
  applyEncounterCheckInChoice,
  loadOpenEncounterPrompt,
  type EncounterCheckInChoice,
  type OpenEncounterPrompt,
} from "@/lib/clinical/encounter-check-in-flow"
import { checkInPatient } from "@/lib/queue/queue-service"
import { notify } from "@/lib/ui/notify"

export type PendingCheckInAction = {
  patientId: string
  patientName?: string
  mode: "walk_in" | "appointment_check_in"
  appointmentId?: string
  forceCheckin?: boolean
  forceBillingOverride?: boolean
  notes?: string
}

function isConsentGateError(message: string) {
  return message.includes("Intake consents") || message.includes("Pending consents")
}

type Translate = (key: string, fallback: string) => string

export function useGatedCheckIn({
  branchId,
  onSuccess,
  t,
}: {
  branchId: string | undefined
  onSuccess?: () => void
  t: Translate
}) {
  const [checkingIn, setCheckingIn] = React.useState(false)
  const [apptCheckInId, setApptCheckInId] = React.useState<string | null>(null)
  const [encounterPrompt, setEncounterPrompt] = React.useState<OpenEncounterPrompt | null>(null)
  const [encounterDialogOpen, setEncounterDialogOpen] = React.useState(false)
  const [pendingCheckIn, setPendingCheckIn] = React.useState<PendingCheckInAction | null>(null)
  const [encounterResolving, setEncounterResolving] = React.useState(false)

  const executeCheckIn = React.useCallback(
    async (action: PendingCheckInAction, reuseEncounterId: string | null) => {
      if (!branchId) return

      const options = {
        forceCheckin: action.forceCheckin,
        forceBillingOverride: action.forceBillingOverride,
        reuseEncounterId: reuseEncounterId ?? undefined,
      }

      if (action.mode === "walk_in") {
        setCheckingIn(true)
        const { error: err } = await checkInPatient({
          branchId,
          patientId: action.patientId,
          notes: action.notes,
          ...options,
        })
        setCheckingIn(false)
        if (err) {
          notify.error(err)
          return { error: err, needsConsentOverride: isConsentGateError(err), needsBillingOverride: err.includes("Billing clearance") }
        }
        notify.success(
          t(
            "queue.walkInCheckInSuccess",
            "Walk-in checked in - visit opened and patient is in Waiting."
          )
        )
        onSuccess?.()
        return { error: null }
      }

      if (!action.appointmentId) return { error: "Missing appointment" }

      setApptCheckInId(action.appointmentId)
      const { data, error: err } = await checkInAppointment(action.appointmentId, options)
      setApptCheckInId(null)

      if (err) {
        if (!action.forceCheckin && isConsentGateError(err)) {
          const ok = await notify.confirm(
            t(
              "queue.consentOverrideConfirm",
              "Intake consents (privacy and general treatment) are unsigned. Check in anyway? This will be logged in audit."
            )
          )
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
        notify.error(err)
        return { error: err }
      }

      if (data) {
        notify.success(
          t("queue.checkInSuccess", "Checked in — queue #{code}").replace("{code}", data.display_code)
        )
        onSuccess?.()
      }
      return { error: null }
    },
    [branchId, onSuccess, t]
  )

  const beginGatedCheckIn = React.useCallback(
    async (action: PendingCheckInAction) => {
      if (!branchId) return
      const { prompt, error: promptError } = await loadOpenEncounterPrompt(action.patientId, branchId)
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
    },
    [branchId, executeCheckIn]
  )

  const handleEncounterChoice = React.useCallback(
    async (choice: EncounterCheckInChoice) => {
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
    },
    [encounterPrompt, executeCheckIn, pendingCheckIn]
  )

  const closeEncounterDialog = React.useCallback(() => {
    if (encounterResolving) return
    setEncounterDialogOpen(false)
    setEncounterPrompt(null)
    setPendingCheckIn(null)
  }, [encounterResolving])

  const checkInFromAppointment = React.useCallback(
    (params: {
      appointmentId: string
      patientId: string
      patientName?: string
    }) =>
      beginGatedCheckIn({
        patientId: params.patientId,
        patientName: params.patientName,
        mode: "appointment_check_in",
        appointmentId: params.appointmentId,
      }),
    [beginGatedCheckIn]
  )

  return {
    checkingIn,
    apptCheckInId,
    encounterPrompt,
    encounterDialogOpen,
    pendingCheckIn,
    encounterResolving,
    beginGatedCheckIn,
    checkInFromAppointment,
    handleEncounterChoice,
    closeEncounterDialog,
    executeCheckIn,
  }
}
