"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { addTransitionType, startTransition } from "react"
import { ArrowRight, DoorClosed } from "lucide-react"
import { BackToPatientProfile } from "@/components/patients/BackToPatientProfile"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { usePatientVisitRail } from "@/hooks/use-patient-visit-rail"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { rememberVisitPatientContext } from "@/lib/patients/visit-patient-context"
import { cn } from "@/lib/utils"

type PatientVisitActionRailProps = {
  patientId: string
  /** Extra label under Back (layout hint). */
  showHint?: boolean
  className?: string
}

export function PatientVisitActionRail({
  patientId,
  showHint = true,
  className,
}: PatientVisitActionRailProps) {
  const { t } = useLocale()
  const router = useRouter()
  const { loading, action, hasOpenVisit, phaseLabel } = usePatientVisitRail(patientId)

  React.useEffect(() => {
    rememberVisitPatientContext(patientId)
  }, [patientId])

  const goCheckout = () => {
    startTransition(() => {
      addTransitionType("nav-forward")
      router.push(`/patients/${patientId}?checkout=1`)
    })
  }

  const goNext = (href: string) => {
    if (href.includes("/billing")) {
      rememberVisitPatientContext(patientId)
    }
    // Same-route tab change on profile
    if (href.includes("?") && href.startsWith(`/patients/${patientId}`)) {
      startTransition(() => {
        addTransitionType("nav-forward")
        router.push(href)
      })
      return
    }
    startTransition(() => {
      addTransitionType("nav-forward")
      router.push(href)
    })
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-40 -mx-4 mb-4 border-b border-primary-100/80 bg-primary-50/95 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 print:hidden",
        className
      )}
      style={{ viewTransitionName: "patient-visit-action-rail" }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <BackToPatientProfile patientId={patientId} />
          {showHint ? (
            <p className="text-xs text-neutral-600 sm:text-sm">
              {phaseLabel && hasOpenVisit
                ? phaseLabel
                : t(
                    "patients.returnBarHint",
                    "Leave this screen anytime — return to the full patient file."
                  )}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <span className="text-xs text-neutral-500">
              {t("common.loading", "Loading…")}
            </span>
          ) : null}

          {!loading && action.kind === "checkout" ? (
            <Button size="sm" className="gap-2" onClick={goCheckout}>
              <DoorClosed className="h-4 w-4" aria-hidden />
              {t("queue.checkoutDischargeCta", "Checkout / Discharge")}
            </Button>
          ) : null}

          {!loading && action.kind === "next" && action.step.href ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => goNext(action.step.href!)}
              asChild={false}
            >
              {t("patients.visitRailNext", "Next")}: {action.step.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}

          {!loading && action.kind === "next" && !action.step.href ? (
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <Link href={`/patients/${patientId}`} transitionTypes={NAV_FORWARD_TRANSITION}>
                {t("patients.visitRailOpenProfile", "Open patient profile")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
