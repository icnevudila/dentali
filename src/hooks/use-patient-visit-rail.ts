"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useBranch } from "@/hooks/use-branch"
import {
  buildClinicalVisitJourney,
  buildEncounterVisitJourney,
  type ClinicalVisitJourney,
} from "@/lib/clinical/clinical-visit-journey"
import { fetchActiveEncounter } from "@/lib/clinical/encounter-service"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { fetchPatientConsents } from "@/lib/patients/consent-service"
import { getPatient } from "@/lib/patients/patient-service"
import {
  readVisitJourneyCache,
  rememberVisitPatientContext,
  writeVisitJourneyCache,
} from "@/lib/patients/visit-patient-context"
import {
  resolveVisitRailAction,
  type VisitRailAction,
} from "@/lib/patients/visit-rail-next"

export type PatientVisitRailState = {
  loading: boolean
  action: VisitRailAction
  hasOpenVisit: boolean
  phaseLabel: string | null
}

const EMPTY: PatientVisitRailState = {
  loading: true,
  action: { kind: "none" },
  hasOpenVisit: false,
  phaseLabel: null,
}

/**
 * Sticky visit rail Next/Checkout derived from open visit journey
 * (or intake journey / session cache when no open visit).
 */
export function usePatientVisitRail(patientId: string): PatientVisitRailState {
  const pathname = usePathname()
  const { activeBranch } = useBranch()
  const [state, setState] = React.useState<PatientVisitRailState>(EMPTY)

  React.useEffect(() => {
    if (!patientId) {
      setState({ ...EMPTY, loading: false })
      return
    }

    rememberVisitPatientContext(patientId)
    let cancelled = false

    const applyJourney = (journey: ClinicalVisitJourney, hasOpenVisit: boolean) => {
      writeVisitJourneyCache({
        patientId,
        nextStep: journey.nextStep,
        readyToClose: Boolean(journey.readyToClose),
        hasOpenVisit,
      })
      const action = resolveVisitRailAction(journey, pathname)
      if (!cancelled) {
        setState({
          loading: false,
          action,
          hasOpenVisit,
          phaseLabel: journey.phaseLabel,
        })
      }
    }

    const applyCachedFallback = () => {
      const cached = readVisitJourneyCache(patientId)
      if (!cached) {
        setState({ ...EMPTY, loading: false })
        return
      }
      setState({
        loading: false,
        action: cached.readyToClose
          ? { kind: "checkout" }
          : cached.nextStep
            ? { kind: "next", step: cached.nextStep }
            : { kind: "none" },
        hasOpenVisit: cached.hasOpenVisit,
        phaseLabel: null,
      })
    }

    const run = async () => {
      setState((prev) => ({ ...prev, loading: true }))

      const branchId = activeBranch?.id
      if (branchId) {
        const { data: detail } = await fetchActiveEncounter(patientId, branchId)
        if (cancelled) return
        if (detail?.encounter.status === "open") {
          applyJourney(
            buildEncounterVisitJourney({
              patientId,
              detail,
            }),
            true
          )
          return
        }
      }

      const [patientRes, medRes, consentsRes] = await Promise.all([
        getPatient(patientId),
        getLatestMedicalHistory(patientId),
        fetchPatientConsents(patientId),
      ])
      if (cancelled) return

      if (!patientRes.data) {
        applyCachedFallback()
        return
      }

      const medicalHistory = medRes.data
        ? {
            allergies: medRes.data.allergies,
            medications: medRes.data.medications,
            conditions: medRes.data.conditions,
          }
        : null

      applyJourney(
        buildClinicalVisitJourney({
          patientId,
          patient: patientRes.data,
          medicalHistory,
          consents: consentsRes.data ?? [],
          appointments: [],
          treatmentPlans: [],
          balance: null,
          billingGate: null,
          timeline: [],
          hasChartFindings: false,
        }),
        false
      )
    }

    void run().catch(() => {
      if (!cancelled) applyCachedFallback()
    })

    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id, pathname])

  return state
}
