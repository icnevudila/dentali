"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { ShowcaseSnapshot } from "@/lib/showcase/types"
import type { DeviceVariant, WorkflowStageId } from "@/components/landing/mock-data"
import { WORKFLOW_STAGES } from "@/components/landing/mock-data"
import { LandingSection, LandingSectionHeader } from "@/components/landing/landing-primitives"
import { DeviceFrame, DeviceFrameRow } from "@/components/landing/device-frame"
import { LandingShowcaseWell } from "@/components/landing/landing-primitives"
import { ShowcaseViewport } from "@/components/showcase/ShowcaseViewport"
import { Monitor, Radio, Smartphone, Tablet, Tv } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

const DEVICE_TABS: {
  id: DeviceVariant
  labelKey: string
  fallback: string
  icon: typeof Monitor
  screen: WorkflowStageId
}[] = [
  { id: "desktop", labelKey: "landing.deviceWebAdmin", fallback: "Web admin", icon: Monitor, screen: "dashboard" },
  { id: "tablet", labelKey: "landing.deviceTabletKiosk", fallback: "Tablet kiosk", icon: Tablet, screen: "kiosk" },
  { id: "mobile", labelKey: "landing.deviceMobile", fallback: "Mobile", icon: Smartphone, screen: "patients" },
  { id: "tv", labelKey: "landing.deviceQueueTv", fallback: "Queue TV", icon: Tv, screen: "display" },
]

const DEVICE_SCALE: Record<DeviceVariant, number> = {
  desktop: 0.38,
  tablet: 0.52,
  mobile: 0.58,
  tv: 0.48,
}

const VIEWPORT_HEIGHT: Record<DeviceVariant, string> = {
  desktop: "h-[280px] sm:h-[320px]",
  tablet: "h-[320px] sm:h-[360px]",
  mobile: "h-[340px] sm:h-[380px]",
  tv: "h-[220px] sm:h-[260px]",
}

export function LandingHeroDevices({ showcase }: { showcase: ShowcaseSnapshot }) {
  const { t } = useLocale()
  const [device, setDevice] = React.useState<DeviceVariant>("desktop")
  const tab = DEVICE_TABS.find((item) => item.id === device)!

  return (
    <div className="space-y-5">
      <div
        className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-neutral-200/90 bg-white/90 p-1 shadow-sm backdrop-blur-sm"
        role="tablist"
        aria-label="Preview device"
      >
        {DEVICE_TABS.map((item) => {
          const Icon = item.icon
          const selected = device === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDevice(item.id)}
              className={cn(
                "landing-device-tab inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium",
                selected
                  ? "bg-neutral-950 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(item.labelKey, item.fallback)}
            </button>
          )
        })}
      </div>

      <LandingShowcaseWell className="mx-auto max-w-lg">
        <DeviceFrame variant={device} elevated className="w-full">
          <div
            key={`${device}-${tab.screen}`}
            className={cn("w-full overflow-hidden landing-preview-fade", VIEWPORT_HEIGHT[device])}
          >
            <ShowcaseViewport
              snapshot={showcase}
              screen={tab.screen}
              scale={DEVICE_SCALE[device]}
              className="h-[720px] w-[1024px]"
            />
          </div>
        </DeviceFrame>
      </LandingShowcaseWell>

      <div className="flex flex-col items-center gap-1.5 text-center">
        {showcase.source !== "empty" ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/80 bg-primary-50/80 px-3 py-1 text-xs font-medium text-primary-800">
              <Radio className="h-3 w-3 text-primary-600" aria-hidden />
              Live preview · {showcase.branch.name}
            </span>
            {showcase.source === "session" ? (
              <p className="text-[11px] text-neutral-500">Your signed-in clinic data</p>
            ) : null}
          </>
        ) : (
          <p className="max-w-xs text-xs leading-relaxed text-amber-800/90">
            Sign in to see your clinic on this page, or configure showcase keys in the environment.
          </p>
        )}
      </div>
    </div>
  )
}

export function LandingWorkflowPreview({
  showcase,
  stageId,
  className,
}: {
  showcase: ShowcaseSnapshot
  stageId: WorkflowStageId
  className?: string
}) {
  const variant: DeviceVariant =
    stageId === "kiosk"
      ? "tablet"
      : stageId === "display"
        ? "tv"
        : stageId === "appointments"
          ? "tablet"
          : "desktop"

  return (
    <LandingShowcaseWell className={className}>
      <DeviceFrame variant={variant} elevated className="mx-auto w-full max-w-md">
        <div
          key={stageId}
          className={cn("w-full overflow-hidden landing-preview-fade", VIEWPORT_HEIGHT[variant])}
        >
          <ShowcaseViewport
            snapshot={showcase}
            screen={stageId}
            scale={DEVICE_SCALE[variant]}
            className="h-[720px] w-[1024px]"
          />
        </div>
      </DeviceFrame>
    </LandingShowcaseWell>
  )
}

export function LandingMultiDeviceRow({ showcase }: { showcase: ShowcaseSnapshot }) {
  const { t } = useLocale()
  return (
    <LandingShowcaseWell className="py-6 sm:py-8">
      <DeviceFrameRow>
        <DeviceFrame
          variant="desktop"
          compact
          label={t("landing.deviceDesktopAdmin", "Desktop · Admin dashboard")}
        >
          <div className={cn("w-full max-w-md overflow-hidden", VIEWPORT_HEIGHT.desktop)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="dashboard"
              scale={0.34}
              className="h-[720px] w-[1024px]"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame
          variant="tablet"
          compact
          label={t("landing.deviceTabletQueue", "Tablet · Queue board")}
        >
          <div className={cn("w-full overflow-hidden", VIEWPORT_HEIGHT.tablet)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="kiosk"
              scale={0.48}
              className="h-[720px] w-[400px]"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame
          variant="mobile"
          compact
          label={t("landing.deviceMobileLookup", "Mobile · Patient lookup")}
        >
          <div className={cn("w-full overflow-hidden", VIEWPORT_HEIGHT.mobile)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="patients"
              scale={0.52}
              className="h-[720px] w-[1024px]"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame variant="tv" compact label={t("landing.deviceTvWaiting", "TV · Waiting room")}>
          <div className={cn("w-full overflow-hidden", VIEWPORT_HEIGHT.tv)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="display"
              scale={0.45}
              className="h-[480px] w-[1024px]"
            />
          </div>
        </DeviceFrame>
      </DeviceFrameRow>
    </LandingShowcaseWell>
  )
}

const STAGE_DEFS: { id: WorkflowStageId; step: string; titleKey: string; fallback: string }[] = [
  { id: "dashboard", step: "01", titleKey: "landing.stageDashboard", fallback: "Command center" },
  { id: "patients", step: "02", titleKey: "landing.stagePatients", fallback: "Patient registry" },
  { id: "chart", step: "03", titleKey: "landing.stageChart", fallback: "Dental chart" },
  { id: "appointments", step: "04", titleKey: "landing.stageAppointments", fallback: "Appointments" },
  { id: "kiosk", step: "05", titleKey: "landing.stageKiosk", fallback: "Kiosk check-in" },
  { id: "display", step: "06", titleKey: "landing.stageDisplay", fallback: "Queue display" },
  { id: "billing", step: "07", titleKey: "landing.stageBilling", fallback: "Billing" },
]

function workflowStageCopy(
  id: WorkflowStageId,
  t: (key: string, fallback: string) => string
) {
  const stage = WORKFLOW_STAGES.find((s) => s.id === id)!
  const copy: Record<
    WorkflowStageId,
    { title: string; subtitle: string; description: string }
  > = {
    dashboard: {
      title: t("landing.wfDashboardTitle", "Clinic command center"),
      subtitle: t("landing.wfDashboardSubtitle", "Web · Desktop & tablet"),
      description: t(
        "landing.wfDashboardDesc",
        "Owners and front desk see today's appointments, queue depth, pending consents, and low-stock alerts — branch-aware from the first login."
      ),
    },
    patients: {
      title: t("landing.wfPatientsTitle", "Patient registry & intake"),
      subtitle: t("landing.wfPatientsSubtitle", "Web · Searchable records"),
      description: t(
        "landing.wfPatientsDesc",
        "Register walk-ins and returning patients, capture demographics, insurance, and intake drafts without losing paper-form completeness."
      ),
    },
    chart: {
      title: t("landing.wfChartTitle", "Dental chart & treatment plan"),
      subtitle: t("landing.wfChartSubtitle", "Web · Chair-side clinical"),
      description: t(
        "landing.wfChartDesc",
        "FDI odontogram, tooth findings, treatment plans, and clinical notes stay linked to the same patient profile your billing team uses."
      ),
    },
    appointments: {
      title: t("landing.wfAppointmentsTitle", "Appointments & waitlist"),
      subtitle: t("landing.wfAppointmentsSubtitle", "Web · Scheduling desk"),
      description: t(
        "landing.wfAppointmentsDesc",
        "Chair calendars, provider availability, SMS reminders, and waitlist callbacks — built for busy reception desks."
      ),
    },
    kiosk: {
      title: t("landing.wfKioskTitle", "Kiosk check-in"),
      subtitle: t("landing.wfKioskSubtitle", "Tablet · Patient-facing"),
      description: t(
        "landing.wfKioskDesc",
        "Patients check in at the branch tablet, confirm contact details, and receive a queue number — no raw errors on screen."
      ),
    },
    display: {
      title: t("landing.wfDisplayTitle", "Queue display board"),
      subtitle: t("landing.wfDisplaySubtitle", "TV · Waiting room"),
      description: t(
        "landing.wfDisplayDesc",
        "Large-format queue codes for the waiting area. Now serving and up next — calm typography, no PHI beyond first names."
      ),
    },
    billing: {
      title: t("landing.wfBillingTitle", "Billing, HMO & PhilHealth prep"),
      subtitle: t("landing.wfBillingSubtitle", "Web · Finance desk"),
      description: t(
        "landing.wfBillingDesc",
        "Invoices in PHP minor units, payment ledger, HMO claim tracking, and PhilHealth eClaims readiness with audit-friendly records."
      ),
    },
  }
  return { step: stage.step, ...copy[id] }
}

export function LandingWorkflowSection({ showcase }: { showcase: ShowcaseSnapshot }) {
  const { t } = useLocale()
  const [stage, setStage] = React.useState<WorkflowStageId>("dashboard")
  const meta = workflowStageCopy(stage, t)
  const stageItems = STAGE_DEFS.map((item) => ({
    id: item.id,
    step: item.step,
    title: t(item.titleKey, item.fallback),
  }))

  return (
    <LandingSection tone="muted" className="scroll-mt-16 px-4 py-16 sm:px-6" id="product-tour">
      <div className="mx-auto max-w-5xl space-y-10">
        <LandingSectionHeader
          eyebrow={t("landing.workflowEyebrow", "Product tour")}
          title={t("landing.workflowTitle", "One system from front desk to chair side")}
          description={t(
            "landing.workflowDescription",
            "Walk through the modules your clinic team uses every day — with live data when showcase seed is configured."
          )}
          align="center"
        />
        <LandingStagePicker active={stage} onChange={setStage} items={stageItems} />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
              {t("landing.workflowStep", "Step")} {meta.step}
            </p>
            <h3 className="text-xl font-semibold text-neutral-950">{meta.title}</h3>
            <p className="text-sm text-neutral-500">{meta.subtitle}</p>
            <p className="text-base leading-relaxed text-neutral-600">{meta.description}</p>
          </div>
          <LandingWorkflowPreview showcase={showcase} stageId={stage} />
        </div>
      </div>
    </LandingSection>
  )
}

export function LandingStagePicker({
  active,
  onChange,
  items,
}: {
  active: WorkflowStageId
  onChange: (id: WorkflowStageId) => void
  items: { id: WorkflowStageId; step: string; title: string }[]
}) {
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const selected = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "landing-device-tab shrink-0 rounded-xl border px-4 py-2.5 text-left",
              selected
                ? "landing-stage-card-active border-primary-300/80 bg-white"
                : "border-neutral-200/80 bg-white/60 hover:border-neutral-300 hover:bg-white"
            )}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-600">
              {item.step}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-neutral-900">{item.title}</span>
          </button>
        )
      })}
    </div>
  )
}
