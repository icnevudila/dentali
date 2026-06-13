"use client"

import type { ComponentType } from "react"
import { cn } from "@/lib/utils"
import type { ShowcaseSnapshot } from "@/lib/showcase/types"
import type { WorkflowStageId } from "@/components/landing/mock-data"
import { ShowcaseBootstrap } from "@/components/showcase/ShowcaseBootstrap"
import { ShowcaseAppChrome } from "@/components/showcase/ShowcaseAppChrome"
import { KioskShowcasePanel } from "@/components/showcase/KioskShowcasePanel"
import { DisplayShowcasePanel } from "@/components/showcase/DisplayShowcasePanel"
import DashboardPage from "@/app/(dashboard)/page"
import PatientsPage from "@/app/(dashboard)/patients/page"
import DentalChartPage from "@/app/(dashboard)/patients/[id]/chart/page"
import AppointmentsPage from "@/app/(dashboard)/appointments/page"
import BillingPage from "@/app/(dashboard)/billing/page"

const ADMIN_SCREENS: Partial<Record<WorkflowStageId, ComponentType>> = {
  dashboard: DashboardPage,
  patients: PatientsPage,
  chart: DentalChartPage,
  appointments: AppointmentsPage,
  billing: BillingPage,
}

type ShowcaseViewportProps = {
  snapshot: ShowcaseSnapshot
  screen: WorkflowStageId
  /** Scale factor for landing device frames (1 = full app width) */
  scale?: number
  className?: string
  interactive?: boolean
}

export function ShowcaseViewport({
  snapshot,
  screen,
  scale = 0.42,
  className,
  interactive = false,
}: ShowcaseViewportProps) {
  const routeParams =
    screen === "chart" && snapshot.chartPatientId
      ? { id: snapshot.chartPatientId }
      : undefined

  const AdminPage = ADMIN_SCREENS[screen]

  return (
    <ShowcaseBootstrap snapshot={snapshot} routeParams={routeParams}>
      <div
        className={cn(
          "relative overflow-hidden bg-neutral-100",
          !interactive && "pointer-events-none select-none",
          className
        )}
      >
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${scale})`,
            width: `${100 / scale}%`,
            minHeight: `${100 / scale}%`,
          }}
        >
          {screen === "kiosk" ? (
            <KioskShowcasePanel branchName={snapshot.branch.name} />
          ) : screen === "display" ? (
            <DisplayShowcasePanel branchName={snapshot.branch.name} entries={snapshot.queueEntries} />
          ) : AdminPage ? (
            <ShowcaseAppChrome>
              <AdminPage />
            </ShowcaseAppChrome>
          ) : null}
        </div>
      </div>
    </ShowcaseBootstrap>
  )
}
