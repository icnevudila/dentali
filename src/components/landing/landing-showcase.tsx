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

const DEVICE_TABS: {
  id: DeviceVariant
  label: string
  icon: typeof Monitor
  screen: WorkflowStageId
}[] = [
  { id: "desktop", label: "Web admin", icon: Monitor, screen: "dashboard" },
  { id: "tablet", label: "Tablet kiosk", icon: Tablet, screen: "kiosk" },
  { id: "mobile", label: "Mobile", icon: Smartphone, screen: "patients" },
  { id: "tv", label: "Queue TV", icon: Tv, screen: "display" },
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
  const [device, setDevice] = React.useState<DeviceVariant>("desktop")
  const tab = DEVICE_TABS.find((t) => t.id === device)!

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
              {item.label}
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
  return (
    <LandingShowcaseWell className="py-6 sm:py-8">
      <DeviceFrameRow>
        <DeviceFrame variant="desktop" compact label="Desktop · Admin panel">
          <div className={cn("w-full max-w-md overflow-hidden", VIEWPORT_HEIGHT.desktop)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="dashboard"
              scale={0.34}
              className="h-[720px] w-[1024px]"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame variant="tablet" compact label="Tablet · Kiosk check-in">
          <div className={cn("w-full overflow-hidden", VIEWPORT_HEIGHT.tablet)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="kiosk"
              scale={0.48}
              className="h-[720px] w-[400px]"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame variant="mobile" compact label="Mobile · Patient lookup">
          <div className={cn("w-full overflow-hidden", VIEWPORT_HEIGHT.mobile)}>
            <ShowcaseViewport
              snapshot={showcase}
              screen="patients"
              scale={0.52}
              className="h-[720px] w-[1024px]"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame variant="tv" compact label="TV · Waiting room">
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

const STAGE_ITEMS: { id: WorkflowStageId; step: string; title: string }[] = [
  { id: "dashboard", step: "01", title: "Command center" },
  { id: "patients", step: "02", title: "Patient registry" },
  { id: "chart", step: "03", title: "Dental chart" },
  { id: "appointments", step: "04", title: "Appointments" },
  { id: "kiosk", step: "05", title: "Kiosk check-in" },
  { id: "display", step: "06", title: "Queue display" },
  { id: "billing", step: "07", title: "Billing" },
]

export function LandingWorkflowSection({ showcase }: { showcase: ShowcaseSnapshot }) {
  const [stage, setStage] = React.useState<WorkflowStageId>("dashboard")
  const meta = WORKFLOW_STAGES.find((s) => s.id === stage)!

  return (
    <LandingSection tone="muted" className="scroll-mt-16 px-4 py-16 sm:px-6" id="product-tour">
      <div className="mx-auto max-w-5xl space-y-10">
        <LandingSectionHeader
          eyebrow="Product tour"
          title="One system from front desk to chair side"
          description="Walk through the modules your Philippine clinic team uses every day — with live data when showcase seed is configured."
          align="center"
        />
        <LandingStagePicker active={stage} onChange={setStage} />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
              Step {meta.step}
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
}: {
  active: WorkflowStageId
  onChange: (id: WorkflowStageId) => void
}) {
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
      {STAGE_ITEMS.map((item) => {
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
