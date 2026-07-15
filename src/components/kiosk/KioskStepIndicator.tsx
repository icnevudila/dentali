import { cn } from "@/lib/utils"

type KioskStep = "welcome" | "checkin" | "intake" | "done"

const STEPS: { id: KioskStep; label: string }[] = [
  { id: "welcome", label: "Start" },
  { id: "checkin", label: "Check-in" },
  { id: "intake", label: "Register" },
  { id: "done", label: "Done" },
]

function stepIndex(step: KioskStep): number {
  return STEPS.findIndex((s) => s.id === step)
}

export function KioskStepIndicator({ active }: { active: KioskStep }) {
  const activeIdx = stepIndex(active)

  return (
    <div className="mb-6 flex items-center justify-center gap-2" aria-label="Progress">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              idx <= activeIdx ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-400"
            )}
          >
            {idx + 1}
          </div>
          {idx < STEPS.length - 1 ? (
            <div
              className={cn(
                "h-0.5 w-6 rounded-full",
                idx < activeIdx ? "bg-primary-400" : "bg-neutral-200"
              )}
              aria-hidden
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function kioskStepFromFlow(step: string): KioskStep {
  if (
    step === "success" ||
    step === "intakeSuccess" ||
    step === "satisfaction_survey" ||
    step === "survey_success"
  ) {
    return "done"
  }
  if (step === "form" || step === "consents" || step === "mood") return "checkin"
  if (step === "intakeForm" || step === "update_history_verify" || step === "update_history_form") {
    return "intake"
  }
  return "welcome"
}
